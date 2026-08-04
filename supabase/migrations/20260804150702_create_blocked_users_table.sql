-- "Заблокировать" - более серьёзное действие, чем "Скрыть анкету" (см.
-- hidden_profiles): блокировка должна быть ВЗАИМНОЙ (ни я не вижу его, ни он
-- не видит меня) и должна реально запрещать переписку на уровне базы, а не
-- только прятать кнопку на экране. Структура таблицы повторяет проверенный
-- паттерн hidden_profiles - пара id + запрет заблокировать самого себя,
-- select-политика показывает только исходящие блокировки (кого заблокировал
-- я), не входящие - заблокированный человек не должен из этой таблицы узнать,
-- кто именно его заблокировал (та же причина приватности, что и у hidden_profiles).
create table public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

create policy "blocked_users_select_own" on public.blocked_users
  for select
  to authenticated
  using ( (select auth.uid()) = blocker_id );

create policy "blocked_users_insert_own" on public.blocked_users
  for insert
  to authenticated
  with check ( (select auth.uid()) = blocker_id );

-- Разблокировать - удалить свою же строку (экран "Заблокированные" в Аккаунте)
create policy "blocked_users_delete_own" on public.blocked_users
  for delete
  to authenticated
  using ( (select auth.uid()) = blocker_id );

revoke all on public.blocked_users from anon, authenticated;
grant select, insert, delete on public.blocked_users to authenticated;
