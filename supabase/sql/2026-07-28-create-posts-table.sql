-- supabase/sql/2026-07-28-create-posts-table.sql
-- Своя публикация человека ("Что вы ищете сейчас?"), одна запись на пользователя.
-- Применяется вручную через Supabase Dashboard -> SQL Editor (нет подключённого CLI).

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  quote text not null check (char_length(trim(quote)) > 0),
  category text not null check (
    category in (
      'communication', 'romance', 'hobbies',
      'fellow-travelers', 'networking', 'friendship'
    )
  ),
  hobby text check (
    hobby in (
      'cycling', 'photography', 'movies', 'books',
      'music', 'sports', 'cooking', 'travel'
    )
  ),
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

-- Каждый видит только свою публикацию
create policy "posts_select_own" on public.posts
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Каждый может создать публикацию только от своего имени
create policy "posts_insert_own" on public.posts
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

grant select, insert on public.posts to authenticated;
