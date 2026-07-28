# Real Likes and Matches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist likes to the database, compute real mutual-like matches from it, and remove the old mock `interestedInYou`-driven matching mechanism along with the `App.tsx`-owned `matches`/`onLike` plumbing it required.

**Architecture:** A new `likes` table (composite primary key `(liker_id, liked_id)`, RLS lets you see rows where you're either side). `useFeedProfiles` gains a `likedByMe` field per profile (one extra query). A new `useMatches` hook (used directly by `MessagesScreen`, the same pattern `FeedScreen` already uses for `useFeedProfiles`) computes mutual likes and builds `Profile[]` for display. Because matches no longer need to be shared live between `FeedScreen` and `MessagesScreen` in memory, `App.tsx`'s `matches` state and `handleLike`, and the `matches`/`onLike` fields on `AppOutletContext`/`AppShellProps`, are deleted entirely — each screen now fetches what it needs itself.

**Tech Stack:** `@supabase/supabase-js` (already installed), Supabase CLI (already linked). No new npm packages.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-28-real-likes-design.md`.
- No unlike/undo — `likes` gets no `update`/`delete` policy or UI (YAGNI, matches every previous backend piece in this project).
- Clicking an already-liked card does nothing (no duplicate insert attempt) — enforced client-side in `ProfileCard`, backed by the composite primary key server-side.
- Chat message text stays in-memory only — this plan does not touch `ChatScreen.tsx` message persistence.
- Schema changes apply via the linked Supabase CLI (`set -a && source .env.supabase.local && set +a` before any `supabase` command needing auth).
- Remember the Supabase-default-grants gotcha (`LESSONS.md`): explicitly `revoke all on public.likes from anon, authenticated;` before granting the intended `select, insert`.
- No automated tests for the Supabase-network parts (same reasoning as every prior backend piece).

---

### Task 1: Create the `likes` table

**Files:**
- Create: `supabase/migrations/<timestamp>_create_likes_table.sql`

**Interfaces:** None — pure schema change.

- [ ] **Step 1: Create the migration**

```bash
supabase migration new create_likes_table
```

- [ ] **Step 2: Fill it in**

```sql
create table public.likes (
  liker_id uuid not null references auth.users (id) on delete cascade,
  liked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  check (liker_id <> liked_id)
);

alter table public.likes enable row level security;

-- Видно только свои лайки (кого лайкнул я, и кто лайкнул меня) - второе нужно,
-- чтобы вычислять совпадения.
create policy "likes_select_own_or_received" on public.likes
  for select
  to authenticated
  using ( (select auth.uid()) = liker_id or (select auth.uid()) = liked_id );

-- Ставить лайк можно только от своего имени
create policy "likes_insert_own" on public.likes
  for insert
  to authenticated
  with check ( (select auth.uid()) = liker_id );

revoke all on public.likes from anon, authenticated;
grant select, insert on public.likes to authenticated;
```

- [ ] **Step 3: Push it**

```bash
set -a && source .env.supabase.local && set +a
supabase db push --linked
```

Expected: `"message":"Finished supabase db push."` with no error.

- [ ] **Step 4: Verify**

```bash
set -a && source .env.supabase.local && set +a
CONN="postgresql://postgres.ktwkddurlvslusdssjoz@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
PGPASSWORD="$SUPABASE_DB_PASSWORD" /opt/homebrew/opt/libpq/bin/psql "$CONN" -c "\d public.likes"
PGPASSWORD="$SUPABASE_DB_PASSWORD" /opt/homebrew/opt/libpq/bin/psql "$CONN" -c "select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='likes' and grantee in ('anon','authenticated') order by 1,2;"
```

Expected: table has the two columns + `created_at`, primary key on `(liker_id, liked_id)`, the `liker_id <> liked_id` check, both RLS policies. Grants show only `authenticated`/`INSERT` and `authenticated`/`SELECT` — nothing for `anon`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "Create likes table"
```

---

### Task 2: Wire real likes and matches through the app

One task, not several — `Profile.interestedInYou` → `Profile.likedByMe` is a breaking type change that every consumer below has to move with, same reasoning as the previous plan's Task 3.

**Files:**
- Modify: `src/data/profiles.ts`
- Modify: `src/lib/useFeedProfiles.ts`
- Create: `src/lib/useMatches.ts`
- Modify: `src/components/ProfileCard.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/FeedScreen.tsx`
- Modify: `src/components/MessagesScreen.tsx`

**Interfaces:**
- Produces: `Profile.likedByMe: boolean` (replaces `interestedInYou?: boolean`). `useMatches(currentUserId: string | undefined): { matches: Profile[]; loading: boolean }`. `AppOutletContext`/`AppShellProps` shrink to just `{ currentUserId: string }`.

- [ ] **Step 1: `src/data/profiles.ts` - swap `interestedInYou` for `likedByMe`**

Find:

```typescript
  interestedInYou?: boolean // задел под настоящие лайки (следующий шаг) - пока не используется
```

Replace with:

```typescript
  likedByMe: boolean // лайкнул ли уже я этого человека - нужно кнопке лайка, чтобы не спрашивать дважды
```

- [ ] **Step 2: `src/lib/useFeedProfiles.ts` - fetch and attach `likedByMe`**

Find:

```typescript
    async function load() {
      const { data: posts } = await supabase
        .from('posts')
        .select('user_id, quote, category, hobby, created_at')
        .neq('user_id', currentUserId)
        .order('created_at', { ascending: false })

      const userIds = (posts ?? []).map((post) => post.user_id)
```

Replace with:

```typescript
    async function load() {
      const [{ data: posts }, { data: myLikes }] = await Promise.all([
        supabase
          .from('posts')
          .select('user_id, quote, category, hobby, created_at')
          .neq('user_id', currentUserId)
          .order('created_at', { ascending: false }),
        supabase.from('likes').select('liked_id').eq('liker_id', currentUserId),
      ])
      const likedIds = new Set((myLikes ?? []).map((row) => row.liked_id))

      const userIds = (posts ?? []).map((post) => post.user_id)
```

Find:

```typescript
          isNew: now - new Date(post.created_at).getTime() < NEW_THRESHOLD_MS,
          quote: post.quote,
          age: info?.age ?? undefined,
          height: info?.height ?? undefined,
          languages: info?.languages ?? undefined,
        }
      })
```

Replace with:

```typescript
          isNew: now - new Date(post.created_at).getTime() < NEW_THRESHOLD_MS,
          quote: post.quote,
          age: info?.age ?? undefined,
          height: info?.height ?? undefined,
          languages: info?.languages ?? undefined,
          likedByMe: likedIds.has(post.user_id),
        }
      })
```

- [ ] **Step 3: Create `src/lib/useMatches.ts`**

```typescript
// Хук, который вычисляет настоящие совпадения (взаимный лайк): кого лайкнул(а) я,
// и кто лайкнул(а) меня - пересечение этих двух списков и есть совпадения.
// Публикации и анкеты для них склеиваются так же, как в useFeedProfiles.ts - независимая
// копия той же небольшой логики: два хука, у каждого свой источник списка user_id
// (там - "все, кроме себя", здесь - "пересечение лайков"), общий хелпер пока не выносим,
// чтобы не трогать уже проверенный useFeedProfiles ради такого небольшого дублирования.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'

export function useMatches(currentUserId: string | undefined): { matches: Profile[]; loading: boolean } {
  const [matches, setMatches] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    async function load() {
      const [{ data: iLiked }, { data: likedMe }] = await Promise.all([
        supabase.from('likes').select('liked_id').eq('liker_id', currentUserId),
        supabase.from('likes').select('liker_id').eq('liked_id', currentUserId),
      ])
      const likedMeSet = new Set((likedMe ?? []).map((row) => row.liker_id))
      const matchUserIds = (iLiked ?? []).map((row) => row.liked_id).filter((id) => likedMeSet.has(id))

      if (matchUserIds.length === 0) {
        if (!cancelled) {
          setMatches([])
          setLoading(false)
        }
        return
      }

      const [{ data: posts }, { data: profileRows }] = await Promise.all([
        supabase.from('posts').select('user_id, quote, category, hobby, created_at').in('user_id', matchUserIds),
        supabase.from('profiles').select('user_id, gender, age, height, languages').in('user_id', matchUserIds),
      ])

      const infoByUserId = new Map((profileRows ?? []).map((row) => [row.user_id, row]))

      const merged: Profile[] = (posts ?? []).map((post) => {
        const info = infoByUserId.get(post.user_id)
        return {
          id: post.user_id,
          gender: (info?.gender ?? undefined) as Profile['gender'],
          category: post.category as ProfileCategory,
          hobby: (post.hobby ?? undefined) as HobbyId | undefined,
          online: false,
          quote: post.quote,
          age: info?.age ?? undefined,
          height: info?.height ?? undefined,
          languages: info?.languages ?? undefined,
          likedByMe: true, // совпадение возможно только если лайкнули друг друга
        }
      })

      if (!cancelled) {
        setMatches(merged)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  return { matches, loading }
}
```

- [ ] **Step 4: `src/components/ProfileCard.tsx` - persisted like state, async `onLike`, click-guard**

Find:

```typescript
interface ProfileCardProps {
  profile: Profile
  // Вызывается только когда карточку ЛАЙКНУЛИ (не при снятии лайка) - нужно,
  // чтобы наверху (в App.tsx) можно было проверить, не совпадение ли это.
  // Не передан - кнопка лайка вообще не рисуется (сейчас так для всех настоящих
  // анкет в ленте, пока не сделаны настоящие лайки - см. FeedScreen.tsx).
  onLike?: (profile: Profile) => void
}

export function ProfileCard({ profile, onLike }: ProfileCardProps) {
  // liked - отметил ли пользователь эту анкету лайком. По умолчанию - нет.
  const [liked, setLiked] = useState(false)
```

Replace with:

```typescript
interface ProfileCardProps {
  profile: Profile
  // Вызывается при лайке - сохраняет его в базу (см. FeedScreen.tsx). Асинхронная -
  // если не получилось (нет сети), кнопка визуально откатывается обратно (см. ниже).
  // Не передана - кнопки лайка вообще нет (так для карточек в "Сообщениях").
  onLike?: (profile: Profile) => Promise<void>
}

export function ProfileCard({ profile, onLike }: ProfileCardProps) {
  // liked - отметил ли пользователь эту анкету лайком. Берём из уже сохранённого
  // состояния (profile.likedByMe), а не всегда "нет" - иначе при повторном заходе
  // в ленту можно было бы по ошибке попробовать лайкнуть того же человека ещё раз.
  const [liked, setLiked] = useState(profile.likedByMe)
```

Find:

```typescript
        {onLike && (
          <div className="flex justify-end mt-3">
            <button
              onClick={() => {
                const nowLiked = !liked
                setLiked(nowLiked)
                if (nowLiked) onLike(profile)
              }}
              className={`w-11 h-11 rounded-fly-md flex items-center justify-center transition-transform duration-200 active:scale-90 hover:scale-105 ${
                liked ? 'bg-fly-coral scale-110' : 'bg-fly-tint-coral scale-100'
              }`}
            >
              <HeartIcon filled={liked} />
            </button>
          </div>
        )}
```

Replace with:

```typescript
        {onLike && (
          <div className="flex justify-end mt-3">
            <button
              onClick={async () => {
                // Уже лайкнули раньше - повторно ничего не отправляем.
                if (liked) return
                setLiked(true)
                try {
                  await onLike(profile)
                } catch {
                  // Не сохранилось (например, нет сети) - откатываем обратно, без
                  // отдельного текста ошибки (кнопка в списке карточек - не форма).
                  setLiked(false)
                }
              }}
              className={`w-11 h-11 rounded-fly-md flex items-center justify-center transition-transform duration-200 active:scale-90 hover:scale-105 ${
                liked ? 'bg-fly-coral scale-110' : 'bg-fly-tint-coral scale-100'
              }`}
            >
              <HeartIcon filled={liked} />
            </button>
          </div>
        )}
```

- [ ] **Step 5: `src/components/AppShell.tsx` - drop `matches`/`onLike`**

Find:

```typescript
import { NavLink, Outlet } from 'react-router-dom'
import { GridIcon, MessageIcon, AccountIcon } from './icons'
import type { Profile } from '../data/profiles'

// Общие данные и функции, которые должны быть видны и Ленте, и Сообщениям одновременно
// (иначе лайк на Ленте никак не мог бы "долететь" до списка переписок).
// React Router передаёт это вниз через <Outlet context={...} />, а каждый экран
// достаёт нужное через хук useOutletContext<AppOutletContext>().
export interface AppOutletContext {
  matches: Profile[] // с кем уже "совпали" (взаимный лайк)
  onLike: (profile: Profile) => void // вызывается, когда поставили лайк на Ленте
  currentUserId: string // свой user_id - нужен ленте, чтобы не показывать свою же публикацию
}

interface AppShellProps {
  matches: Profile[]
  onLike: (profile: Profile) => void
  currentUserId: string
}
```

Replace with:

```typescript
import { NavLink, Outlet } from 'react-router-dom'
import { GridIcon, MessageIcon, AccountIcon } from './icons'

// currentUserId - единственное, что должно быть видно любому экрану внутри AppShell.
// Раньше здесь же передавались matches/onLike (лайки жили в памяти App.tsx) - теперь
// и лента (useFeedProfiles), и сообщения (useMatches) сами спрашивают у базы то, что
// им нужно, поэтому делиться этим через контекст больше незачем.
export interface AppOutletContext {
  currentUserId: string
}

interface AppShellProps {
  currentUserId: string
}
```

Find:

```typescript
export function AppShell({ matches, onLike, currentUserId }: AppShellProps) {
```

Replace with:

```typescript
export function AppShell({ currentUserId }: AppShellProps) {
```

Find:

```typescript
      {/* Сюда React Router подставляет текущий экран (Лента/Сообщения/Аккаунт).
          context передаёт matches/onLike вниз, не проходя их через пропсы каждого маршрута. */}
      <div className="flex-1 overflow-hidden">
        <Outlet context={{ matches, onLike, currentUserId } satisfies AppOutletContext} />
      </div>
```

Replace with:

```typescript
      {/* Сюда React Router подставляет текущий экран (Лента/Сообщения/Аккаунт).
          context передаёт currentUserId вниз, не проходя его через пропсы каждого маршрута. */}
      <div className="flex-1 overflow-hidden">
        <Outlet context={{ currentUserId } satisfies AppOutletContext} />
      </div>
```

- [ ] **Step 6: `src/App.tsx` - remove `matches`/`handleLike`**

Find:

```typescript
import type { Profile, ProfileCategory } from './data/profiles'
```

Replace with:

```typescript
import type { ProfileCategory } from './data/profiles'
```

Find:

```typescript
  // Общая проверка "загрузки" перед показом приложения: сначала проверяем вход,
  // потом (уже войдя) анкету, потом (уже с анкетой) публикацию - по очереди,
  // а не тремя параллельными запросами.
  const overallLoading = loading || (!!session && (profileLoading || (hasProfile && postLoading)))

  // Список анкет, с которыми уже "совпали" (взаимный лайк) - живёт здесь, а не в самой
  // Ленте, потому что его должны видеть и Лента, и Сообщения одновременно.
  const [matches, setMatches] = useState<Profile[]>([])

  async function handleProfileSubmit(
```

Replace with:

```typescript
  // Общая проверка "загрузки" перед показом приложения: сначала проверяем вход,
  // потом (уже войдя) анкету, потом (уже с анкетой) публикацию - по очереди,
  // а не тремя параллельными запросами.
  const overallLoading = loading || (!!session && (profileLoading || (hasProfile && postLoading)))

  async function handleProfileSubmit(
```

Find:

```typescript
  // Вызывается при лайке карточки на Ленте. Совпадение случается, только если человек
  // на тестовых данных отмечен как "заранее заинтересован в вас" (interestedInYou) -
  // по-настоящему это будет известно лишь после реального лайка с той стороны.
  function handleLike(profile: Profile) {
    if (!profile.interestedInYou) return
    setMatches((current) => {
      // profile.quote используется как уникальный идентификатор анкеты (у тестовых
      // данных пока нет отдельного поля id) - не добавляем одно и то же совпадение дважды.
      if (current.some((match) => match.quote === profile.quote)) return current
      return [...current, profile]
    })
  }

  return (
```

Replace with:

```typescript
  return (
```

Find:

```typescript
              <Route element={<AppShell matches={matches} onLike={handleLike} currentUserId={session.user.id} />}>
```

Replace with:

```typescript
              <Route element={<AppShell currentUserId={session.user.id} />}>
```

- [ ] **Step 7: `src/components/FeedScreen.tsx` - own the like-insert function**

Find:

```typescript
import type { ProfileCategory } from '../data/profiles'
```

Replace with:

```typescript
import type { Profile, ProfileCategory } from '../data/profiles'
```

Find:

```typescript
import type { AppOutletContext } from './AppShell'
import { useFeedProfiles } from '../lib/useFeedProfiles'
```

Replace with:

```typescript
import type { AppOutletContext } from './AppShell'
import { useFeedProfiles } from '../lib/useFeedProfiles'
import { supabase } from '../lib/supabase'
```

Find:

```typescript
  const { currentUserId } = useOutletContext<AppOutletContext>()
  const { profiles, loading } = useFeedProfiles(currentUserId)
```

Replace with:

```typescript
  const { currentUserId } = useOutletContext<AppOutletContext>()
  const { profiles, loading } = useFeedProfiles(currentUserId)

  // Сохраняет лайк в базу. ProfileCard сам показывает "лайкнуто" сразу (оптимистично)
  // и откатывает обратно, если это не получилось - здесь только сам поход в базу.
  async function handleLike(profile: Profile) {
    if (!currentUserId) return
    const { error } = await supabase.from('likes').insert({ liker_id: currentUserId, liked_id: profile.id })
    if (error) throw error
  }
```

Find:

```typescript
            {visibleProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
```

Replace with:

```typescript
            {visibleProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} onLike={handleLike} />
            ))}
```

- [ ] **Step 8: `src/components/MessagesScreen.tsx` - use `useMatches`**

Find:

```typescript
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MessageIcon } from './icons'
import { getAgeWord } from '../lib/pluralize'
import type { AppOutletContext } from './AppShell'
import type { Profile } from '../data/profiles'
import { ChatScreen, type ChatMessage } from './ChatScreen'

// Экран "Сообщения". Показывает список совпадений (взаимный лайк), а по клику
// на любое из них - открывает переписку с этим человеком (см. ChatScreen).
export function MessagesScreen() {
  const { matches } = useOutletContext<AppOutletContext>()
```

Replace with:

```typescript
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MessageIcon } from './icons'
import { getAgeWord } from '../lib/pluralize'
import type { AppOutletContext } from './AppShell'
import type { Profile } from '../data/profiles'
import { useMatches } from '../lib/useMatches'
import { ChatScreen, type ChatMessage } from './ChatScreen'

// Экран "Сообщения". Показывает список совпадений (взаимный лайк), а по клику
// на любое из них - открывает переписку с этим человеком (см. ChatScreen).
export function MessagesScreen() {
  const { currentUserId } = useOutletContext<AppOutletContext>()
  const { matches, loading } = useMatches(currentUserId)
```

Find:

```typescript
      {matches.length === 0 ? (
```

Replace with:

```typescript
      {loading ? (
        <p className="text-center text-sm text-fly-gray py-10">Загружаем совпадения…</p>
      ) : matches.length === 0 ? (
```

- [ ] **Step 9: Typecheck and run tests**

Run: `npm run build && npm run test`
Expected: both succeed.

- [ ] **Step 10: Commit**

```bash
git add src/data/profiles.ts src/lib/useFeedProfiles.ts src/lib/useMatches.ts \
  src/components/ProfileCard.tsx src/components/AppShell.tsx src/App.tsx \
  src/components/FeedScreen.tsx src/components/MessagesScreen.tsx
git commit -m "Persist likes and compute real matches"
```

---

### Task 3 (human, not automatable): End-to-end verification with two accounts

**Files:** none.

**Why it can't be a subagent task:** requires two real email inboxes for two separate magic-link logins.

- [ ] **Step 1: One-sided like**

Account A likes account B's card in the feed. Confirm the heart shows filled/liked immediately. Check "Сообщения" on account A: still no match (B hasn't liked back). Check account B: no match either.

