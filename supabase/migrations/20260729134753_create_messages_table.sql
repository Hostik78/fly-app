create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

alter table public.messages enable row level security;

-- Видно сообщения, где я отправитель или получатель
create policy "messages_select_own" on public.messages
  for select
  to authenticated
  using ( (select auth.uid()) = sender_id or (select auth.uid()) = recipient_id );

-- Писать можно только от своего имени, и только тому, с кем есть настоящее
-- взаимное совпадение - проверка прямо в базе, не только в интерфейсе.
create policy "messages_insert_if_matched" on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (select 1 from public.likes where liker_id = sender_id and liked_id = recipient_id)
    and exists (select 1 from public.likes where liker_id = recipient_id and liked_id = sender_id)
  );

revoke all on public.messages from anon, authenticated;
grant select, insert on public.messages to authenticated;
