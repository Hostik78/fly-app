-- Только в согласованное окно перехода, после проверки нового клиента/API.
-- Не часть автоматического db push: старые клиенты перестанут загружать фото.
begin;
update storage.buckets set public=false where id='avatars';
create policy avatars_retired on storage.objects as restrictive for all
  to anon,authenticated using(bucket_id<>'avatars') with check(bucket_id<>'avatars');
commit;
