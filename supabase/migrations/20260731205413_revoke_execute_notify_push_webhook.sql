-- db advisors сообщил: notify_push_webhook() выполнима и от anon, и от authenticated
-- напрямую (POST /rest/v1/rpc/notify_push_webhook) - та же история с дефолтными
-- правами Supabase, что и раньше (см. LESSONS.md). Она нужна ТОЛЬКО как триггер
-- (Postgres запускает её сам при INSERT в messages/likes) - её NEW/TG_TABLE_NAME
-- существуют только в контексте настоящего срабатывания триггера, поэтому прямой
-- вызов и так упал бы с ошибкой "trigger functions can only be called as triggers".
-- Но раз она никому не должна быть доступна напрямую - отзываем явно, а не полагаемся
-- на то, что вызов и так ни к чему не приведёт.
revoke execute on function public.notify_push_webhook() from anon, authenticated;
