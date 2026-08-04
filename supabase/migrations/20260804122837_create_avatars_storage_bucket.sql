-- Хранилище файлов для настоящих фото профиля (Supabase Storage - готовое
-- файловое хранилище "из коробки", как и остальной бэкенд этого проекта).
-- Публичный (public = true) бакет - фото видно кому угодно вошедшему без
-- отдельного запроса подписи ссылки, как остальные поля анкеты (см.
-- profiles_select_all_authenticated в более ранней миграции) - это тот же
-- уровень открытости, что и у возраста/роста, не более чувствительный.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Путь к файлу всегда "<user_id>/avatar.jpg" (см. avatar.ts - один
-- предсказуемый путь на человека, повторная загрузка просто перезаписывает
-- старый файл, а не копит старые версии). Это же УДОБНО для RLS: проверяем,
-- что первая часть пути (storage.foldername возвращает путь БЕЗ имени файла)
-- совпадает с id вошедшего - тогда можно залить файл только в свою же папку,
-- не в чужую.
create policy "avatars_insert_own" on storage.objects
  for insert
  to authenticated
  with check ( bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text) );

create policy "avatars_update_own" on storage.objects
  for update
  to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text) );

create policy "avatars_delete_own" on storage.objects
  for delete
  to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text) );
