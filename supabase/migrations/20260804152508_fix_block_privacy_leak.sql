-- Код-ревью нашёл серьёзную дыру в прошлой миграции (20260804150703): обе новые
-- функции были доступны напрямую (не только изнутри самого приложения) через
-- обычный запрос "supabase.rpc(...)" - хотя предполагалось, что узнать, КТО
-- именно тебя заблокировал, невозможно (см. комментарий blocked_users_select_own
-- в 20260804150702). На деле:
--
-- 1) is_blocked_pair(other_user_id) вообще не должна была быть вызываемой
--    напрямую - она нужна только ВНУТРИ политики на messages. Но раз у неё
--    было "grant execute ... to authenticated", а сама функция лежала в схеме
--    public (Supabase публикует все функции public наружу как /rest/v1/rpc/...),
--    кто угодно мог перебрать все user_id (они и так все видны через
--    profiles_select_all_authenticated) и вызвать эту функцию для каждого -
--    результат "true" для тех, кого сам не блокировал, как раз и есть список
--    заблокировавших его людей.
--
-- 2) get_visibility_blocked_ids() отдавала объединение "кого заблокировал я" +
--    "кто заблокировал меня" одним списком id. Свою половину (кого заблокировал
--    я) и так видно напрямую (select из blocked_users, политика
--    blocked_users_select_own), значит вычитанием получаем вторую половину -
--    ту самую, которую скрывать и была вся задумка.
--
-- Решение:
-- - is_blocked_pair переезжает в отдельную схему "private", которую Supabase
--   не публикует наружу (по умолчанию наружу видна только схема public) - внутри
--   политики её вызывать можно как раньше, а вот POST .../rpc/is_blocked_pair
--   больше не сработает ни для кого.
-- - get_visibility_blocked_ids() отдавала клиенту "сырой" список - вместо неё
--   заводим две функции, которые сразу отдают УЖЕ отфильтрованный результат
--   (кому показывать в ленте / с кем есть совпадение), а не список id для
--   исключения - client-side разница множеств тогда ничего не даёт, потому что
--   видимый результат зависит ещё и от реальных постов/лайков, а не только от
--   самого факта блокировки (то же по духу ограничение приватности, что уже
--   было принято для hidden_profiles - см. её комментарий).

drop policy "messages_insert_if_matched" on public.messages;
drop function public.is_blocked_pair(uuid);
drop function public.get_visibility_blocked_ids();

create schema if not exists private;

create or replace function private.is_blocked_pair(other_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = (select auth.uid()) and blocked_id = other_user_id)
       or (blocker_id = other_user_id and blocked_id = (select auth.uid()))
  );
$$;

-- Схема private не входит в список схем, которые Supabase отдаёт через
-- PostgREST (по умолчанию только public) - поэтому revoke от anon тут не
-- обязателен так же строго, как для функций в public (см. LESSONS.md про
-- storage.objects/count_pending_likes), но всё равно делаем по той же
-- привычке "не полагаться на то, что что-то случайно безобидно".
grant usage on schema private to authenticated;
revoke all on function private.is_blocked_pair(uuid) from public;
grant execute on function private.is_blocked_pair(uuid) to authenticated;
revoke execute on function private.is_blocked_pair(uuid) from anon;

create policy "messages_insert_if_matched" on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (select 1 from public.likes where liker_id = sender_id and liked_id = recipient_id)
    and exists (select 1 from public.likes where liker_id = recipient_id and liked_id = sender_id)
    and not private.is_blocked_pair(recipient_id)
  );

-- Лента (useFeedProfiles.ts): раньше клиент сам собирал список постов, список
-- скрытых и список заблокированных id тремя запросами и фильтровал в JS - это
-- и была утечка (см. выше). Теперь одна функция сама возвращает уже готовый
-- список постов, которые можно показать - скрытых/заблокированных людей и
-- себя самого в нём просто нет с самого начала, клиент не видит ни одного id,
-- который был бы исключён именно из-за блокировки.
create or replace function public.get_feed_posts()
returns table (user_id uuid, quote text, category text, hobby text, created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select p.user_id, p.quote, p.category, p.hobby, p.created_at
  from public.posts p
  where p.user_id <> (select auth.uid())
    and not exists (
      select 1 from public.hidden_profiles h
      where h.hider_id = (select auth.uid()) and h.hidden_id = p.user_id
    )
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_id = (select auth.uid()))
    )
  order by p.created_at desc
  limit 50;
$$;

revoke all on function public.get_feed_posts() from public;
grant execute on function public.get_feed_posts() to authenticated;
revoke execute on function public.get_feed_posts() from anon;

-- Совпадения (useMatches.ts): та же идея - готовый список id людей, с кем
-- есть взаимный лайк И которые не заблокированы ни в одну сторону, вместо
-- отдельного списка блокировок для вычитания на стороне клиента.
create or replace function public.get_match_user_ids()
returns table (user_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select l1.liked_id as user_id
  from public.likes l1
  where l1.liker_id = (select auth.uid())
    and exists (
      select 1 from public.likes l2
      where l2.liker_id = l1.liked_id and l2.liked_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = l1.liked_id)
         or (b.blocker_id = l1.liked_id and b.blocked_id = (select auth.uid()))
    );
$$;

revoke all on function public.get_match_user_ids() from public;
grant execute on function public.get_match_user_ids() to authenticated;
revoke execute on function public.get_match_user_ids() from anon;
