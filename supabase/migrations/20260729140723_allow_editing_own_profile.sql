-- Разрешаем менять только свою анкету. select-политика для этого уже есть
-- (profiles_select_all_authenticated) - Postgres требует её для update. using +
-- with check оба на auth.uid() = user_id, чтобы нельзя было ни поменять чужую
-- анкету, ни переписать свою на чужой user_id.
create policy "profiles_update_own" on public.profiles
  for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

grant update on public.profiles to authenticated;
