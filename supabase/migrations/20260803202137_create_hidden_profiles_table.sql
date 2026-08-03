-- "Скрыть анкету" - кнопка "⋯" на карточке в ленте была без действия (мёртвая
-- кнопка), теперь реально скрывает человека из твоей собственной ленты навсегда.
-- Структура повторяет уже проверенный паттерн из likes (пара id + запрет
-- скрыть самого себя) - только эта таблица приватная только для того, кто скрыл:
-- скрытый человек НЕ должен узнать, что его скрыли (в отличие от лайков, где
-- обе стороны видят взаимный лайк) - select-политика показывает только
-- строки, где я - тот, кто скрыл, не тот, кого скрыли.
create table public.hidden_profiles (
  hider_id uuid not null references auth.users (id) on delete cascade,
  hidden_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (hider_id, hidden_id),
  check (hider_id <> hidden_id)
);

alter table public.hidden_profiles enable row level security;

create policy "hidden_profiles_select_own" on public.hidden_profiles
  for select
  to authenticated
  using ( (select auth.uid()) = hider_id );

create policy "hidden_profiles_insert_own" on public.hidden_profiles
  for insert
  to authenticated
  with check ( (select auth.uid()) = hider_id );

revoke all on public.hidden_profiles from anon, authenticated;
grant select, insert on public.hidden_profiles to authenticated;
