# Hobby Sub-Categories and Chat Icebreakers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single "Увлечения" (Hobbies) category into a structured set of specific hobbies, let people filter the feed and pick their own hobby by it, and show static conversation-starter suggestions in chat for hobby matches.

**Architecture:** Two small new pure-data modules (`hobbies.ts`, `icebreakers.ts`) that the existing feed, status-creation, and chat screens read from. No network calls, no new dependencies — this is data plus conditional rendering on top of the existing mock-data architecture.

**Tech Stack:** React 19 + TypeScript (existing), Vitest (already set up from the previous feature).

## Global Constraints

- Никаких сетевых вызовов и никакой генерации нейросетью в этой фиче — только заготовленные данные (решено при обсуждении дизайна).
- Никаких новых npm-зависимостей и переменных окружения.
- Комментарии в коде — подробные, на русском языке.
- Стиль кода и Tailwind-классы соответствуют уже существующим паттернам в `FeedScreen.tsx`, `CreateStatusScreen.tsx`, `ChatScreen.tsx` (токены `fly-*`, `rounded-fly-md`, и т.д.).

---

### Task 1: `src/data/hobbies.ts` — список хобби

**Files:**
- Create: `src/data/hobbies.ts`

**Interfaces:**
- Produces: `export type HobbyId = 'cycling' | 'photography' | 'movies' | 'books' | 'music' | 'sports' | 'cooking' | 'travel'`; `export interface HobbyOption { id: HobbyId; label: string }`; `export const hobbies: HobbyOption[]`.

- [ ] **Step 1: Write the file**

