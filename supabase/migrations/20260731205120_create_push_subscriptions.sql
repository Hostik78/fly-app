-- Подписка браузера на push-уведомления (Web Push, стандартный платформенный API -
-- см. CLAUDE.md). endpoint/p256dh/auth - это ровно то, что отдаёт браузер из
-- PushSubscription.toJSON() при подписке (см. usePushNotifications.ts), больше
-- ничего в этих полях нет. endpoint уникален - у каждого браузерного профиля
-- своя подписка, повторная подписка того же браузера обновляет старую строку
-- (upsert по endpoint), а не создаёт вторую.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Видно, добавлять и удалять можно только свои подписки. Изменять (update) их
-- не нужно - при смене (например, браузер обновил внутренний endpoint) клиент
-- просто заново подписывается (upsert по endpoint), апдейт по отдельным полям
-- никогда не понадобится.
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Явно отзываем и выдаём заново (см. LESSONS.md - у Supabase есть свои права по
-- умолчанию шире, чем написано в grant, "revoke ... from public" их не убирает,
-- нужно явно от anon и authenticated).
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
