# Google Sign-In via Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's in-memory-only "logged in or not" state with a real login, using Supabase Auth's built-in Google sign-in — the first of four planned backend sub-projects.

**Architecture:** One small hook (`useSession`) tracks login state via Supabase's `onAuthStateChange`; `App.tsx` branches on that state to show a login screen, a blank loading frame, or (unchanged) the existing app. No new backend code — Supabase Auth handles the OAuth flow entirely.

**Tech Stack:** React 19 + TypeScript (existing), `@supabase/supabase-js` (already installed and wired up in `src/lib/supabase.ts`).

## Global Constraints

- Никаких новых npm-зависимостей — `@supabase/supabase-js` уже установлен.
- Никаких автотестов в этой фиче — она зависит от живого внешнего сервиса (Google), а не от наших данных (решено при обсуждении дизайна). Проверка только руками в браузере.
- Механика «сначала заметка, потом лента» (`RequireStatus`, `hasPosted`) не меняется вообще — вход просто становится дополнительным условием ещё раньше.
- Комментарии в коде — подробные, на русском языке.
- Настройка Google-провайдера в Google Cloud Console и панели Supabase — ручной шаг пользователя вне кода, план его не покрывает (см. спеку, раздел «Настройка Google-входа»).

---

### Task 1: `src/lib/useSession.ts` — отслеживание входа

**Files:**
- Create: `src/lib/useSession.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`.
- Produces: `export function useSession(): { session: Session | null; loading: boolean }` — used by Task 3.

- [ ] **Step 1: Write the file**

```typescript
// Небольшой хук (переиспользуемый кусок логики React), который следит за тем,
// вошёл ли человек в аккаунт. Ничего не знает про экраны - просто сообщает
// текущее состояние входа.

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange сам присылает текущее состояние сразу при подписке
    // (событие INITIAL_SESSION), а дальше сообщает о каждом входе/выходе -
    // отдельный запрос "проверь, есть ли сессия" не нужен.
    const { data } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/useSession.ts
git commit -m "$(cat <<'EOF'
Add useSession hook to track Supabase Auth login state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `src/components/LoginScreen.tsx` — экран входа

**Files:**
- Create: `src/components/LoginScreen.tsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`.
- Produces: `export function LoginScreen(): JSX.Element` — used by Task 3.

- [ ] **Step 1: Write the file**

```tsx
// Экран входа - показывается, когда человек ещё не вошёл в аккаунт.
// Единственное действие - кнопка "Войти через Google". Дальше весь процесс
// (переход на страницу Google, подтверждение, возврат в приложение с готовым
// входом) делает сама библиотека supabase-js - дополнительного кода не нужно.

import { supabase } from '../lib/supabase'

