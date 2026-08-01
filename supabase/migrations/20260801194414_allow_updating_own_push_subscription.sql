-- Найдено проверкой кода: клиент подписывается через upsert(..., { onConflict:
-- 'endpoint' }) (см. usePushNotifications.ts) - это в Postgres превращается в
-- INSERT ... ON CONFLICT (endpoint) DO UPDATE. Ветке "конфликт -> обновить" нужно
-- ОТДЕЛЬНОЕ право UPDATE (не покрывается INSERT) - его не было вообще, ни грантом,
-- ни политикой. Как только человек переподписывался тем же браузером (endpoint уже
-- есть в таблице - например два открытых окна разом, или просто повторное
-- нажатие) - upsert падал с "permission denied for table push_subscriptions".
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

grant update on public.push_subscriptions to authenticated;
