-- supabase/sql/2026-07-28-create-profiles-table.sql
-- Анкета о себе (пол/возраст/рост/языки), одна запись на пользователя, заполняется один раз.
-- Применяется вручную через Supabase Dashboard -> SQL Editor (нет подключённого CLI).
--
-- Все поля, кроме user_id, необязательные (без "not null") - человек может нажать
-- "Продолжить", ничего не заполнив. Проверки диапазона (check) при этом не мешают:
-- в Postgres check-ограничение автоматически считается выполненным, если значение NULL,
-- и срабатывает только когда значение всё-таки указано.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gender text check (gender in ('male', 'female')),
  age integer check (age between 18 and 99),
  height integer check (height between 120 and 230),
  languages text check (char_length(trim(languages)) > 0),
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
