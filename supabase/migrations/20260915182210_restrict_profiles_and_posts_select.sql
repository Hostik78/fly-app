-- Клиент уже переведён на get_feed_profiles(), get_match_profiles() и
-- get_blocked_profiles(). Теперь закрываем старый широкий путь, через который
-- любой вошедший пользователь мог напрямую скачать все анкеты и заметки,
-- обойдя скрытие и блокировки. Обычный SELECT остаётся только для собственной
-- строки — он нужен запуску приложения и экрану аккаунта.

drop policy if exists "posts_select_all_authenticated" on public.posts;
drop policy if exists "posts_select_own" on public.posts;

create policy "posts_select_own" on public.posts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
