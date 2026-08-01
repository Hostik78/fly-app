-- pg_net - расширение Postgres, которое умеет делать обычные HTTP-запросы прямо
-- из базы (нужно, чтобы триггер ниже мог "достучаться" до Edge Function). На этом
-- проекте оно раньше не было включено (Database Webhooks им никогда не пользовались).
create extension if not exists pg_net schema extensions;

-- Триггер сообщает Edge Function send-push о новом сообщении/лайке - сама функция
-- решает, кому и какое уведомление отправить (см. supabase/functions/send-push/index.ts).
--
-- Специально НЕ через готовый supabase_functions.http_request(): у него заголовок
-- Authorization передаётся обычным текстовым аргументом - секрет пришлось бы вписать
-- прямо в этот файл, а он попадает в git. Вместо этого секрет лежит в Supabase Vault
-- (хранилище секретов внутри самой базы) - эта функция читает его оттуда заново при
-- каждом срабатывании, само значение никогда не появляется ни в одной миграции
-- (положено туда отдельной разовой командой не через миграцию - см. LESSONS.md,
-- если понадобится повторить на другом окружении).
--
-- security definer нужен по чуть другой причине, чем обычно в этом проекте (не
-- "обойти RLS ради удобства") - vault.decrypted_secrets в принципе не читается
-- обычной ролью authenticated (от чьего имени выполняется INSERT, вызвавший триггер),
-- и не должен - иначе любой пишущий в messages/likes мог бы прочитать чужой секрет.
create or replace function public.notify_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'edge_function_webhook_secret';

  perform net.http_post(
    url := 'https://ktwkddurlvslusdssjoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    )
  );

  return NEW;
end;
$$;

-- Только функцию можно выполнять роли postgres (это она и так может, владелец) -
-- никаких дополнительных grant не нужно, её вызывает не клиент напрямую, а сам
-- Postgres при срабатывании триггера.

create trigger notify_push_on_message
  after insert on public.messages
  for each row execute function public.notify_push_webhook();

create trigger notify_push_on_like
  after insert on public.likes
  for each row execute function public.notify_push_webhook();