```typescript
// Список конкретных хобби для категории анкеты "Увлечения". Живёт отдельно от
// profiles.ts, потому что это данные про сами хобби, а не про анкету -
// используется и в ленте (второй ряд фильтров), и на экране создания заметки,
// и в подсказках для начала разговора.

export type HobbyId =
  | 'cycling'
  | 'photography'
  | 'movies'
  | 'books'
  | 'music'
  | 'sports'
  | 'cooking'
  | 'travel'

export interface HobbyOption {
  id: HobbyId
  label: string
}

export const hobbies: HobbyOption[] = [
  { id: 'cycling', label: 'Велосипед' },
  { id: 'photography', label: 'Фотография' },
  { id: 'movies', label: 'Кино' },
  { id: 'books', label: 'Книги' },
  { id: 'music', label: 'Музыка' },
  { id: 'sports', label: 'Спорт' },
  { id: 'cooking', label: 'Кулинария' },
  { id: 'travel', label: 'Путешествия' },
]
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/data/hobbies.ts
git commit -m "$(cat <<'EOF'
Add list of specific hobbies for the Hobbies category

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `hobby` field to `Profile`

**Files:**
- Modify: `src/data/profiles.ts`

**Interfaces:**
- Consumes: `HobbyId` from `src/data/hobbies.ts` (Task 1).
- Produces: `Profile.hobby?: HobbyId` — read by Tasks 4-6.

- [ ] **Step 1: Import `HobbyId` and add the field to `Profile`**

In `src/data/profiles.ts`, add near the top (after the existing `ProfileCategory` export, before `Profile`):

```typescript
import type { HobbyId } from './hobbies'
```

Then find this block:

```typescript
export interface Profile {
  gender: 'male' | 'female' // пол анкеты — влияет на цвет карточки и букву на значке
  category: ProfileCategory // к какому фильтру относится анкета
  online: boolean // человек сейчас в сети (показываем зелёный значок "Онлайн")
```

Replace it with:

```typescript
export interface Profile {
  gender: 'male' | 'female' // пол анкеты — влияет на цвет карточки и букву на значке
  category: ProfileCategory // к какому фильтру относится анкета
  hobby?: HobbyId // конкретное хобби — заполнено только когда category === 'hobbies'
  online: boolean // человек сейчас в сети (показываем зелёный значок "Онлайн")
```

- [ ] **Step 2: Set `hobby` on the two existing `hobbies`-category profiles**

Find this profile (the one about a bicycle):

```typescript
  {
    gender: 'female',
    category: 'hobbies',
    online: true,
    isNew: true,
    quote: 'Везу велосипед в багаже на соревнования. Кто ещё катается — шоссе или горы?',
```

Replace with:

```typescript
  {
    gender: 'female',
    category: 'hobbies',
    hobby: 'cycling',
    online: true,
    isNew: true,
    quote: 'Везу велосипед в багаже на соревнования. Кто ещё катается — шоссе или горы?',
```

Find this profile (the one about a movie):

```typescript
  {
    gender: 'male',
    category: 'hobbies',
    online: false,
    quote: 'Ищу компанию посмотреть новый фильм в аэропортовском кинозале, пока ждём посадку.',
```

Replace with:

```typescript
  {
    gender: 'male',
    category: 'hobbies',
    hobby: 'movies',
    online: false,
    quote: 'Ищу компанию посмотреть новый фильм в аэропортовском кинозале, пока ждём посадку.',
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/data/profiles.ts
git commit -m "$(cat <<'EOF'
Add hobby field to Profile and set it on mock hobbies-category profiles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `src/data/icebreakers.ts` — вопросы для начала разговора + тест

**Files:**
- Create: `src/data/icebreakers.ts`
- Create: `src/data/icebreakers.test.ts`

**Interfaces:**
- Consumes: `HobbyId`, `hobbies` from `src/data/hobbies.ts` (Task 1).
- Produces: `export function getIcebreakers(hobby: HobbyId): string[]` — returns exactly 2 non-empty strings, read by Task 6.

- [ ] **Step 1: Write the failing test**

```typescript
// src/data/icebreakers.test.ts
import { describe, expect, it } from 'vitest'
import { getIcebreakers } from './icebreakers'
import { hobbies } from './hobbies'

describe('getIcebreakers', () => {
  it('returns two non-empty questions for every hobby', () => {
    for (const { id } of hobbies) {
      const questions = getIcebreakers(id)
      expect(questions).toHaveLength(2)
      for (const question of questions) {
        expect(question.length).toBeGreaterThan(0)
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/icebreakers.test.ts`
Expected: FAIL — `Cannot find module './icebreakers'`

- [ ] **Step 3: Write the icebreaker questions**

```typescript
// src/data/icebreakers.ts
// Готовые вопросы для начала разговора, привязанные к конкретному хобби
// (не к погоде или времени, поэтому без сети и без ИИ — просто заготовленный
// набор). Используются в ChatScreen, пока человек ещё не написал первое
// сообщение сам.

import type { HobbyId } from './hobbies'

const icebreakers: Record<HobbyId, string[]> = {
  cycling: ['Шоссейный или горный?', 'На сколько километров у вас обычно вылазки?'],
  photography: ['На телефон снимаете или на камеру?', 'Что чаще всего в кадре — люди или пейзажи?'],
  movies: ['Какой жанр сейчас смотрите чаще всего?', 'Есть фильм, который можете пересматривать бесконечно?'],
  books: ['Читаете бумажные книги или электронные?', 'Что сейчас читаете?'],
  music: ['На концерты часто ходите?', 'Какая музыка звучит у вас чаще всего?'],
  sports: ['Каким видом спорта занимаетесь?', 'Тренируетесь один или в компании?'],
  cooking: ['Какая кухня получается лучше всего?', 'Готовите по рецептам или на глаз?'],
  travel: ['Куда сейчас летите?', 'Уже придумали, куда полетите в следующий раз?'],
}

export function getIcebreakers(hobby: HobbyId): string[] {
  return icebreakers[hobby]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/icebreakers.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/data/icebreakers.ts src/data/icebreakers.test.ts
git commit -m "$(cat <<'EOF'
Add static conversation-starter questions per hobby, with test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Second row of hobby filters in `FeedScreen.tsx`

**Files:**
- Modify: `src/components/FeedScreen.tsx`

**Interfaces:**
- Consumes: `hobbies`, `HobbyId` from `src/data/hobbies.ts` (Task 1); `Profile.hobby` from Task 2.

- [ ] **Step 1: Add the import and the second filter list**

Find this line:

```typescript
import { categories } from '../data/categories'
```

Replace with:

```typescript
import { categories } from '../data/categories'
import { hobbies, type HobbyId } from '../data/hobbies'
```

Find this block:

```typescript
// Полный список фильтров-таблеток над лентой: "Все" + общий список категорий
// (тот же самый, что используется при создании собственного статуса).
const filters: FilterOption[] = [{ id: 'all', label: 'Все' }, ...categories]
```

Add right after it:

```typescript
// Второй ряд фильтров - показывается только когда выбрана категория "Увлечения".
// "Все" здесь означает "любое хобби", а не "любая категория".
const hobbyFilters: { id: HobbyId | 'all'; label: string }[] = [{ id: 'all', label: 'Все' }, ...hobbies]
```

- [ ] **Step 2: Add `activeHobby` state and update the filtering logic**

Find this line:

```typescript
  const [activeFilter, setActiveFilter] = useState<FilterOption['id']>('all')
```

Add right after it:

```typescript
  // Хобби внутри категории "Увлечения". Отдельное состояние от activeFilter -
  // просто не используется (и не рендерится), если верхний фильтр не "hobbies".
  const [activeHobby, setActiveHobby] = useState<HobbyId | 'all'>('all')
```

Find this block:

```typescript
  // Если выбрано "Все" — показываем все анкеты, иначе — только с нужной категорией.
  const visibleProfiles =
    activeFilter === 'all' ? profiles : profiles.filter((profile) => profile.category === activeFilter)
```

Replace with:

```typescript
  // Если выбрано "Все" — показываем все анкеты, иначе — только с нужной категорией.
  const categoryFilteredProfiles =
    activeFilter === 'all' ? profiles : profiles.filter((profile) => profile.category === activeFilter)

  // Дополнительно сужаем по конкретному хобби - но только внутри категории "Увлечения"
  // и только если выбрано конкретное хобби, а не "Все".
  const visibleProfiles =
    activeFilter === 'hobbies' && activeHobby !== 'all'
      ? categoryFilteredProfiles.filter((profile) => profile.hobby === activeHobby)
      : categoryFilteredProfiles
```

- [ ] **Step 3: Render the second row**

Find this block (the closing of the filters row `<div>`):

```tsx
        <div className="flex gap-2 px-5 pt-4 overflow-x-auto no-scrollbar">
          {filters.map((filter) => {
            const isActive = filter.id === activeFilter
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={
                  isActive
                    ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white whitespace-nowrap flex-shrink-0 transition-colors'
                    : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray whitespace-nowrap flex-shrink-0 transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
                }
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>
```

Replace with:

```tsx
        <div className="flex gap-2 px-5 pt-4 overflow-x-auto no-scrollbar">
          {filters.map((filter) => {
            const isActive = filter.id === activeFilter
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={
                  isActive
                    ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white whitespace-nowrap flex-shrink-0 transition-colors'
                    : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray whitespace-nowrap flex-shrink-0 transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
                }
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        {/* Второй ряд - конкретные хобби, виден только внутри категории "Увлечения" */}
        {activeFilter === 'hobbies' && (
          <div className="flex gap-2 px-5 pt-2 overflow-x-auto no-scrollbar">
            {hobbyFilters.map((hobby) => {
              const isActive = hobby.id === activeHobby
              return (
                <button
                  key={hobby.id}
                  onClick={() => setActiveHobby(hobby.id)}
                  className={
                    isActive
                      ? 'px-3 py-1.5 rounded-full text-[11px] font-medium bg-fly-blue-deep text-white whitespace-nowrap flex-shrink-0 transition-colors'
                      : 'px-3 py-1.5 rounded-full text-[11px] font-medium bg-[#F4F5F8] text-fly-gray whitespace-nowrap flex-shrink-0 transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
                  }
                >
                  {hobby.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedScreen.tsx
git commit -m "$(cat <<'EOF'
Add second row of hobby filters to the feed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Hobby picker in `CreateStatusScreen.tsx` (+ update `App.tsx`)

**Files:**
- Modify: `src/components/CreateStatusScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `hobbies`, `HobbyId` from `src/data/hobbies.ts` (Task 1).
- Produces: `CreateStatusScreenProps.onSubmit: (quote: string, category: ProfileCategory, hobby: HobbyId | null) => void` — its one call site in `App.tsx` is updated in this same task.

- [ ] **Step 1: Update `CreateStatusScreen.tsx` imports, props, and state**

Find this block:

```typescript
import { useState } from 'react'
import { categories } from '../data/categories'
import type { ProfileCategory } from '../data/profiles'
import { SuggestionPanel } from './SuggestionPanel'

interface CreateStatusScreenProps {
  // Вызывается при публикации: передаёт наружу текст и категорию, которые ввёл человек
  onSubmit: (quote: string, category: ProfileCategory) => void
}
```

Replace with:

```typescript
import { useState } from 'react'
import { categories } from '../data/categories'
import { hobbies, type HobbyId } from '../data/hobbies'
import type { ProfileCategory } from '../data/profiles'
import { SuggestionPanel } from './SuggestionPanel'

interface CreateStatusScreenProps {
  // Вызывается при публикации: передаёт наружу текст, категорию и хобби (если категория
  // "Увлечения"; иначе null), которые ввёл человек
  onSubmit: (quote: string, category: ProfileCategory, hobby: HobbyId | null) => void
}
```

Find this block:

```typescript
  const [quote, setQuote] = useState('')
  const [category, setCategory] = useState<ProfileCategory>(categories[0].id)

  // Публиковать можно только если человек хоть что-то написал (без пустых заметок)
  const canSubmit = quote.trim().length > 0
```

Replace with:

```typescript
  const [quote, setQuote] = useState('')
  const [category, setCategory] = useState<ProfileCategory>(categories[0].id)
  const [hobby, setHobby] = useState<HobbyId | null>(null)

  // Публиковать можно только если человек хоть что-то написал (без пустых заметок),
  // а для категории "Увлечения" - ещё и выбрал конкретное хобби
  const canSubmit = quote.trim().length > 0 && (category !== 'hobbies' || hobby !== null)
```

- [ ] **Step 2: Render the hobby picker and pass `hobby` to `onSubmit`**

Find this block:

```tsx
        <div className="flex-1" />

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(quote.trim(), category)}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          Опубликовать
        </button>
```

Replace with:

```tsx
        {category === 'hobbies' && (
          <>
            <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Хобби</p>
            <div className="flex gap-2 flex-wrap">
              {hobbies.map((item) => {
                const isActive = item.id === hobby
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setHobby(item.id)}
                    className={
                      isActive
                        ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white transition-colors'
                        : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
                    }
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="flex-1" />

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(quote.trim(), category, hobby)}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          Опубликовать
        </button>
```

- [ ] **Step 3: Update `App.tsx`'s `handlePublish` to match the new `onSubmit` signature**

In `src/App.tsx`, find this line:

```typescript
import type { Profile, ProfileCategory } from './data/profiles'
```

Replace with:

```typescript
import type { Profile, ProfileCategory } from './data/profiles'
import type { HobbyId } from './data/hobbies'
```

Find this block:

```typescript
  function handlePublish(quote: string, category: ProfileCategory) {
    // Пока просто отмечаем, что публикация состоялась - открываем доступ к ленте.
    // Сам текст заметки (quote/category) в будущем можно будет показывать в
    // "Аккаунт" или использовать как собственную карточку в чужих лентах.
    void quote
    void category
    setHasPosted(true)
  }
```

Replace with:

```typescript
  function handlePublish(quote: string, category: ProfileCategory, hobby: HobbyId | null) {
    // Пока просто отмечаем, что публикация состоялась - открываем доступ к ленте.
    // Сам текст заметки (quote/category/hobby) в будущем можно будет показывать в
    // "Аккаунт" или использовать как собственную карточку в чужих лентах.
    void quote
    void category
    void hobby
    setHasPosted(true)
  }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the app on the status-creation screen:
1. Pick category "Увлечения" — a "Хобби" picker should appear below it, and "Опубликовать" should be disabled until a hobby is picked.
2. Pick a hobby — "Опубликовать" becomes enabled.
3. Switch to a different category (e.g. "Общение") — the hobby picker disappears, and "Опубликовать" only depends on the text again.

- [ ] **Step 6: Commit**

```bash
git add src/components/CreateStatusScreen.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
Add hobby picker to CreateStatusScreen, required for the Hobbies category

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Icebreaker suggestions in `ChatScreen.tsx`

**Files:**
- Modify: `src/components/ChatScreen.tsx`

**Interfaces:**
- Consumes: `getIcebreakers` from `src/data/icebreakers.ts` (Task 3); `Profile.category`/`Profile.hobby` from Task 2.

- [ ] **Step 1: Add the import and compute which icebreakers (if any) to show**

Find this block:

```typescript
import { useState } from 'react'
import type { Profile } from '../data/profiles'
import { BackArrowIcon, SendIcon } from './icons'
```

Replace with:

```typescript
import { useState } from 'react'
import type { Profile } from '../data/profiles'
import { getIcebreakers } from '../data/icebreakers'
import { BackArrowIcon, SendIcon } from './icons'
```

Find this block:

```typescript
  const [draft, setDraft] = useState('')
  const genderLetter = match.gender === 'female' ? 'Ж' : 'М'
  const avatarColor = match.gender === 'female' ? 'bg-fly-coral' : 'bg-fly-blue-deep'
```

Replace with:

```typescript
  const [draft, setDraft] = useState('')
  const genderLetter = match.gender === 'female' ? 'Ж' : 'М'
  const avatarColor = match.gender === 'female' ? 'bg-fly-coral' : 'bg-fly-blue-deep'

  // Подсказки для начала разговора - только для категории "Увлечения" с известным
  // хобби, и только пока человек ещё не написал в этот чат ни одного сообщения сам.
  const hasSentMessage = messages.some((message) => message.from === 'me')
  const icebreakers =
    !hasSentMessage && match.category === 'hobbies' && match.hobby ? getIcebreakers(match.hobby) : []
```

- [ ] **Step 2: Render the suggestions above the message input**

Find this block:

```tsx
      {/* Поле ввода нового сообщения - всегда внизу, не скроллится вместе с лентой */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-[#F0F1F4]">
```

Replace with:

```tsx
      {/* Подсказки для начала разговора - показываются только пока не написали сами */}
      {icebreakers.length > 0 && (
        <div className="flex-shrink-0 flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
          {icebreakers.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setDraft(text)}
              className="text-left text-xs text-fly-ink bg-[#F4F5F8] rounded-fly-md px-3 py-2 whitespace-nowrap flex-shrink-0"
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {/* Поле ввода нового сообщения - всегда внизу, не скроллится вместе с лентой */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-[#F0F1F4]">
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 4: Manual verification (golden path + edge case)**

Run: `npm run dev`. This needs a hobbies-category match with a mutual like — the "Везу велосипед..." mock profile already has `interestedInYou` unset, so use the DevicePreview/experiment panel or temporarily like a hobbies profile that has `interestedInYou: true` if available; otherwise briefly set `interestedInYou: true` on one of the two hobbies profiles in `src/data/profiles.ts` for this manual check only (revert before committing if you changed it just for testing), then:
1. Like that profile in the feed so it becomes a match, open its chat in "Сообщения" — the 2 icebreaker suggestions for its hobby should appear above the input.
2. Tap one — it should fill the input (not send immediately).
3. Send any message — the suggestions should no longer appear if you reopen the chat.
4. Open a chat with a match from a different category (e.g. "Попутчики") — no suggestions should appear there at all.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatScreen.tsx
git commit -m "$(cat <<'EOF'
Add hobby-based conversation-starter suggestions to ChatScreen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
