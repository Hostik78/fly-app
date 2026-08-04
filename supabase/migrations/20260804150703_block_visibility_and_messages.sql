-- Две функции для взаимной блокировки. Обе - security definer (см. пример
-- count_pending_likes в 20260730215625): RLS на blocked_users нарочно
-- показывает только СВОИ исходящие блокировки (см. предыдущую миграцию), а
-- этим функциям нужно видеть блокировку в ЛЮБУЮ сторону - обычный select
-- через RLS для этого не подходит, но сама функция всё равно смотрит только
-- на пары, включающие auth.uid() (свой собственный, взятый изнутри функции),
-- узнать чужую блокировку через неё невозможно.

-- 1) Список id, которые должны стать взаимно невидимыми для текущего
--    пользователя (кого заблокировал я + кто заблокировал меня) - использует
--    лента (useFeedProfiles) и совпадения (useMatches), чтобы убрать таких
--    людей из списка с обеих сторон, не только у того, кто нажал "Заблокировать".
create or replace function public.get_visibility_blocked_ids()
returns table (user_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select blocked_id as user_id from public.blocked_users where blocker_id = (select auth.uid())
  union
  select blocker_id as user_id from public.blocked_users where blocked_id = (select auth.uid())
$$;

revoke all on function public.get_visibility_blocked_ids() from public;
grant execute on function public.get_visibility_blocked_ids() to authenticated;
revoke execute on function public.get_visibility_blocked_ids() from anon;

-- 2) Да/нет - заблокирована ли пара (я, другой человек) в любую сторону -
--    используется прямо в политике вставки сообщений ниже, чтобы запрет
--    работал на уровне базы, а не только скрытием кнопки в интерфейсе.
create or replace function public.is_blocked_pair(other_user_id uuid)
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

revoke all on function public.is_blocked_pair(uuid) from public;
grant execute on function public.is_blocked_pair(uuid) to authenticated;
revoke execute on function public.is_blocked_pair(uuid) from anon;

-- Переписываем политику вставки сообщений - тот же взаимный лайк, что и
-- раньше, плюс новое условие: пара не должна быть заблокирована ни в одну
-- сторону.
drop policy "messages_insert_if_matched" on public.messages;

create policy "messages_insert_if_matched" on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (select 1 from public.likes where liker_id = sender_id and liked_id = recipient_id)
    and exists (select 1 from public.likes where liker_id = recipient_id and liked_id = sender_id)
    and not public.is_blocked_pair(recipient_id)
  );
