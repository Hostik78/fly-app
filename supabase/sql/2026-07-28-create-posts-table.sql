-- supabase/sql/2026-07-28-create-posts-table.sql
-- Своя публикация человека ("Что вы ищете сейчас?"), одна запись на пользователя.
-- Применена вручную через Supabase Dashboard -> SQL Editor, когда CLI ещё не был подключён -
-- оставлено здесь как исторический документ реального состояния на момент применения.
-- Начиная с supabase/migrations/20260728150755_..., схема меняется через CLI
-- (`supabase migration new` + `supabase db push`), новые SQL-файлы сюда не добавляются.
--
-- Права ниже (grant) с тех пор были дополнительно ужесточены той же CLI-миграцией
-- (see supabase/migrations/20260728150755_fix_profiles_nullable_and_tighten_grants.sql) -
-- у Supabase по умолчанию anon/authenticated получают куда более широкие права на новую
-- таблицу (включая truncate, которую не прикрывает RLS), чем указано ниже.

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
