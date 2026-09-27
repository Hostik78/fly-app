-- Добавочная часть перехода: старый бакет здесь НЕ закрывается. Новая выдача
-- заблокирована до отдельной проверенной активации (см. docs/photo-privacy-plan.md).
create schema if not exists private;
create table private.photo_rollout (singleton boolean primary key default true check(singleton), ready boolean not null default false);
insert into private.photo_rollout values (true,false);
create table private.profile_photos (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  object_path text unique,
  visibility text not null default 'private' check(visibility in ('private','visible')),
  deleting boolean not null default false
);
create table private.photo_grants (
  owner_id uuid references auth.users(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete cascade,
  active boolean not null default true,
  primary key(owner_id,viewer_id), check(owner_id<>viewer_id)
);
alter table private.photo_rollout enable row level security;
alter table private.profile_photos enable row level security;
alter table private.photo_grants enable row level security;
revoke all on private.photo_rollout, private.profile_photos, private.photo_grants from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',false,1048576,array['image/jpeg']);
-- Даже чужая широкая разрешающая политика не должна открыть новый бакет:
-- restrictive складывается с разрешающими правилами через AND, а не OR.
create policy photos_server_only on storage.objects as restrictive for all
  to anon, authenticated using(bucket_id <> 'profile-photos') with check(bucket_id <> 'profile-photos');

-- Проверяем существование сессии, а не только ещё не истёкшую подпись JWT.
create function private.photo_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from auth.sessions s where s.user_id=actor
      and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now())
  ) then raise exception 'active session required' using errcode='28000'; end if;
  return actor;
end $$;
create function private.photo_ready() returns void language plpgsql security definer set search_path='' as $$
begin
  if not (select ready from private.photo_rollout where singleton) then
    raise exception 'photo rollout incomplete' using errcode='55000';
  end if;
