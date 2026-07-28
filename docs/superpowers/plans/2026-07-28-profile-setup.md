# Profile Setup Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-time "about you" screen (gender/age/height/languages) shown once after login and before the existing status-note screen, persisted to a new Supabase `profiles` table, so the upcoming real-feed work has real data to show instead of the currently-missing fields.

**Architecture:** One new Supabase table (`profiles`, `user_id` as primary key, RLS-protected, insert-only). A new leaf screen component (`ProfileSetupScreen`, modeled on the existing `CreateStatusScreen`) collects and validates the fields. `App.tsx` gains a `hasProfile`/`profileLoading` check (same pattern as the existing `hasPosted`/`postLoading`) and renders the new screen between `LoginScreen` and the existing `HashRouter`, outside the router — same technique already used for `LoginScreen`.

**Tech Stack:** `@supabase/supabase-js` (already installed), Postgres RLS, React state/effects. No new npm packages.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-28-profile-setup-design.md` — follow it exactly for SQL, column names, and validation ranges.
- `profiles` is a separate table from `posts` (different lifecycle — see spec's "Почему отдельная таблица" section). `user_id` is the primary key directly (not a separate `id` + unique constraint, unlike `posts`).
- Validation ranges, must match between the SQL `check` constraints and the client-side validation in `ProfileSetupScreen`: age 18–99 (integer), height 120–230 cm (integer), languages non-empty after trim, gender one of `'male' | 'female'`.
- No `update`/`delete` policies or UI — profile editing is out of scope (YAGNI, matches the existing decorative "Редактировать анкету" row in `AccountScreen.tsx`, which stays untouched).
- No automated tests for the Supabase-network parts — same reasoning as the two previous backend pieces (auth, own-post persistence): live network behavior is verified manually. Verify with `npm run build` (typecheck) instead.
- The SQL schema change must be applied by the human in the Supabase Dashboard SQL Editor — no Supabase CLI or MCP is connected to this project.
- Do not touch `CreateStatusScreen.tsx`, the `/new` route, or `RequireStatus` — this plan only adds a new gate *before* that existing flow, it doesn't change it.

---

### Task 1: Add the `profiles` table SQL as a tracked file

**Files:**
- Create: `supabase/sql/2026-07-28-create-profiles-table.sql`

**Interfaces:**
- Produces: the exact SQL text that Task 4 (human) pastes into the Supabase SQL Editor. Documentation/history only, same role as `supabase/sql/2026-07-28-create-posts-table.sql`.

- [ ] **Step 1: Create the file with the exact SQL from the spec**

```sql
-- supabase/sql/2026-07-28-create-profiles-table.sql
-- Анкета о себе (пол/возраст/рост/языки), одна запись на пользователя, заполняется один раз.
-- Применяется вручную через Supabase Dashboard -> SQL Editor (нет подключённого CLI).

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gender text not null check (gender in ('male', 'female')),
  age integer not null check (age between 18 and 99),
  height integer not null check (height between 120 and 230),
  languages text not null check (char_length(trim(languages)) > 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Каждый видит только свою анкету
create policy "profiles_select_own" on public.profiles
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Каждый может создать анкету только от своего имени
create policy "profiles_insert_own" on public.profiles
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

grant select, insert on public.profiles to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/sql/2026-07-28-create-profiles-table.sql
git commit -m "Add SQL for profiles table (one-time about-you setup)"
```

---

### Task 2: Create `ProfileSetupScreen.tsx`

**Files:**
- Create: `src/components/ProfileSetupScreen.tsx`

**Interfaces:**
- Produces: `ProfileSetupScreenProps` with `onSubmit: (gender: 'male' | 'female', age: number, height: number, languages: string) => Promise<void>`. Task 3's `handleProfileSubmit` in `App.tsx` must match this exact signature.

- [ ] **Step 1: Create the component**

```typescript
// Экран "Расскажите о себе" - разовая короткая анкета (пол/возраст/рост/языки),
// показывается один раз после входа, до экрана заметки "Что вы ищете сейчас?".
// Структура и стиль - по образцу CreateStatusScreen.tsx.

import { useState } from 'react'

const MIN_AGE = 18
const MAX_AGE = 99
const MIN_HEIGHT = 120
const MAX_HEIGHT = 230

interface ProfileSetupScreenProps {
  // Вызывается при отправке анкеты. Асинхронная - сохраняется в базу данных;
  // если не получилось (например, нет сети), нужно выбросить ошибку - её поймает
  // этот же экран и покажет сообщение (тот же паттерн, что в CreateStatusScreen).
  onSubmit: (gender: 'male' | 'female', age: number, height: number, languages: string) => Promise<void>
}

export function ProfileSetupScreen({ onSubmit }: ProfileSetupScreenProps) {
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [ageInput, setAgeInput] = useState('')
  const [heightInput, setHeightInput] = useState('')
  const [languages, setLanguages] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const age = Number(ageInput)
  const height = Number(heightInput)
  const canSubmit =
    gender !== null &&
    Number.isInteger(age) &&
    age >= MIN_AGE &&
    age <= MAX_AGE &&
    Number.isInteger(height) &&
    height >= MIN_HEIGHT &&
    height <= MAX_HEIGHT &&
    languages.trim().length > 0

  async function handleSubmit() {
    if (!canSubmit || gender === null) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(gender, age, height, languages.trim())
    } catch {
      setError('Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-12 pb-6 flex flex-col">
        <div className="text-xl font-semibold mb-1">
          Fl<span className="text-fly-blue-deep">y</span>
        </div>
        <h1 className="text-2xl font-semibold text-fly-ink mt-6">Расскажите о себе</h1>
        <p className="text-sm text-fly-gray mt-2 leading-relaxed">
          Коротко — эти данные будет видно в вашей карточке в ленте.
        </p>

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Пол</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGender('male')}
            className={
              gender === 'male'
                ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white transition-colors'
                : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
            }
          >
            Мужской
          </button>
          <button
            type="button"
            onClick={() => setGender('female')}
            className={
              gender === 'female'
                ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white transition-colors'
                : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
            }
          >
            Женский
          </button>
        </div>

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Возраст</p>
        <input
          type="number"
          value={ageInput}
          onChange={(event) => setAgeInput(event.target.value)}
          placeholder="Например: 27"
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        />

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Рост, см</p>
        <input
          type="number"
          value={heightInput}
          onChange={(event) => setHeightInput(event.target.value)}
          placeholder="Например: 175"
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        />

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Языки</p>
        <input
          type="text"
          value={languages}
          onChange={(event) => setLanguages(event.target.value)}
          placeholder="Русский, английский"
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        />

        <div className="flex-1" />

        {error && <p className="mt-4 text-xs text-fly-gray text-center">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          {submitting ? 'Сохраняем…' : 'Продолжить'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds. `ProfileSetupScreen` isn't imported anywhere yet, so this only confirms the new file itself is valid TypeScript/JSX.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProfileSetupScreen.tsx
git commit -m "Add ProfileSetupScreen for one-time about-you setup"
```

---

### Task 3: Wire the profile gate into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ProfileSetupScreen` from Task 2 (`onSubmit: (gender, age, height, languages) => Promise<void>`). `supabase` client (already imported in this file).
- Produces: nothing new consumed by other files — `App` is the root component.

- [ ] **Step 1: Import `ProfileSetupScreen`**

Find:

```typescript
import { LoginScreen } from './components/LoginScreen'
```

Replace with:

```typescript
import { LoginScreen } from './components/LoginScreen'
import { ProfileSetupScreen } from './components/ProfileSetupScreen'
```

- [ ] **Step 2: Add `hasProfile`/`profileLoading` state and their effect**

Find:

```typescript
  const { session, loading } = useSession()
  const [hasPosted, setHasPosted] = useState(false)
  // Пока не знаем, есть ли уже публикация у вошедшего человека - показываем общий
  // экран загрузки (см. postLoading в overallLoading ниже), а не экран создания.
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

  // Общая проверка "загрузки" перед показом приложения: либо ещё проверяем вход,
  // либо (уже войдя) ещё проверяем, есть ли публикация.
  const overallLoading = loading || (!!session && postLoading)
```

Replace with:

```typescript
  const { session, loading } = useSession()
  const [hasProfile, setHasProfile] = useState(false)
  // Пока не знаем, заполнил ли вошедший человек анкету о себе - показываем общий
  // экран загрузки (см. profileLoading в overallLoading ниже), а не следующий экран.
  const [profileLoading, setProfileLoading] = useState(true)
  const [hasPosted, setHasPosted] = useState(false)
  // Пока не знаем, есть ли уже публикация у вошедшего человека - показываем общий
  // экран загрузки (см. postLoading в overallLoading ниже), а не экран создания.
  const [postLoading, setPostLoading] = useState(true)

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

  useEffect(() => {
    // Ждём, пока не станет известно, что анкета уже есть - иначе успели бы
    // без нужды сходить в базу за публикацией раньше, чем показать анкету.
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

  // Общая проверка "загрузки" перед показом приложения: сначала проверяем вход,
  // потом (уже войдя) анкету, потом (уже с анкетой) публикацию - по очереди,
  // а не тремя параллельными запросами.
  const overallLoading = loading || (!!session && (profileLoading || (hasProfile && postLoading)))
```

- [ ] **Step 3: Add `handleProfileSubmit`**

Find:

```typescript
  async function handlePublish(quote: string, category: ProfileCategory, hobby: HobbyId | null) {
```

Replace with:

```typescript
  async function handleProfileSubmit(gender: 'male' | 'female', age: number, height: number, languages: string) {
    if (!session) return
    const { error } = await supabase
      .from('profiles')
      .insert({ user_id: session.user.id, gender, age, height, languages })
    if (error) throw error
    setHasProfile(true)
  }

  async function handlePublish(quote: string, category: ProfileCategory, hobby: HobbyId | null) {
```

- [ ] **Step 4: Render the new screen between login and the router**

Find:

```typescript
      ) : !session ? (
        <LoginScreen />
      ) : (
```

Replace with:

```typescript
      ) : !session ? (
        <LoginScreen />
      ) : !hasProfile ? (
        <ProfileSetupScreen onSubmit={handleProfileSubmit} />
      ) : (
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "Gate the app behind a one-time profile-setup screen"
```

---

### Task 4 (human, not automatable): Apply the SQL and verify end-to-end

**Files:** none — manual verification in the browser.

**Why it can't be a subagent task:** no Supabase CLI or MCP is connected to this project, so nothing in this repo can execute SQL against the live database.

- [ ] **Step 1: Apply the schema**

Open [supabase.com/dashboard](https://supabase.com/dashboard) → the project → **SQL Editor**. Paste the contents of `supabase/sql/2026-07-28-create-profiles-table.sql` (from Task 1) and click **Run**.

- [ ] **Step 2: Confirm the table exists**

Open **Table Editor** → confirm a `profiles` table exists with columns `user_id, gender, age, height, languages, created_at`.

- [ ] **Step 3: End-to-end check — new account sees the profile screen first**

Run `npm run dev`, sign in with an email that has never published a post before (or one whose `posts`/`profiles` rows you delete first via Table Editor for a clean test). Expected order: "Расскажите о себе" screen → fill it in and continue → "Что вы ищете сейчас?" screen → publish → feed.

- [ ] **Step 4: End-to-end check — reload skips both one-time screens**

Reload the page. Expected: goes straight to the feed, skipping both the profile screen and the create-post screen.

- [ ] **Step 5: End-to-end check — validation and error path**

On the profile screen, confirm the "Продолжить" button stays disabled until gender is picked, age/height are filled with values in range, and languages is non-empty. With dev tools' Network tab set to Offline, fill in valid values and submit: expect the button to show "Сохраняем…" then revert, an error message under the button, and the form keeps its values. Go back online and confirm submitting then works.

---

## Self-Review Notes

- **Spec coverage:** table + RLS (Task 1), screen UI + client-side validation matching the DB check constraints (Task 2), sequential loading gate + persistence wiring in `App.tsx` (Task 3), manual SQL application + end-to-end checks including the "checks run in order, not in parallel" behavior (Task 4). All spec sections covered.
- **Placeholder scan:** none found — every step has literal code, literal SQL, or literal dashboard/browser actions.
- **Type consistency:** `ProfileSetupScreenProps.onSubmit` (Task 2) exactly matches `handleProfileSubmit`'s signature (Task 3): `(gender: 'male' | 'female', age: number, height: number, languages: string) => Promise<void>`. State names (`hasProfile`, `profileLoading`, `hasPosted`, `postLoading`) are used consistently across both `useEffect` hooks and the `overallLoading` expression within Task 3.
