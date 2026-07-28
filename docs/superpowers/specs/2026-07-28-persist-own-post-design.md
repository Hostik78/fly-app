# Своя публикация сохраняется в базе (второй кусок бэкенда)

Дата: 2026-07-28
Статус: согласовано с пользователем, реализуется

## Зачем

Вход в аккаунт уже сохраняется по-настоящему (см.
`2026-07-27-google-auth-design.md`), но сама публикация — текст, категория и
хобби с экрана «Что вы ищете сейчас?» — по-прежнему живёт только в памяти
браузера (`hasPosted` в `App.tsx`). Стоит перезагрузить страницу — и как будто
публикации не было, хотя вход остался. Это второй из четырёх запланированных
кусков работы над бэкендом (вход → своя публикация → лента и лайки на
настоящих данных → переписка через базу).

Лента из чужих анкет в этот раз не трогаем — она остаётся тестовыми данными
из `src/data/profiles.ts`, как договорились. Редактирование уже
опубликованного текста тоже не делаем — публикация по-прежнему одноразовая,
как и сейчас.

## Как это выглядит для человека

Ничего не меняется внешне: тот же экран «Что вы ищете сейчас?», та же кнопка
«Опубликовать». Разница видна только при перезагрузке страницы или входе с
другого устройства — теперь приложение помнит, что публикация уже была, и
сразу пускает в ленту, а не показывает экран создания заново.

Если публикация не сохранилась (например, пропал интернет) — под кнопкой
появится короткое сообщение об ошибке, кнопка станет доступна для повторной
попытки.

## Технические детали

### Новая таблица в базе — `posts`

Одна запись на человека (колонка `user_id` уникальна — публикация одна, без
истории версий).

```sql
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  quote text not null check (char_length(trim(quote)) > 0),
  category text not null check (
    category in (
      'communication', 'romance', 'hobbies',
      'fellow-travelers', 'networking', 'friendship'
    )
  ),
  hobby text check (
    hobby in (
      'cycling', 'photography', 'movies', 'books',
      'music', 'sports', 'cooking', 'travel'
    )
  ),
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

-- Каждый видит только свою публикацию
create policy "posts_select_own" on public.posts
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Каждый может создать публикацию только от своего имени
create policy "posts_insert_own" on public.posts
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

grant select, insert on public.posts to authenticated;
```

`category`/`hobby` проверяются через `check`, со списком тех же значений, что
уже используются в коде (`ProfileCategory`, `HobbyId`) — так в базу не попадёт
опечатка или устаревшее значение, даже если кто-то отправит запрос напрямую,
в обход интерфейса. `on delete cascade` — если аккаунт когда-нибудь удалят,
его публикация удалится вместе с ним, а не останется висеть «ничьей».

Без `update`/`delete` политик — в этой версии редактирование и удаление не
нужны (YAGNI), можно будет добавить отдельным шагом, когда понадобится.

### `App.tsx` — проверка при входе и сохранение при публикации

Вместо `useState(false)` для `hasPosted` — запрос к базе один раз после того,
как известно, что человек вошёл:

```typescript
const [hasPosted, setHasPosted] = useState(false)
const [postLoading, setPostLoading] = useState(true)

useEffect(() => {
  if (!session) {
    setPostLoading(false)
    return
  }
  let cancelled = false
  setPostLoading(true)
  supabase
    .from('posts')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()
    .then(({ data }) => {
      if (!cancelled) {
        setHasPosted(!!data)
        setPostLoading(false)
      }
    })
  return () => {
    cancelled = true
  }
}, [session?.user.id])
```

Общий экран загрузки показывается, пока `sessionLoading || (session &&
postLoading)` — то же пустое белое полотно, что уже используется для проверки
входа, без нового UI.

`handlePublish` становится асинхронным и пишет в базу вместо простого
`setHasPosted(true)`:

```typescript
async function handlePublish(quote: string, category: ProfileCategory, hobby: HobbyId | null) {
  if (!session) return
  const { error } = await supabase
    .from('posts')
    .insert({ user_id: session.user.id, quote, category, hobby })
  if (error) throw error
  setHasPosted(true)
}
```

### `CreateStatusScreen.tsx` — состояние отправки и ошибка

`onSubmit` теперь может занять время (сетевой запрос) и может не удаться:

```typescript
const [submitting, setSubmitting] = useState(false)
const [error, setError] = useState<string | null>(null)

async function handleSubmit() {
  setSubmitting(true)
  setError(null)
  try {
    await onSubmit(quote.trim(), category, hobby)
  } catch {
    setError('Не получилось опубликовать. Проверьте интернет и попробуйте ещё раз.')
  } finally {
    setSubmitting(false)
  }
}
```

Кнопка: `disabled={!canSubmit || submitting}`, текст — «Публикуем…» пока
`submitting`. Под кнопкой — `error`, если есть, обычным текстом (без новой
дизайн-системы под это — переиспользуем существующий стиль мелкого серого
текста, как в остальном экране).

## Настройка в Supabase (сделать один раз, руками)

Командная строка Supabase не подключена к проекту, поэтому SQL применяется
через панель в браузере, не автоматически:

1. [supabase.com/dashboard](https://supabase.com/dashboard) → выбрать проект
   → **SQL Editor**.
2. Вставить SQL-запрос из раздела выше (он же будет сохранён в файл
   `supabase/sql/2026-07-28-create-posts-table.sql` в проекте — для истории).
3. Нажать **Run**.
4. Проверить **Table Editor** → должна появиться таблица `posts` с колонками
   из запроса.

Это разовое действие — дальше приложение работает с таблицей само, без
повторных ручных шагов.

## Обработка ошибок

- Не вошёл в аккаунт — `handlePublish` не вызывается вообще (экран
  публикации показывается только после входа).
- Не удалось сохранить (нет сети, база недоступна) — ошибка из Supabase
  прокидывается наверх (`throw error`), `CreateStatusScreen` ловит её и
  показывает короткое сообщение, форма остаётся заполненной, можно нажать
  «Опубликовать» ещё раз.
- Два запроса на публикацию подряд (двойной клик) — исключены `unique` на
  `user_id`: вторая попытка вернёт ошибку с сервера, а не создаст дубликат;
  на практике не должно происходить, так как кнопка блокируется на время
  `submitting`.

## Проверка

- Ручная проверка в браузере: опубликовать заметку → обновить страницу →
  убедиться, что снова открывается лента, а не экран создания.
- Ручная проверка правил доступа: попробовать (через два разных
  почтовых адреса/два входа) убедиться, что публикация одного человека не
  видна как «своя» другому — при появлении ленты из настоящих анкет (шаг 3
  из будущих) это станет важно, а SELECT-политика уже написана на этот
  случай.
- Автотестов нет — фича целиком завязана на реальный сетевой поход в
  Supabase, а не на чистую логику; аналогично предыдущему шагу с почтой.

## Новые технические зависимости

Нет — `@supabase/supabase-js` уже используется. Новых npm-пакетов и
переменных окружения не требуется.