end $$;
create function private.photo_blocked(a uuid,b uuid) returns boolean language sql security definer set search_path='' stable as $$
  select exists(select 1 from public.blocked_users where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create function private.photo_path(owner uuid) returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor(); result text;
begin
  perform private.photo_ready();
  select p.object_path into result from private.profile_photos p
  where p.owner_id=owner and not p.deleting and (actor=owner or (
    not private.photo_blocked(actor,owner) and (
      exists(select 1 from private.photo_grants g where g.owner_id=owner and g.viewer_id=actor and g.active)
      or (p.visibility='visible' and exists(select 1 from public.posts where user_id=owner)
        and not exists(select 1 from public.hidden_profiles where hider_id=actor and hidden_id=owner))
    )
  ));
  return result;
end $$;
create function private.photo_settings() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor(); result jsonb;
begin
  perform private.photo_ready();
  select jsonb_build_object('visibility',coalesce((select visibility from private.profile_photos where owner_id=actor),'private'),
    'grants',coalesce((select jsonb_agg(viewer_id order by viewer_id) from private.photo_grants where owner_id=actor),'[]'::jsonb)) into result;
  return result;
end $$;
create function private.photo_set_visibility(mode text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor();
begin
  perform private.photo_ready();
  if mode is null or mode not in ('private','visible') then raise exception 'invalid visibility'; end if;
  insert into private.profile_photos(owner_id,visibility) values(actor,mode)
    on conflict(owner_id) do update set visibility=excluded.visibility where not profile_photos.deleting;
end $$;
create function private.photo_set_grant(viewer uuid, allowed boolean) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor();
begin
  perform private.photo_ready();
  -- Пара блокировки и выдача разрешения используют один замок, поэтому
  -- параллельный запрос не может воскресить разрешение после блокировки.
  perform pg_advisory_xact_lock(hashtextextended(least(actor,viewer)::text||greatest(actor,viewer)::text,0));
  if not allowed then delete from private.photo_grants where owner_id=actor and viewer_id=viewer; return; end if;
  if allowed is null or viewer is null or actor=viewer or private.photo_blocked(actor,viewer)
    or exists(select 1 from private.profile_photos where owner_id=actor and deleting)
    or not exists(select 1 from public.likes where liker_id=actor and liked_id=viewer)
    or not exists(select 1 from public.likes where liker_id=viewer and liked_id=actor)
    then raise exception 'recipient unavailable' using errcode='42501'; end if;
  -- Явная кнопка доступна собеседникам. Само совпадение доступ НЕ выдаёт.
  insert into private.photo_grants(owner_id,viewer_id) values(actor,viewer)
    on conflict(owner_id,viewer_id) do update set active=true;
end $$;
-- Незавершённая загрузка удерживает удаление аккаунта. Не снимаем защиту
-- просто по таймеру: оборвавшийся HTTP-запрос ещё мог дойти до Storage.
create table private.photo_uploads (
  path text primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table private.photo_uploads enable row level security;
revoke all on private.photo_uploads from public,anon,authenticated;
create function private.photo_upload_start() returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor(); path text := actor::text||'/'||gen_random_uuid()::text||'.jpg';
begin
  perform private.photo_ready();
  insert into private.profile_photos(owner_id) values(actor) on conflict do nothing;
  perform 1 from private.profile_photos where owner_id=actor and not deleting for update;
  if not found then raise exception 'account deletion in progress'; end if;
  if (select count(*) from private.photo_uploads where owner_id=actor)>=3 then raise exception 'uploads pending'; end if;
  insert into private.photo_uploads(path,owner_id) values(path,actor);
  return path;
end $$;
-- Только доверенный сервер знает, что операция Storage действительно
-- завершилась. Клиент не может снять защиту раньше окончания загрузки.
create function private.photo_upload_finish(path text) returns void language sql security definer set search_path='' as $$
  delete from private.photo_uploads u where u.path=photo_upload_finish.path;
$$;
create function private.photo_commit(path text) returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor(); previous text;
begin
  perform private.photo_ready();
  if not exists(select 1 from private.photo_uploads u where u.path=photo_commit.path and u.owner_id=actor) then raise exception 'upload reservation required'; end if;
  if path is null or path !~ ('^'||actor::text||'/[0-9a-f-]{36}\.jpg$')
    or not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=path)
    then raise exception 'invalid photo path' using errcode='42501'; end if;
  insert into private.profile_photos(owner_id) values(actor) on conflict do nothing;
  select object_path into previous from private.profile_photos where owner_id=actor and not deleting for update;
  if not found then raise exception 'account deletion in progress'; end if;
  update private.profile_photos set object_path=path where owner_id=actor;
  return previous;
end $$;
-- Удаление аккаунта закрывает выдачу и публикацию новых фото ДО очистки Storage.
-- Флаг сохраняется при ошибке очистки; повторный запрос удаления разрешён.
create function private.photo_begin_delete() returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor();
begin
  insert into private.profile_photos(owner_id,deleting) values(actor,true)
    on conflict(owner_id) do update set deleting=true;
  delete from private.photo_grants where owner_id=actor or viewer_id=actor;
  return not exists(select 1 from private.photo_uploads where owner_id=actor);
end $$;
create function private.photo_on_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(least(new.blocker_id,new.blocked_id)::text||greatest(new.blocker_id,new.blocked_id)::text,0));
  -- Сохраняем намерение владельца в его списке, но закрываем реальный доступ.
  -- Иначе исчезновение разрешения выдало бы даже краткую чужую блокировку
  -- после последующей разблокировки. Флаг active никогда не возвращается RPC.
  update private.photo_grants set active=false where (owner_id=new.blocker_id and viewer_id=new.blocked_id)
    or (owner_id=new.blocked_id and viewer_id=new.blocker_id);
  return new;
end $$;
create trigger photo_revoke_on_block before insert on public.blocked_users for each row execute function private.photo_on_block();

-- Узкий публичный интерфейс; повышенные права только у закрытых реализаций.
create function public.photo_upload_start() returns text language sql security invoker set search_path='' as $$ select private.photo_upload_start() $$;
create function public.photo_upload_finish(path text) returns void language sql security invoker set search_path='' as $$ select private.photo_upload_finish(path) $$;
revoke all on function public.photo_upload_finish(text), private.photo_upload_finish(text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function public.photo_upload_finish(text), private.photo_upload_finish(text) to service_role;
create function public.photo_path(owner uuid) returns text language sql security invoker set search_path='' as $$ select private.photo_path(owner) $$;
create function public.photo_settings() returns jsonb language sql security invoker set search_path='' as $$ select private.photo_settings() $$;
create function public.photo_set_visibility(mode text) returns void language sql security invoker set search_path='' as $$ select private.photo_set_visibility(mode) $$;
create function public.photo_set_grant(viewer uuid, allowed boolean) returns void language sql security invoker set search_path='' as $$ select private.photo_set_grant(viewer,allowed) $$;
create function public.photo_commit(path text) returns text language sql security invoker set search_path='' as $$ select private.photo_commit(path) $$;
create function public.photo_begin_delete() returns boolean language sql security invoker set search_path='' as $$ select private.photo_begin_delete() $$;
-- Перечень точный: не меняем права других ранее созданных функций private.
do $$ declare signature text; begin
  foreach signature in array array['photo_actor()','photo_ready()','photo_blocked(uuid,uuid)','photo_on_block()'] loop
    execute 'revoke all on function private.'||signature||' from public,anon,authenticated';
  end loop;
  foreach signature in array array['photo_upload_start()','photo_path(uuid)','photo_settings()','photo_set_visibility(text)','photo_set_grant(uuid,boolean)','photo_commit(text)','photo_begin_delete()'] loop
    execute 'revoke all on function private.'||signature||' from public,anon,authenticated';
    execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
    execute 'grant execute on function private.'||signature||' to authenticated';
    execute 'grant execute on function public.'||signature||' to authenticated';
  end loop;
end $$;
grant usage on schema private to authenticated;

-- Сигнатура сохранена для старых клиентов, но живые поля больше не возвращаются.
create or replace function public.get_blocked_profiles()
returns table(user_id uuid,gender text,age integer,height integer,languages text,category text,hobby text,quote text)
language sql security definer set search_path='' stable as $$
  select b.blocked_id,null::text,null::integer,null::integer,null::text,'communication'::text,null::text,''::text
  from public.blocked_users b where b.blocker_id=(select auth.uid()) order by b.created_at desc;
$$;
revoke all on function public.get_blocked_profiles() from public,anon;
grant execute on function public.get_blocked_profiles() to authenticated;

-- Служебный перенос старых фото. Функция недоступна пользователям и выключена
-- навсегда после активации. Повторный запуск возвращает уже сохранённый путь.
create function private.photo_import(owner uuid, path text) returns text language plpgsql security definer set search_path='' as $$
declare existing text;
begin
  if (select ready from private.photo_rollout) then raise exception 'migration already finished'; end if;
  if not exists(select 1 from storage.buckets where id='avatars' and not public)
    or not exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars_retired')
    then raise exception 'legacy writes must be frozen'; end if;
  if owner is null or path is null or path !~ ('^'||owner::text||'/[0-9a-f-]{36}\.jpg$')
    or not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=path)
    then raise exception 'invalid migration object'; end if;
  insert into private.profile_photos(owner_id,object_path) values(owner,path) on conflict(owner_id) do nothing;
  select object_path into existing from private.profile_photos where owner_id=owner;
  if existing is null then raise exception 'migration metadata conflict'; end if;
  return existing;
end $$;
create function public.photo_import(owner uuid,path text) returns text language sql security invoker set search_path='' as $$ select private.photo_import(owner,path) $$;
revoke all on function public.photo_import(uuid,text),private.photo_import(uuid,text) from public,anon,authenticated;
grant execute on function public.photo_import(uuid,text),private.photo_import(uuid,text) to service_role;
