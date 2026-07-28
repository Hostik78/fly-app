-- Была политика "select только своей строки" - для настоящей ленты (все видят
-- публикации/анкеты друг друга, только не могут их менять/удалять) заменяем на
-- select для любого вошедшего. insert-политики (только свою строку) не трогаем.

drop policy "posts_select_own" on public.posts;
create policy "posts_select_all_authenticated" on public.posts
  for select
  to authenticated
  using (true);

drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select_all_authenticated" on public.profiles
  for select
  to authenticated
  using (true);
