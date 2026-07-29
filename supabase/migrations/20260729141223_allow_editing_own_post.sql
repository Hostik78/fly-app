-- Разрешаем менять только свою публикацию. select-политика уже есть
-- (posts_select_all_authenticated), Postgres требует её для update. using + with
-- check оба на auth.uid() = user_id - нельзя ни поменять чужую публикацию, ни
-- переписать свою на чужой user_id.
create policy "posts_update_own" on public.posts
  for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

grant update on public.posts to authenticated;
