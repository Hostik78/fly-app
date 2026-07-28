# Настоящая лента (четвёртый кусок бэкенда)

Дата: 2026-07-28
Статус: согласовано с пользователем, реализуется

## Зачем

Вход, своя публикация и своя анкета уже сохраняются по-настоящему (см. три
предыдущие спеки). Но лента по-прежнему показывает выдуманные тестовые
анкеты из `src/data/profiles.ts`, а не других вошедших людей. Это четвёртый
из четырёх запланированных кусков бэкенда: вход → своя публикация → своя
анкета → **настоящая лента (этот кусок)**. Лайки и совпадения на настоящих
данных — отдельный следующий шаг, здесь не делаются.

## Как это выглядит для человека

Лента показывает публикации всех остальных вошедших людей (не свою),
отсортированные от новых к старым. Если у человека не заполнены
возраст/рост/языки/пол (это необязательные поля) — карточка просто не
показывает соответствующую строчку/значок, без "не указано" или выдуманных
чисел. Если публикация младше часа — небольшой значок "New". Значка "Онлайн"
теперь нет вообще ни у кого — отслеживания, кто сейчас в сети, не делаем в
этом куске, и врать про статус не хотим.

Кнопка лайка на карточках временно не показывается совсем — она вернётся,
когда лайки станут настоящими (следующий шаг). Раз лента показывает уже
только настоящих людей, значит на практике сейчас кнопки лайка нигде не
будет видно, пока не сделаем следующий шаг — это ожидаемое временное
состояние, не баг.

Выдуманные тестовые анкеты (Алекс, Мария и т.д.) убираются из кода совсем.

## Технические детали

### Правила доступа в базе (RLS) — разрешить смотреть чужое

Сейчас `posts_select_own`/`profiles_select_own` разрешают видеть только
свою строку — для настоящей ленты нужно разрешить любому вошедшему видеть
чужие публикации/анкеты (менять/удалять чужое по-прежнему нельзя —
insert-политики не трогаем).

```sql
drop policy "posts_select_own" on public.posts;
create policy "posts_select_all_authenticated" on public.posts
  for select to authenticated using (true);

drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select_all_authenticated" on public.profiles
  for select to authenticated using (true);
```

Применяется через CLI (`supabase migration new` + `supabase db push`, как
уже настроено) — без ручного копирования в панель.

### `src/lib/pluralize.ts` — новый файл

Слово после числа ("год"/"года"/"лет") больше не хранится (у тестовых
анкет было отдельное поле `ageWord`, у настоящих людей такого поля в базе
нет и не будет) - вычисляется по стандартным правилам русского языка:

```typescript
export function getAgeWord(age: number): string {
  const lastTwo = age % 100
  const lastOne = age % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'лет'
  if (lastOne === 1) return 'год'
  if (lastOne >= 2 && lastOne <= 4) return 'года'
  return 'лет'
}
```

### `src/lib/useFeedProfiles.ts` — новый файл

