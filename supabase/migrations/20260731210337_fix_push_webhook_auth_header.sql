-- Исправление предыдущей миграции (push_notification_webhook_trigger.sql):
-- Edge Function send-push написана через @supabase/server (withSupabase,
-- auth: 'secret') - это ожидает secret-ключ проекта именно в заголовке apikey,
-- а не Authorization: Bearer с произвольным значением, как было раньше. Секрет
-- по-прежнему читается из Vault, а не хранится в этом файле - имя записи в Vault
-- поменялось на edge_function_secret_key (там теперь настоящий secret-ключ
-- проекта, а не отдельно придуманный - см. LESSONS.md про то, зачем вообще Vault
-- здесь нужен).
create or replace function public.notify_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_key text;
begin
  select decrypted_secret into secret_key
  from vault.decrypted_secrets
  where name = 'edge_function_secret_key';

  perform net.http_post(
    url := 'https://ktwkddurlvslusdssjoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', secret_key
    ),
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    )
  );

  return NEW;
end;
$$;

-- Та же функция, тот же владелец - права (revoke от public/anon/authenticated
-- из прошлых миграций) не сбрасываются, но напоминание на будущее: create or
-- replace НЕ отменяет ранее выданные/отозванные grant-ы на функцию, только
-- меняет её тело.
