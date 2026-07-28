-- supabase/sql/2026-07-28-create-profiles-table.sql
-- Анкета о себе (пол/возраст/рост/языки), одна запись на пользователя, заполняется один раз.
-- Применяется вручную через Supabase Dashboard -> SQL Editor (нет подключённого CLI).

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gender text not null check (gender in ('male', 'female')),
  age integer not null check (age between 18 and 99),
  height integer not null check (height between 120 and 230),
  languages text not null check (char_length(trim(languages)) > 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Каждый видит только свою анкету
create policy "profiles_select_own" on public.profiles
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Каждый может создать анкету только от своего имени
create policy "profiles_insert_own" on public.profiles
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

grant select, insert on public.profiles to authenticated;
