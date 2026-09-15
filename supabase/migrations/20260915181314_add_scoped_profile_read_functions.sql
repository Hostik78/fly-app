-- Подготавливаем безопасный переход от прямого чтения public.profiles/public.posts
-- к готовым наборам данных. На этом шаге старые SELECT-политики ещё не удаляем:
-- сначала новые функции должны попасть в production, затем сайт переключится на них,
-- и только отдельная следующая миграция закроет широкое чтение. Благодаря этому
-- открытая у пользователя старая версия приложения не ломается посреди выкладки.

create or replace function public.get_feed_profiles()
returns table (
  user_id uuid,
  gender text,
  age integer,
  height integer,
  languages text,
  category text,
  hobby text,
  quote text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.user_id,
    profile.gender,
    profile.age,
    profile.height,
    profile.languages,
    p.category,
    p.hobby,
    p.quote,
    p.created_at
  from public.posts p
  join public.profiles profile on profile.user_id = p.user_id
  where (select auth.uid()) is not null
    and p.user_id <> (select auth.uid())
    and not exists (
      select 1
      from public.hidden_profiles h
      where h.hider_id = (select auth.uid())
        and h.hidden_id = p.user_id
    )
    and not exists (
      select 1
      from public.blocked_users b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_id = (select auth.uid()))
    )
  order by p.created_at desc
  limit 50;
$$;

revoke all on function public.get_feed_profiles() from public;
grant execute on function public.get_feed_profiles() to authenticated;
revoke execute on function public.get_feed_profiles() from anon;

create or replace function public.get_match_profiles()
returns table (
  user_id uuid,
  gender text,
  age integer,
  height integer,
  languages text,
  last_seen_at timestamptz,
  category text,
  hobby text,
  quote text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    profile.user_id,
    profile.gender,
    profile.age,
    profile.height,
    profile.languages,
    profile.last_seen_at,
    p.category,
    p.hobby,
    p.quote,
    p.created_at
  from public.likes own_like
  join public.profiles profile on profile.user_id = own_like.liked_id
  join public.posts p on p.user_id = own_like.liked_id
  where (select auth.uid()) is not null
    and own_like.liker_id = (select auth.uid())
    and exists (
      select 1
      from public.likes reverse_like
      where reverse_like.liker_id = own_like.liked_id
        and reverse_like.liked_id = (select auth.uid())
    )
    and not exists (
      select 1
      from public.blocked_users b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = own_like.liked_id)
         or (b.blocker_id = own_like.liked_id and b.blocked_id = (select auth.uid()))
    )
  order by p.created_at desc;
$$;

revoke all on function public.get_match_profiles() from public;
grant execute on function public.get_match_profiles() to authenticated;
revoke execute on function public.get_match_profiles() from anon;

create or replace function public.get_blocked_profiles()
returns table (
  user_id uuid,
  gender text,
  age integer,
  height integer,
  languages text,
  category text,
  hobby text,
  quote text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    profile.user_id,
    profile.gender,
    profile.age,
    profile.height,
    profile.languages,
    coalesce(p.category, 'communication'),
    p.hobby,
    coalesce(p.quote, '')
  from public.blocked_users b
  join public.profiles profile on profile.user_id = b.blocked_id
  left join public.posts p on p.user_id = b.blocked_id
  where (select auth.uid()) is not null
    and b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$$;

revoke all on function public.get_blocked_profiles() from public;
grant execute on function public.get_blocked_profiles() to authenticated;
revoke execute on function public.get_blocked_profiles() from anon;
