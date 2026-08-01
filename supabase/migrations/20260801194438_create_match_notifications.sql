-- Защита от задвоенного уведомления о совпадении - найдено проверкой кода.
--
-- Проблема: когда лайк становится взаимным, срабатывают ДВА отдельных вызова
-- Edge Function send-push (по одному на каждую строку likes - свою и уже
-- существующую обратную), и КАЖДЫЙ из них независимо проверяет "это уже
-- взаимно?" и, увидев "да", шлёт уведомление обоим. Если оба вызова случайно
-- обработаются с достаточно близкой задержкой (pg_net шлёт HTTP уже после
-- коммита транзакции, не внутри неё - это фоновый, не мгновенный процесс),
-- оба решат "матч ещё не объявлен" и отправят по push каждому дважды.
--
-- Решение - "кто первый застолбил, тот и шлёт": Edge Function перед отправкой
-- пытается вставить сюда одну строку на пару людей (порядок id всегда
-- отсортирован, поэтому строка одна и та же для A→B и для B→A). У кого вставка
-- прошла - тот единственный, кто реально отправляет уведомления. У кого не
-- прошла (уникальность уже занята) - тот молча ничего не шлёт, зная, что другой
-- вызов уже (или вот-вот) это сделает.
create table public.match_notifications (
  user_id_a uuid not null references auth.users (id) on delete cascade,
  user_id_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)
);

alter table public.match_notifications enable row level security;

-- Не для клиентов вообще - только для Edge Function через ctx.supabaseAdmin
-- (secret-ключ, в обход RLS). Обычным пользователям сюда доступ не нужен
-- никогда, поэтому не выдаём ничего ни anon, ни authenticated.
revoke all on public.match_notifications from anon, authenticated;
