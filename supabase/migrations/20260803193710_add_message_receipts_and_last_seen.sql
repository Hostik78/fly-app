-- Статус сообщения (Отправлено/Доставлено/Просмотрено) и "был в сети N назад"
-- в шапке чата - см. docs/superpowers/specs/2026-08-03-chat-receipts-presence-profile-design.md
-- за полным объяснением решений ниже.

-- Два новых поля прямо на сообщении, не отдельная таблица - чат всегда 1-на-1,
-- у сообщения ровно один получатель, отдельная таблица статусов нужна только
-- для групповых чатов (там у одного сообщения статус разный для каждого из
-- многих получателей).
alter table public.messages
  add column delivered_at timestamptz,
  add column read_at timestamptz;

-- Обновлять эти два поля может только получатель (не отправитель) - column-level
-- grant физически не даёт даже теоретически переписать сам текст сообщения
-- через ту же лазейку (grant без списка колонок дал бы полный UPDATE).
grant update (delivered_at, read_at) on public.messages to authenticated;

create policy "messages_update_receipt" on public.messages
  for update
  to authenticated
  using ( (select auth.uid()) = recipient_id )
  with check ( (select auth.uid()) = recipient_id );

-- "Был в сети N назад" - когда человек последний раз пользовался приложением.
-- Права на чтение/запись уже подходят как есть (profiles_select_all_authenticated
-- и profiles_update_own из более ранних миграций), новых grant/policy не нужно -
-- это поле обновляет только сам человек про самого себя, и его уже видят все
-- вошедшие пользователи, как и остальные поля анкеты.
alter table public.profiles add column last_seen_at timestamptz;
