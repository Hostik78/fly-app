# Persist Own Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save the user's own publication (quote/category/hobby from the "Что вы ищете сейчас?" screen) to a real Supabase table instead of only in-memory React state, so it survives a page reload.

**Architecture:** One new Supabase table (`posts`, one row per `auth.users` id, RLS-protected). `App.tsx` queries it once per session to decide whether to skip the create-post screen, and inserts into it when the user publishes. `CreateStatusScreen` gains submitting/error UI because the publish action is now an async network call that can fail.

**Tech Stack:** `@supabase/supabase-js` (already installed), Postgres RLS, React state/effects. No new npm packages.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-28-persist-own-post-design.md` — follow it exactly for SQL, column names, and check-constraint value lists.
- `category` values allowed: `communication`, `romance`, `hobbies`, `fellow-travelers`, `networking`, `friendship` (must match `ProfileCategory` in `src/data/profiles.ts`).
- `hobby` values allowed: `cycling`, `photography`, `movies`, `books`, `music`, `sports`, `cooking`, `travel` (must match `HobbyId` in `src/data/hobbies.ts`).
- One row per user (`user_id unique`). No update/delete policies — publication is one-time only in this version (YAGNI, per spec).
- No automated tests for the Supabase-network parts — this mirrors the existing auth feature (`2026-07-27-google-auth-design.md`), where live network/email behavior is verified manually, not with vitest. Verify with `npm run build` (typecheck) instead of a test suite for these tasks.
- The SQL schema change must be applied by the human in the Supabase Dashboard SQL Editor — there is no Supabase CLI or MCP connected to this project, so no agent (subagent or otherwise) can run it directly against the live database.

---

### Task 1: Add the `posts` table SQL as a tracked file

**Files:**
- Create: `supabase/sql/2026-07-28-create-posts-table.sql`

**Interfaces:**
- Produces: the exact SQL text that Task 4 (human) pastes into the Supabase SQL Editor. No code depends on this file at runtime — it's documentation/history only, since there's no CLI linked to turn it into a real migration.

- [ ] **Step 1: Create the file with the exact SQL from the spec**

```sql
-- supabase/sql/2026-07-28-create-posts-table.sql
-- Своя публикация человека ("Что вы ищете сейчас?"), одна запись на пользователя.
-- Применяется вручную через Supabase Dashboard -> SQL Editor (нет подключённого CLI).

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

- [ ] **Step 2: Commit**

```bash
git add supabase/sql/2026-07-28-create-posts-table.sql
git commit -m "Add SQL for posts table (own-publication persistence)"
```

---

### Task 2: Persist publication state in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase` client — `import { supabase } from './lib/supabase'` (existing, from `src/lib/supabase.ts`). `useSession()` — existing, returns `{ session: Session | null; loading: boolean }` (`src/lib/useSession.ts`, unchanged).
- Produces: `handlePublish` becomes `(quote: string, category: ProfileCategory, hobby: HobbyId | null) => Promise<void>`, and now throws on failure instead of always succeeding. Task 3 relies on this exact signature and the throw-on-error behavior.

- [ ] **Step 1: Add the `supabase` import**

In `src/App.tsx`, add alongside the other imports (after the `useSession` import):

```typescript
import { supabase } from './lib/supabase'
```

- [ ] **Step 2: Replace the `hasPosted` state with a DB-backed check**

Find:

```typescript
  const { session, loading } = useSession()
  const [hasPosted, setHasPosted] = useState(false)
```

Replace with:

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

- [ ] **Step 3: Add the `useEffect` import**

Find:

```typescript
import { useState } from 'react'
```

Replace with:

```typescript
import { useEffect, useState } from 'react'
```

- [ ] **Step 4: Make `handlePublish` write to Supabase**

Find:

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

Replace with:

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

- [ ] **Step 5: Use `overallLoading` instead of `loading` in the render**

Find:

```typescript
      {loading ? (
```

Replace with:

```typescript
      {overallLoading ? (
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (this also catches any mismatch between `handlePublish`'s new async signature and how `CreateStatusScreen` calls it — Task 3 fixes that side).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "Persist own publication to Supabase instead of in-memory state"
```

---

### Task 3: Submitting/error UI in `CreateStatusScreen.tsx`