- [ ] **Step 2: Mutual like completes the match**

Account B likes account A's card. Now check "Сообщения" on both accounts: each should see the other in their matches list.

- [ ] **Step 3: Persisted like state survives reload**

Reload account A's page, open the feed again: B's card should already show the heart filled (not reset), and clicking it again should do nothing (no error, no duplicate).

---

## Self-Review Notes

- **Spec coverage:** `likes` table + RLS (Task 1), `likedByMe` on the feed, `useMatches`, persisted/guarded like button, and the `App.tsx`/`AppShell` simplification (Task 2), two-account manual verification (Task 3). All spec sections covered, including the explicit "no unlike", "no error text on the like button", and "don't touch chat message persistence" constraints.
- **Placeholder scan:** none — every step has literal code, SQL, or manual actions.
- **Type consistency:** `Profile.likedByMe: boolean` (Step 1) is set by both `useFeedProfiles` (Step 2, computed from the user's own outgoing likes) and `useMatches` (Step 3, always `true`), and read by `ProfileCard` (Step 4) as the initial `liked` state. `ProfileCardProps.onLike` becomes `(profile: Profile) => Promise<void>` (Step 4), matching `FeedScreen`'s `handleLike` (Step 7), which is `async` and `throw`s on error exactly like `ProfileCard`'s `catch` expects. `AppOutletContext`/`AppShellProps` shrink to `{ currentUserId: string }` consistently across `AppShell.tsx` (Step 5), `App.tsx` (Step 6), `FeedScreen.tsx` (Step 7, unchanged usage), and `MessagesScreen.tsx` (Step 8, new usage).
