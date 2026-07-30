-- Функция для экрана "Кто меня лайкнул": отдаёт ТОЛЬКО число (сколько человек
-- лайкнули меня, а я им ещё нет), но не сами записи с именами (liker_id).
--
-- Обычный запрос сюда не подходит: политика RLS "likes_select_own_or_mutual"
-- специально не даёт читать входящие лайки, пока они не взаимны (см. её же
-- комментарий в 20260729140259_tighten_likes_select_to_hide_one_sided.sql) -
-- если бы это правило разрешило строку целиком, приложение заодно получило бы
-- и liker_id, то есть личность того, кто лайкнул. Поэтому здесь отдельная
-- функция с security definer - она сама, в обход RLS, честно смотрит на все
-- строки, но наружу отдаёт только count(*), без единого поля из самих строк.
--
-- auth.uid() берётся изнутри функции, параметра "чей id" нет - значит вызвать
-- её и получить чужое число невозможно, только свой собственный счётчик.
create or replace function public.count_pending_likes()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.likes
  where liked_id = (select auth.uid())
    and not exists (
      select 1 from public.likes as reverse
      where reverse.liker_id = (select auth.uid())
        and reverse.liked_id = likes.liker_id
    );
$$;

-- Postgres по умолчанию даёт EXECUTE всем (включая анонимных) на новые функции -
-- убираем это и даём явно только вошедшим пользователям.
revoke all on function public.count_pending_likes() from public;
grant execute on function public.count_pending_likes() to authenticated;