Хук, который грузит настоящую ленту: публикации всех, кроме себя, плюс
анкеты этих же людей, склеенные в один список. Два отдельных запроса вместо
одного SQL-джойна — `posts` и `profiles` намеренно не связаны внешним ключом
друг на друга (см. `2026-07-28-profile-setup-design.md`, "Почему отдельная
таблица"), поэтому склеиваем на стороне кода по `user_id`.

```typescript
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'

const NEW_THRESHOLD_MS = 60 * 60 * 1000 // час

export function useFeedProfiles(currentUserId: string | undefined) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    async function load() {
      const { data: posts } = await supabase
        .from('posts')
        .select('user_id, quote, category, hobby, created_at')
        .neq('user_id', currentUserId)
        .order('created_at', { ascending: false })

      const userIds = (posts ?? []).map((post) => post.user_id)
      const { data: profileRows } =
        userIds.length > 0
          ? await supabase.from('profiles').select('user_id, gender, age, height, languages').in('user_id', userIds)
          : { data: [] }

      const infoByUserId = new Map((profileRows ?? []).map((row) => [row.user_id, row]))
      const now = Date.now()

      const merged: Profile[] = (posts ?? []).map((post) => {
        const info = infoByUserId.get(post.user_id)
        return {
          id: post.user_id,
          gender: (info?.gender ?? undefined) as Profile['gender'],
          category: post.category as ProfileCategory,
          hobby: (post.hobby ?? undefined) as HobbyId | undefined,
          online: false,
          isNew: now - new Date(post.created_at).getTime() < NEW_THRESHOLD_MS,
          quote: post.quote,
          age: info?.age ?? undefined,
          height: info?.height ?? undefined,
          languages: info?.languages ?? undefined,
        }
      })

      if (!cancelled) {
        setProfiles(merged)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  return { profiles, loading }
}
```

### `src/data/profiles.ts` — тип меняется, тестовые данные убираются

```typescript
export interface Profile {
  id: string // person's user_id - стабильный идентификатор, используется как React key
  gender?: 'male' | 'female'
  category: ProfileCategory
  hobby?: HobbyId
  online: boolean
  isNew?: boolean
  quote: string
  age?: number
  height?: number
  languages?: string
  interestedInYou?: boolean // пока не используется настоящими данными - задел под следующий шаг (лайки)
}
```

`ageWord` убирается (вычисляется через `getAgeWord`, не хранится). Массив
`profiles` (тестовые анкеты) удаляется целиком вместе со всеми записями.

### `ProfileCard.tsx` — необязательные поля и скрытая кнопка лайка

- Пол: если не указан - нейтральный серый градиент вместо цветного, буквенный
  значок (Ж/М) не показывается вообще.
- Строка "возраст · рост · языки": каждая часть рендерится отдельно, только
  если значение есть; если нет ни одного - строка не рендерится совсем.
  Возраст берёт слово через `getAgeWord(profile.age)` вместо `profile.ageWord`.
- Кнопка лайка: оборачивается в `{onLike && (...)}` - раз `FeedScreen` для
  настоящей ленты не передаёт `onLike`, кнопка просто не появляется. Пропс
  `onLike` в `ProfileCardProps` уже был необязательным - код самого компонента
  меняется минимально.

### `FeedScreen.tsx` — реальные данные вместо пропа с тестовыми

Проп `profiles?: Profile[]` убирается целиком (был нужен только для
тестовых данных, реальных случаев использования не было). Вместо этого:

```typescript
const { currentUserId } = useOutletContext<AppOutletContext>()
const { profiles, loading } = useFeedProfiles(currentUserId)
```

`onLike` из контекста в `FeedScreen` больше не достаётся и не передаётся в
`<ProfileCard>` вообще (сам `onLike` в `AppOutletContext`/`AppShellProps`
остаётся - `handleLike`/`matches` в `App.tsx` не трогаем, они понадобятся
в следующем шаге). Пока `loading` - простой текст-заглушка вместо списка
карточек.
Если после фильтров список пуст **и вообще ни у кого нет публикаций**
(`profiles.length === 0`, а не только `visibleProfiles`) - отдельное более
подходящее сообщение вместо стандартного "Пока никого нет в категории «Все»".

### `AppShell.tsx` / `App.tsx` — прокинуть `currentUserId`

`AppOutletContext` и `AppShellProps` получают новое поле `currentUserId:
string`. `App.tsx` передаёт `session.user.id` (в этой ветке рендера `session`
уже точно есть - иначе `AppShell` не рендерится вообще).

### `MessagesScreen.tsx` / `ChatScreen.tsx` — точечная правка типов

Эти экраны читают `match.age`/`match.ageWord`/`match.height`/`match.gender`
для списка совпадений и шапки переписки. Поля стали необязательными -
добавляются условные проверки (не рендерить кусок строки, если значения
нет) и `getAgeWord(match.age)` вместо `match.ageWord`. Практического эффекта
сейчас нет (`matches` всегда пустой, пока не сделаны настоящие лайки) - это
чисто ради типовой корректности, без визуального редизайна этих экранов.

## Обработка ошибок

Если запрос к базе не удался (нет сети) - `posts`/`profileRows` останутся
`undefined`/`null` из ответа Supabase, `?? []` уже подстраховывает от
падения - лента просто останется пустой без сообщения об ошибке. Красивое
сообщение об ошибке - можно добавить позже, если понадобится на практике
(YAGNI, тот же подход что и в предыдущих кусках).

## Проверка

Ручная: два разных аккаунта (два входа по почте с разных адресов) публикуют
заметки - каждый должен видеть в ленте заметку другого, но не свою.
Автотестов нет - фича целиком завязана на реальный поход в Supabase.

## Новые технические зависимости

Нет.
