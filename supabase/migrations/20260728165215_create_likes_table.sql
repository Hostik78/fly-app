create table public.likes (
  liker_id uuid not null references auth.users (id) on delete cascade,
  liked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  check (liker_id <> liked_id)
);

alter table public.likes enable row level security;

-- Видно только свои лайки (кого лайкнул я, и кто лайкнул меня) - второе нужно,
-- чтобы вычислять совпадения.
create policy "likes_select_own_or_received" on public.likes
  for select
  to authenticated
  using ( (select auth.uid()) = liker_id or (select auth.uid()) = liked_id );

-- Ставить лайк можно только от своего имени
create policy "likes_insert_own" on public.likes
  for insert
  to authenticated
  with check ( (select auth.uid()) = liker_id );

revoke all on public.likes from anon, authenticated;
grant select, insert on public.likes to authenticated;
