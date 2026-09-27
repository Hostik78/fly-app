-- Запускать ТОЛЬКО после выполнения всех пунктов docs/photo-privacy-rollout.md.
-- SQL не умеет проверить CDN и отключить уже открытые публичные WebSocket.
-- Эти две внешние проверки обязательны до запуска этого файла.
begin;
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='avatars') then raise exception 'legacy objects remain'; end if;
  if not exists(select 1 from storage.buckets where id='avatars' and not public) then raise exception 'legacy bucket still public'; end if;
  if not exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars_retired' and permissive='RESTRICTIVE') then raise exception 'legacy writes are not frozen'; end if;
  if exists(select 1 from private.profile_photos p where p.object_path is not null and not exists(select 1 from storage.objects o where o.bucket_id='profile-photos' and o.name=p.object_path)) then raise exception 'migrated object missing'; end if;
  if not exists(select 1 from storage.buckets where id='profile-photos' and not public) then raise exception 'new private bucket missing'; end if;
  update private.photo_rollout set ready=true where singleton;
end $$;
commit;
