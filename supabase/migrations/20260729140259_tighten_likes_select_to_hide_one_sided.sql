-- Прошлая политика (likes_select_own_or_received) давала видеть ЛЮБОЙ лайк,
-- поставленный тебе - в том числе ещё до того, как ты лайкнул(а) в ответ. Через
-- интерфейс приложения это не используется (useMatches и так пересекает "кого
-- лайкнул я" с "кто лайкнул меня" на стороне кода), но через прямой запрос к базе
-- можно было бы заранее подсмотреть, кто тебя лайкнул - это противоречит самой
-- механике "совпадение видно только когда оно уже взаимное".
--
-- Своих исходящих лайков это не касается - их всегда видно (иначе не получится
-- понять, кого уже лайкнул(а), чтобы не лайкнуть повторно). Входящий лайк виден,
-- только если уже есть и обратный (то есть это уже совпадение).

drop policy "likes_select_own_or_received" on public.likes;

create policy "likes_select_own_or_mutual" on public.likes
  for select
  to authenticated
  using (
    (select auth.uid()) = liker_id
    or (
      (select auth.uid()) = liked_id
      and exists (
        select 1 from public.likes as reverse
        where reverse.liker_id = (select auth.uid())
        and reverse.liked_id = likes.liker_id
      )
    )
  );