export function LoginScreen() {
  function handleGoogleSignIn() {
    void supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="h-full w-full bg-white flex flex-col items-center justify-center gap-6 px-8">
      <div className="text-2xl font-semibold">
        Fl<span className="text-fly-blue-deep">y</span>
      </div>
      <p className="text-sm text-fly-gray text-center leading-relaxed">
        Чтобы продолжить, войдите через свой Google-аккаунт
      </p>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full max-w-xs py-3.5 rounded-fly-md bg-fly-ink text-white font-semibold text-sm"
      >
        Войти через Google
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/LoginScreen.tsx
git commit -m "$(cat <<'EOF'
Add LoginScreen with Google sign-in button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Gate the app behind login in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useSession` from Task 1; `LoginScreen` from Task 2.

- [ ] **Step 1: Add the imports**

Find this line:

```typescript
import { DevicePreview } from './components/DevicePreview'
```

Replace with:

```typescript
import { DevicePreview } from './components/DevicePreview'
import { LoginScreen } from './components/LoginScreen'
import { useSession } from './lib/useSession'
```

- [ ] **Step 2: Read the session state at the top of `App`**

Find this line:

```typescript
function App() {
  const [hasPosted, setHasPosted] = useState(false)
```

Replace with:

```typescript
function App() {
  const { session, loading } = useSession()
  const [hasPosted, setHasPosted] = useState(false)
```

- [ ] **Step 3: Branch on session state around the existing `HashRouter`**

Find this block:

```tsx
  return (
    <DevicePreview>
      {/*
        HashRouter, а не BrowserRouter: маршруты хранятся после знака "#" в адресе
        (например, .../#/messages), а не в самом пути страницы. Это специально нужно,
        когда сайт может открыться по любому, заранее неизвестному адресу (например,
        опубликованный снимок на claude.ai) - роутер тогда не зависит от того,
        по какому именно пути его открыли.
      */}
      <HashRouter>
        <Routes>
          {/*
            Если заметка уже опубликована, а человек всё равно зашёл на /new (например, по старой
            ссылке) - сразу отправляем его в ленту. Это же условие само сработает и сразу после
            публикации: hasPosted меняется -> App перерисовывается -> элемент маршрута пересчитывается.
          */}
          <Route
            path="/new"
            element={hasPosted ? <Navigate to="/" replace /> : <CreateStatusScreen onSubmit={handlePublish} />}
          />
          <Route element={<RequireStatus hasPosted={hasPosted} />}>
            <Route element={<AppShell matches={matches} onLike={handleLike} />}>
              <Route index element={<FeedScreen />} />
              <Route path="messages" element={<MessagesScreen />} />
              <Route path="account" element={<AccountScreen />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </DevicePreview>
  )
}
```

Replace with:

```tsx
  return (
    <DevicePreview>
      {loading ? (
        // Проверка входа занимает доли секунды - полноценный экран загрузки не нужен
        <div className="h-full w-full bg-white" />
      ) : !session ? (
        <LoginScreen />
      ) : (
        /*
          HashRouter, а не BrowserRouter: маршруты хранятся после знака "#" в адресе
          (например, .../#/messages), а не в самом пути страницы. Это специально нужно,
          когда сайт может открыться по любому, заранее неизвестному адресу (например,
          опубликованный снимок на claude.ai) - роутер тогда не зависит от того,
          по какому именно пути его открыли.
        */
        <HashRouter>
          <Routes>
            {/*
              Если заметка уже опубликована, а человек всё равно зашёл на /new (например, по старой
              ссылке) - сразу отправляем его в ленту. Это же условие само сработает и сразу после
              публикации: hasPosted меняется -> App перерисовывается -> элемент маршрута пересчитывается.
            */}
            <Route
              path="/new"
              element={hasPosted ? <Navigate to="/" replace /> : <CreateStatusScreen onSubmit={handlePublish} />}
            />
            <Route element={<RequireStatus hasPosted={hasPosted} />}>
              <Route element={<AppShell matches={matches} onLike={handleLike} />}>
                <Route index element={<FeedScreen />} />
                <Route path="messages" element={<MessagesScreen />} />
                <Route path="account" element={<AccountScreen />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      )}
    </DevicePreview>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the app in a fresh browser profile/incognito window (so there's no existing Supabase session saved) at the root URL:
1. You should briefly see a blank white screen, then the login screen with the "Войти через Google" button — not the "Что вы ищете сейчас?" note screen.
2. Click "Войти через Google". Two outcomes are both valid at this stage, depending on whether the Google/Supabase manual setup (see the design spec) is done yet:
   - If it's done: the browser navigates to a real Google sign-in/consent page.
   - If it's not done yet: Supabase returns an error (e.g. "Unsupported provider" or similar) instead of reaching Google. This still confirms the button correctly calls `signInWithOAuth` — the manual setup is a separate, non-code step.
3. Completing an actual Google login (picking an account, approving consent, and landing back in the app logged in) requires your own Google account — do that yourself once the manual setup is done.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
Gate the app behind Google login using useSession/LoginScreen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Working "Выйти" (sign out) button in `AccountScreen.tsx`

**Files:**
- Modify: `src/components/AccountScreen.tsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`.

- [ ] **Step 1: Add the import and the sign-out handler**

Find this line:

```typescript
// Экран "Аккаунт" — пока черновая заглушка. Здесь позже появится редактирование
// своей анкеты, настройки и т.д. Визуальный стиль всего приложения ещё будет меняться
// (см. notes.md), поэтому сейчас это самый простой вариант, без лишних деталей.
export function AccountScreen() {
  return (
```

Replace with:

```typescript
// Экран "Аккаунт" — пока черновая заглушка. Здесь позже появится редактирование
// своей анкеты, настройки и т.д. Визуальный стиль всего приложения ещё будет меняться
// (см. notes.md), поэтому сейчас это самый простой вариант, без лишних деталей.
//
// Единственный по-настоящему рабочий пункт - "Выйти": остальные (Редактировать анкету,
// Кто меня лайкнул и т.д.) пока декоративные, ждут своих кусков бэкенда.
import { supabase } from '../lib/supabase'

export function AccountScreen() {
  function handleSignOut() {
    void supabase.auth.signOut()
  }

  return (
```

- [ ] **Step 2: Render the sign-out button**

Find this block:

```tsx
        {/* Простой список пунктов настроек - пока без действия по клику */}
        <div className="flex flex-col gap-2">
          {['Редактировать анкету', 'Кто меня лайкнул', 'Настройки уведомлений', 'Помощь'].map((item) => (
            <div
              key={item}
              className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink"
            >
              {item}
            </div>
          ))}
        </div>
```

Replace with:

```tsx
        {/* Простой список пунктов настроек - пока без действия по клику */}
        <div className="flex flex-col gap-2">
          {['Редактировать анкету', 'Кто меня лайкнул', 'Настройки уведомлений', 'Помощь'].map((item) => (
            <div
              key={item}
              className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink"
            >
              {item}
            </div>
          ))}

          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink text-left"
          >
            Выйти
          </button>
        </div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 4: Manual verification (requires being logged in)**

After completing the Google setup and logging in once (Task 3's manual step): open "Аккаунт", tap "Выйти" — the app should return to the login screen (`LoginScreen`), and reloading the page should keep showing the login screen (not silently log back in).

- [ ] **Step 5: Commit**

```bash
git add src/components/AccountScreen.tsx
git commit -m "$(cat <<'EOF'
Add working sign-out button to AccountScreen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