**Files:**
- Modify: `src/components/CreateStatusScreen.tsx`

**Interfaces:**
- Consumes: `onSubmit` prop, now `(quote: string, category: ProfileCategory, hobby: HobbyId | null) => Promise<void>` that may throw (from Task 2's `handlePublish`).
- Produces: nothing consumed elsewhere — this is the leaf screen.

- [ ] **Step 1: Update the prop type**

Find:

```typescript
interface CreateStatusScreenProps {
  // Вызывается при публикации: передаёт наружу текст, категорию и хобби (если категория
  // "Увлечения"; иначе null), которые ввёл человек
  onSubmit: (quote: string, category: ProfileCategory, hobby: HobbyId | null) => void
}
```

Replace with:

```typescript
interface CreateStatusScreenProps {
  // Вызывается при публикации: передаёт наружу текст, категорию и хобби (если категория
  // "Увлечения"; иначе null), которые ввёл человек. Асинхронная - публикация сохраняется
  // в базу данных; если не получилось (например, нет сети), нужно выбросить ошибку -
  // её поймает этот же экран и покажет сообщение.
  onSubmit: (quote: string, category: ProfileCategory, hobby: HobbyId | null) => Promise<void>
}
```

- [ ] **Step 2: Add submitting/error state**

Find:

```typescript
  const [quote, setQuote] = useState('')
  const [category, setCategory] = useState<ProfileCategory>(categories[0].id)
  const [hobby, setHobby] = useState<HobbyId | null>(null)
```

Replace with:

```typescript
  const [quote, setQuote] = useState('')
  const [category, setCategory] = useState<ProfileCategory>(categories[0].id)
  const [hobby, setHobby] = useState<HobbyId | null>(null)
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

- [ ] **Step 3: Wire the button to `handleSubmit` and the new disabled/label state, and show the error**

Find:

```typescript
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(quote.trim(), category, hobby)}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          Опубликовать
        </button>
```

Replace with:

```typescript
        {error && <p className="mt-4 text-xs text-fly-gray text-center">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          {submitting ? 'Публикуем…' : 'Опубликовать'}
        </button>
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/CreateStatusScreen.tsx
git commit -m "Show submitting/error state while publishing to Supabase"
```

---

### Task 4 (human, not automatable): Apply the SQL and verify end-to-end

**Files:** none — this is manual verification in the browser, not a code change.

**Why it can't be a subagent task:** there is no Supabase CLI or MCP connected to this project (checked at plan time), so nothing in this repo can execute SQL against the live database. This step needs a human with dashboard access.

- [ ] **Step 1: Apply the schema**

Open [supabase.com/dashboard](https://supabase.com/dashboard) → the project → **SQL Editor**. Paste the contents of `supabase/sql/2026-07-28-create-posts-table.sql` (from Task 1) and click **Run**.

- [ ] **Step 2: Confirm the table exists**

Open **Table Editor** in the same dashboard → confirm a `posts` table exists with columns `id, user_id, quote, category, hobby, created_at`.

- [ ] **Step 3: End-to-end check — new publication persists**

Run `npm run dev`, sign in (magic link), publish a note on "Что вы ищете сейчас?", confirm it navigates to the feed. Reload the page. Expected: goes straight to the feed (not back to the create-post screen).

- [ ] **Step 4: End-to-end check — error path doesn't crash**

With dev tools open, go offline (Network tab → Offline) before publishing on a fresh account, click "Опубликовать". Expected: button shows "Публикуем…" then reverts, an error message appears under the button, the form keeps its text (nothing is lost), and no unhandled exception appears in the console. Go back online and confirm publishing then works.

---

## Self-Review Notes

- **Spec coverage:** table + RLS (Task 1), App.tsx check-on-load + insert-on-publish (Task 2), submitting/error UI (Task 3), manual SQL application + end-to-end check (Task 4) — all spec sections covered. No update/delete UI was added, matching the spec's explicit YAGNI scope cut.
- **Placeholder scan:** none found — every step has literal code or literal dashboard clicks.
- **Type consistency:** `handlePublish` signature in Task 2 (`Promise<void>`, throws on error) matches the `onSubmit` type Task 3 gives `CreateStatusScreenProps`. `postLoading`/`overallLoading` names are used consistently within Task 2 (nothing outside `App.tsx` depends on them).
