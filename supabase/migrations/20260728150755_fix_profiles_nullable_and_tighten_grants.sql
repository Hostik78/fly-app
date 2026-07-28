-- Таблица profiles уже существовала в базе (создана раньше вручную через Dashboard,
-- до того как в этом проекте подключили CLI), с полями gender/age/height/languages как
-- NOT NULL. Приложение с этого момента считает их необязательными - убираем NOT NULL.
-- Check-ограничения на диапазон (см. миграцию создания таблицы) уже корректно работают
-- с NULL - в Postgres такое ограничение автоматически считается выполненным, если
-- значение не задано, и проверяется только когда оно всё-таки указано.
alter table public.profiles alter column gender drop not null;
alter table public.profiles alter column age drop not null;
alter table public.profiles alter column height drop not null;
alter table public.profiles alter column languages drop not null;

-- И profiles, и posts были созданы вручную (до CLI) со стандартными для Supabase
-- широкими правами по умолчанию: anon и authenticated получают ВСЕ права (select,
-- insert, update, delete, truncate, references, trigger) на новую таблицу в схеме public -
-- это платформенное поведение Supabase (ALTER DEFAULT PRIVILEGES настроен так на уровне
-- проекта), не ошибка конкретной миграции. RLS-политики (см. миграции создания таблиц)
-- закрывают select/insert по строкам, но НЕ закрывают TRUNCATE - у Postgres TRUNCATE
-- вообще не подчиняется Row Level Security. То есть anon (любой невошедший посетитель -
-- у него есть публичный anon-ключ) до этой миграции формально мог одной командой очистить
-- обе таблицы целиком. Приложение не даёт анонимному доступу вообще ничего (вход обязателен
-- для любого действия с базой), а вошедшим нужны только select и insert (ни редактирования,
-- ни удаления в приложении пока нет) - оставляем ровно это.
revoke all on public.profiles from anon, authenticated;
grant select, insert on public.profiles to authenticated;

revoke all on public.posts from anon, authenticated;
grant select, insert on public.posts to authenticated;
