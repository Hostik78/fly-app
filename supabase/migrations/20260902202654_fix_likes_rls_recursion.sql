-- Политика likes_select_own_or_mutual из миграции 20260729140259 пыталась
-- определить взаимность подзапросом к той же таблице public.likes. Но каждый
-- SELECT из likes снова запускает эту же RLS-политику, включая SELECT внутри
-- неё самой. PostgreSQL закономерно останавливал бесконечный круг ошибкой
-- 42P17 (infinite recursion detected in policy for relation "likes"). Из-за
-- этого ломалось даже чтение собственных исходящих лайков, а вместе с ним —
-- вся лента.
--
-- Клиенту на самом деле не нужны строки входящих лайков: для интерфейса он
-- читает только собственные исходящие лайки, а готовые совпадения и число
-- ожидающих лайков уже возвращают отдельные SECURITY DEFINER-функции. Поэтому
-- политика становится простой и нерекурсивной: человек видит только строки,
-- которые создал сам. Это одновременно строже защищает личность человека,
-- поставившего односторонний лайк.
drop policy if exists "likes_select_own_or_mutual" on public.likes;

create policy "likes_select_own" on public.likes
  for select
  to authenticated
  using ((select auth.uid()) = liker_id);

-- Для отправки сообщения всё равно нужно проверить ДВЕ строки лайков. Делать
-- это прямо внутри messages_insert_if_matched теперь нельзя: обычный
-- authenticated-пользователь не видит входящий односторонний лайк. Закрытая
-- функция выполняет ровно булеву проверку пары в обход RLS и не возвращает ни
-- строки, ни id поставившего лайк. Схема private не опубликована через Data API,
-- поэтому функцию нельзя вызвать снаружи как public RPC.
create or replace function private.is_mutual_match(other_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.likes
      where liker_id = (select auth.uid())
        and liked_id = other_user_id
    )
    and exists (
      select 1
      from public.likes
      where liker_id = other_user_id
        and liked_id = (select auth.uid())
    );
$$;

grant usage on schema private to authenticated;
revoke all on function private.is_mutual_match(uuid) from public;
grant execute on function private.is_mutual_match(uuid) to authenticated;
revoke execute on function private.is_mutual_match(uuid) from anon;

drop policy if exists "messages_insert_if_matched" on public.messages;

create policy "messages_insert_if_matched" on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and private.is_mutual_match(recipient_id)
    and not private.is_blocked_pair(recipient_id)
  );
