# Короткая анкета о себе (третий кусок бэкенда)

Дата: 2026-07-28
Статус: согласовано с пользователем, реализуется

## Зачем

Планируем следующий шаг — настоящую ленту (публикации других вошедших людей
вместо тестовых данных). Но карточка анкеты в ленте показывает возраст, рост,
языки и пол (`src/data/profiles.ts`, тип `Profile`), а при входе по почте и
публикации заметки (`2026-07-27-google-auth-design.md`,
`2026-07-28-persist-own-post-design.md`) эти данные вообще не спрашиваются —
у настоящих людей их просто нет. Этот кусок закрывает пробел: один раз
спрашиваем про себя и сохраняем, до того как переходить к настоящей ленте.

Это третий из четырёх запланированных кусков бэкенда: вход → своя публикация
→ **своя анкета (этот кусок)** → настоящая лента и лайки (дальше).

## Почему отдельная таблица, а не поля в `posts`

`quote`/`category`/`hobby` в `posts` по замыслу временные — в коде уже
написано «как объявление, а не постоянная анкета» (`CreateStatusScreen.tsx`).
Пол/возраст/рост/языки — наоборот, данные о человеке, которые не меняются от
заметки к заметке. Раз у них разный смысл и разное будущее (заметки могут
стать повторяемыми, анкета — нет), держим их в разных таблицах с самого
начала, а не смешиваем ради экономии одной таблицы сейчас.

## Как это выглядит для человека

Новый экран между входом и заметкой (только если анкеты ещё нет):

- Заголовок вроде «Расскажите о себе» (по аналогии с «Что вы ищете сейчас?»).
- Пол — две кнопки «Мужской» / «Женский» (тот же бинарный выбор, что уже
  используется в `Profile.gender` по всему приложению — этим кругом задач не
  меняем).
- Возраст — числовое поле.
- Рост (см) — числовое поле.
- Языки — текстовое поле, «через запятую» (как в тестовых анкетах,
  `Profile.languages`).
- Кнопка «Продолжить» — активна, только когда всё заполнено и в разумных
  границах (возраст 18–99, рост 120–230 см — совпадает с ограничениями,
  которые заведём в базе, см. ниже).

После этого экрана — как и раньше, экран заметки, потом само приложение.
Если анкета уже есть (например, вернулись на сайт) — экран анкеты просто не
показывается, как и с заметкой.

Если сохранить не получилось (нет сети) — под кнопкой короткое сообщение об
ошибке, форма не теряется, можно попробовать ещё раз. Тот же паттерн, что уже
есть в `CreateStatusScreen`.

## Технические детали

### Новая таблица `profiles`

Одна запись на человека, `user_id` — сам первичный ключ (не отдельный `id`,
как в `posts`): это связь строго один-к-одному с `auth.users`, в отличие от
`posts`, которые в будущем могут стать повторяемыми.

```sql
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gender text not null check (gender in ('male', 'female')),
  age integer not null check (age between 18 and 99),
  height integer not null check (height between 120 and 230),
  languages text not null check (char_length(trim(languages)) > 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "profiles_insert_own" on public.profiles
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

grant select, insert on public.profiles to authenticated;
```

Без `update`/`delete` политик — редактирование анкеты не входит в этот кусок
(YAGNI, как и с `posts`).

### `App.tsx` — ещё одна проверка перед заметкой

По той же схеме, что уже сделана для `hasPosted`/`postLoading`
(`2026-07-28-persist-own-post-design.md`): состояния `hasProfile` и
`profileLoading`, запрос `profiles.select('user_id').eq('user_id',
session.user.id).maybeSingle()` в `useEffect`, зависящем от
`session?.user.id`.

Экран анкеты рендерится **вне `HashRouter`**, тем же способом, что и
`LoginScreen` сейчас — последовательная проверка перед показом остального
приложения, а не отдельный маршрут:

```typescript
{overallLoading ? (
  <div className="h-full w-full bg-white" />
) : !session ? (
  <LoginScreen />
) : !hasProfile ? (
  <ProfileSetupScreen onSubmit={handleProfileSubmit} />
) : (
  <HashRouter>{/* без изменений */}</HashRouter>
)}
```

`overallLoading` расширяется третьим условием: `loading || (!!session &&
(profileLoading || (hasProfile && postLoading)))` — проверяем анкету и
заметку по очереди, а не двумя параллельными запросами, чтобы не было
короткого мигания экраном заметки, пока ещё не знаем, есть ли анкета
(`postLoading`-запрос стартует только после того, как известно, что анкета
уже есть).

Для этого существующий `useEffect`, который сейчас проверяет `posts` (из
`2026-07-28-persist-own-post-design.md`), меняет условие запуска — раньше он
зависел только от `session?.user.id`, теперь ждёт ещё и `hasProfile`:

```typescript
useEffect(() => {
  if (!session || !hasProfile) return
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
}, [session?.user.id, hasProfile])
```

Аналогичный эффект для `profiles` (новый):

```typescript
useEffect(() => {
  if (!session) {
    setProfileLoading(false)
    return
  }
  let cancelled = false
  setProfileLoading(true)
  supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle()
    .then(({ data }) => {
      if (!cancelled) {
        setHasProfile(!!data)
        setProfileLoading(false)
      }
    })
  return () => {
    cancelled = true
  }
}, [session?.user.id])
```

`handleProfileSubmit` — по образцу `handlePublish`:

```typescript
async function handleProfileSubmit(gender: 'male' | 'female', age: number, height: number, languages: string) {
  if (!session) return
  const { error } = await supabase
    .from('profiles')
    .insert({ user_id: session.user.id, gender, age, height, languages })
  if (error) throw error
  setHasProfile(true)
}
```

### Новый файл `src/components/ProfileSetupScreen.tsx`

Структура и стиль — по образцу `CreateStatusScreen.tsx` (то же
`submitting`/`error`-состояние, тот же визуальный язык: `bg-[#F4F5F8]`
инпуты, кнопка `bg-fly-coral`). Локальная валидация зеркалит ограничения
базы (возраст 18–99, рост 120–230, языки не пустые, пол выбран) — так кнопка
неактивна ещё до похода в сеть, а не только после ответа с ошибкой.

```typescript
interface ProfileSetupScreenProps {
  onSubmit: (gender: 'male' | 'female', age: number, height: number, languages: string) => Promise<void>
}
```

## Настройка в Supabase (сделать один раз, руками)

Как и с `posts` (`2026-07-28-create-posts-table.sql`): SQL-запрос сохраняется
в `supabase/sql/2026-07-28-create-profiles-table.sql`, применяется вручную
через **SQL Editor** в панели Supabase — CLI по-прежнему не подключён.

## Обработка ошибок

Полностью зеркалит `CreateStatusScreen`/`handlePublish`
(`2026-07-28-persist-own-post-design.md`): не вошёл — экран не показывается;
не сохранилось — ошибка ловится в `ProfileSetupScreen`, форма не теряется;
повторная отправка исключена блокировкой кнопки на время `submitting` и
`user_id primary key` в базе (вторая попытка вставки — ошибка, не дубликат).

## Проверка

Ручная, как и с публикацией: заполнить анкету → перейти к заметке →
опубликовать → обновить страницу → должно сразу открыться в ленту, минуя оба
экрана (анкету и заметку). Автотестов нет — та же причина, что и раньше:
фича целиком завязана на реальный поход в Supabase.

## Новые технические зависимости

Нет — тот же `@supabase/supabase-js`, что уже используется.
