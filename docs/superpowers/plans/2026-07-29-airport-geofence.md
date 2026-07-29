# Airport Geofence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the feed and first-time publish screen behind a real check that the person is physically near Sheremetyevo airport (SVO), using the browser's built-in Geolocation API — the one piece of this project's original concept ("works only inside the airport") that hasn't been technically enforced yet.

**Architecture:** A pure distance function (`getDistanceKm`, Haversine formula) compares the browser-reported position against hardcoded SVO coordinates (already used elsewhere in the codebase for weather). A hook (`useAirportPresence`) wraps `navigator.geolocation.getCurrentPosition` in React state with five possible outcomes. A new guard component (`RequireAirport`, sibling to the existing `RequireStatus` guard) wraps only the feed route and the first-time `/new` publish screen — messages and account stay reachable from anywhere, per the design decision.

**Tech Stack:** Browser `navigator.geolocation` (built-in, no library). No new npm packages.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-29-airport-geofence-design.md`.
- Airport coordinates and radius live in one place (`src/data/airport.ts`) — `src/lib/liveContext.ts`'s existing hardcoded SVO constants get replaced with an import from there, not duplicated.
- One-shot check per screen visit, not continuous tracking (`getCurrentPosition`, not `watchPosition`) — matches the "check on open" pattern already used for the feed and matches in this project.
- Only the feed (`/`) and the first-time `/new` publish screen require being near the airport. `MessagesScreen`, `AccountScreen` (including the post/profile edit views inside it), login, and profile setup are unaffected.
- No in-app "pretend I'm at the airport" bypass — testing happens via the browser's own DevTools geolocation override (Chrome: Sensors → Location), a standard developer tool, not app code.
- `getDistanceKm` is pure logic and gets a real vitest test (TDD, same pattern as `getAgeWord`); the geolocation-dependent parts have no automated test, same reasoning as every Supabase-network piece so far (this one's un-testable without faking browser APIs, and DevTools override is the standard manual path).

---

### Task 1: `getDistanceKm` — pure distance calculation

**Files:**
- Create: `src/lib/geo.ts`
- Test: `src/lib/geo.test.ts`

**Interfaces:**
- Produces: `getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number` (kilometers). Task 3's `useAirportPresence` imports this.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/geo.test.ts
import { describe, expect, it } from 'vitest'
import { getDistanceKm } from './geo'

describe('getDistanceKm', () => {
  it('returns 0 for the same point', () => {
    expect(getDistanceKm(55.9736, 37.4125, 55.9736, 37.4125)).toBe(0)
  })

  it('returns roughly the known distance between Moscow and Saint Petersburg (~630-640 km)', () => {
    const distance = getDistanceKm(55.7558, 37.6173, 59.9343, 30.3351)
    expect(distance).toBeGreaterThan(600)
    expect(distance).toBeLessThan(660)
  })

  it('returns a small distance for two nearby points', () => {
    const distance = getDistanceKm(55.9736, 37.4125, 55.9746, 37.4135)
    expect(distance).toBeLessThan(2)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: FAIL — `Cannot find module './geo'`.

- [ ] **Step 3: Implement**

```typescript
// src/lib/geo.ts
// Формула гаверсинуса - стандартный способ посчитать расстояние между двумя
// точками на земном шаре по широте/долготе (в километрах). Используется, чтобы
// проверить, находится ли человек рядом с аэропортом (см. useAirportPresence.ts).

export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const EARTH_RADIUS_KM = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts src/lib/geo.test.ts
git commit -m "Add getDistanceKm (Haversine distance) utility"
```

---

### Task 2: Single source of truth for the airport's coordinates

**Files:**
- Create: `src/data/airport.ts`
- Modify: `src/lib/liveContext.ts`

**Interfaces:**
- Produces: `AIRPORT: { code: string; name: string; latitude: number; longitude: number; radiusKm: number }`. Task 3's `useAirportPresence` and `NotAtAirportScreen` import this.

- [ ] **Step 1: Create `src/data/airport.ts`**

```typescript
// Аэропорт, для которого сейчас работает приложение. Один захардкоженный
// аэропорт - осознанный выбор для этого шага (см.
// docs/superpowers/specs/2026-07-29-airport-geofence-design.md): весь проект
// с самого начала неявно рассчитан на Шереметьево (SVO) - те же координаты
// уже использовались в liveContext.ts для погоды. Список из нескольких
// аэропортов - отдельная задача на будущее, не в этом куске (YAGNI).
export const AIRPORT = {
  code: 'SVO',
  name: 'Шереметьево',
  latitude: 55.9736,
  longitude: 37.4125,
  // Радиус, в который должен попасть человек, чтобы считаться "в аэропорту" -
  // весь комплекс терминалов Шереметьево укладывается в это расстояние от
  // центральной точки, при этом ближайший город (Химки) уже снаружи.
  radiusKm: 5,
}
```

- [ ] **Step 2: Point `liveContext.ts` at it instead of its own constants**

Find:

```typescript
// Координаты аэропорта Шереметьево (SVO) — захардкожены, так как приложение
// пока не определяет геолокацию человека (см. design-спеку фичи)
const SVO_LATITUDE = 55.9736
const SVO_LONGITUDE = 37.4125
```

Replace with:

```typescript
```

(delete these lines entirely — the coordinates now live in `src/data/airport.ts`)

Find:

```typescript
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${SVO_LATITUDE}` +
      `&longitude=${SVO_LONGITUDE}&current=temperature_2m,weather_code`
```

Replace with:

```typescript
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${AIRPORT.latitude}` +
      `&longitude=${AIRPORT.longitude}&current=temperature_2m,weather_code`
```

Find (top of file, first line after the file comment):

```typescript
export type TimeOfDay = 'утро' | 'день' | 'вечер' | 'ночь'
```

Replace with:

```typescript
import { AIRPORT } from '../data/airport'

export type TimeOfDay = 'утро' | 'день' | 'вечер' | 'ночь'
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: succeeds (this file has no test today, per the project's existing pattern for network-dependent code — `getLiveContext` itself isn't tested, only confirm it still compiles and the two usages of the old constants are gone).

- [ ] **Step 4: Commit**

```bash
git add src/data/airport.ts src/lib/liveContext.ts
git commit -m "Move airport coordinates to a single shared location"
```

---

### Task 3: Wire the geolocation gate into the app

**Files:**
- Create: `src/lib/useAirportPresence.ts`
- Create: `src/components/NotAtAirportScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getDistanceKm` (Task 1), `AIRPORT` (Task 2).
- Produces: `AirportPresenceStatus = 'checking' | 'at-airport' | 'not-at-airport' | 'permission-denied' | 'unsupported' | 'error'`, `useAirportPresence(): { status: AirportPresenceStatus; distanceKm: number | null; retry: () => void }`. `NotAtAirportScreenProps = { status: AirportPresenceStatus; distanceKm: number | null; onRetry: () => void }`.

- [ ] **Step 1: Create `src/lib/useAirportPresence.ts`**

```typescript
// Хук, который проверяет, находится ли человек рядом с аэропортом (см.
// src/data/airport.ts) - через встроенный в браузер geolocation API (тот же,
// которым пользуются карты и погодные сайты, писать свой не нужно). Проверка
// одноразовая при каждом вызове retry() - не следит за местоположением
// постоянно, пока экран открыт (тот же принцип "проверяем при открытии", что
// уже выбран для ленты/совпадений в этом проекте).

import { useEffect, useState } from 'react'
import { getDistanceKm } from './geo'
import { AIRPORT } from '../data/airport'

export type AirportPresenceStatus =
  | 'checking'
  | 'at-airport'
  | 'not-at-airport'
  | 'permission-denied'
  | 'unsupported'
  | 'error'

export function useAirportPresence(): {
  status: AirportPresenceStatus
  distanceKm: number | null
  retry: () => void
} {
  const [status, setStatus] = useState<AirportPresenceStatus>('checking')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus('checking')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = getDistanceKm(
          position.coords.latitude,
          position.coords.longitude,
          AIRPORT.latitude,
          AIRPORT.longitude,
        )
        setDistanceKm(distance)
        setStatus(distance <= AIRPORT.radiusKm ? 'at-airport' : 'not-at-airport')
      },
      (positionError) => {
        setStatus(positionError.code === positionError.PERMISSION_DENIED ? 'permission-denied' : 'error')
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }, [attempt])

  return { status, distanceKm, retry: () => setAttempt((current) => current + 1) }
}
```

- [ ] **Step 2: Create `src/components/NotAtAirportScreen.tsx`**

```typescript
// Экран "не в аэропорту" - показывается вместо ленты/первой публикации, если
// проверка геолокации (см. useAirportPresence.ts) не подтвердила, что человек
// сейчас в Шереметьево. Полноэкранный вид, по образцу LoginScreen.tsx - без
// строки статуса и нижней навигации.

import { AIRPORT } from '../data/airport'
import type { AirportPresenceStatus } from '../lib/useAirportPresence'

interface NotAtAirportScreenProps {
  status: AirportPresenceStatus
  distanceKm: number | null
  onRetry: () => void
}

export function NotAtAirportScreen({ status, distanceKm, onRetry }: NotAtAirportScreenProps) {
  return (
    <div className="h-full w-full bg-white flex flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="text-2xl font-semibold">
        Fl<span className="text-fly-blue-deep">y</span>
      </div>
      <p className="text-sm text-fly-gray leading-relaxed">{getText(status, distanceKm)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="w-full max-w-xs py-3.5 rounded-fly-md bg-fly-ink text-white font-semibold text-sm"
      >
        Проверить снова
      </button>
    </div>
  )
}

function getText(status: AirportPresenceStatus, distanceKm: number | null): string {
  if (status === 'permission-denied') {
    return 'Нужен доступ к местоположению, чтобы проверить, что вы в аэропорту. Разрешите его в настройках сайта в браузере и попробуйте снова.'
  }
  if (status === 'unsupported') {
    return 'Ваш браузер не поддерживает определение местоположения, а без него нельзя проверить, что вы в аэропорту.'
  }
  if (status === 'not-at-airport') {
    const distanceText =
      distanceKm !== null ? ` Судя по всему, вы примерно в ${Math.round(distanceKm)} км от него.` : ''
    return `Это приложение работает только в аэропорту ${AIRPORT.name} (${AIRPORT.code}).${distanceText}`
  }
  return 'Не получилось определить местоположение. Проверьте подключение к интернету и попробуйте снова.'
}
```

- [ ] **Step 3: Wire it into `src/App.tsx`**

Find:

```typescript
import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { FeedScreen } from './components/FeedScreen'
import { MessagesScreen } from './components/MessagesScreen'
import { AccountScreen } from './components/AccountScreen'
import { AppShell } from './components/AppShell'
import { CreateStatusScreen } from './components/CreateStatusScreen'
import { DevicePreview } from './components/DevicePreview'
import { LoginScreen } from './components/LoginScreen'
import { ProfileSetupScreen } from './components/ProfileSetupScreen'
import { useSession } from './lib/useSession'
import { supabase } from './lib/supabase'
import type { ProfileCategory } from './data/profiles'
import type { HobbyId } from './data/hobbies'
```

Replace with:

```typescript
import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { FeedScreen } from './components/FeedScreen'
import { MessagesScreen } from './components/MessagesScreen'
import { AccountScreen } from './components/AccountScreen'
import { AppShell } from './components/AppShell'
import { CreateStatusScreen } from './components/CreateStatusScreen'
import { DevicePreview } from './components/DevicePreview'
import { LoginScreen } from './components/LoginScreen'
import { ProfileSetupScreen } from './components/ProfileSetupScreen'
import { NotAtAirportScreen } from './components/NotAtAirportScreen'
import { useSession } from './lib/useSession'
import { useAirportPresence } from './lib/useAirportPresence'
import { supabase } from './lib/supabase'
import type { ProfileCategory } from './data/profiles'
import type { HobbyId } from './data/hobbies'
```

Find:

```typescript
function RequireStatus({ hasPosted }: { hasPosted: boolean }) {
  if (!hasPosted) return <Navigate to="/new" replace />
  return <Outlet />
}
```

Replace with:

```typescript
function RequireStatus({ hasPosted }: { hasPosted: boolean }) {
  if (!hasPosted) return <Navigate to="/new" replace />
  return <Outlet />
}

// RequireAirport — второй "охранник", но не редиректит (тут некуда - это не
// отдельный маршрут, а состояние прямо на месте): проверяет геолокацию и либо
// показывает то, что ему передали (children), либо NotAtAirportScreen с понятным
// объяснением. Оборачивает только ленту и первую публикацию - см. design-спеку
// "Что именно требует нахождения в аэропорту" (2026-07-29-airport-geofence-design.md).
function RequireAirport({ children }: { children: ReactNode }) {
  const { status, distanceKm, retry } = useAirportPresence()
  if (status === 'checking') return <div className="h-full w-full bg-white" />
  if (status !== 'at-airport') {
    return <NotAtAirportScreen status={status} distanceKm={distanceKm} onRetry={retry} />
  }
  return <>{children}</>
}
```

Find:

```typescript
            <Route
              path="/new"
              element={hasPosted ? <Navigate to="/" replace /> : <CreateStatusScreen onSubmit={handlePublish} />}
            />
            <Route element={<RequireStatus hasPosted={hasPosted} />}>
              <Route element={<AppShell currentUserId={session.user.id} />}>
                <Route index element={<FeedScreen />} />
                <Route path="messages" element={<MessagesScreen />} />
                <Route path="account" element={<AccountScreen />} />
              </Route>
            </Route>
```

Replace with:

```typescript
            <Route
              path="/new"
              element={
                hasPosted ? (
                  <Navigate to="/" replace />
                ) : (
                  <RequireAirport>
                    <CreateStatusScreen onSubmit={handlePublish} />
                  </RequireAirport>
                )
              }
            />
            <Route element={<RequireStatus hasPosted={hasPosted} />}>
              <Route element={<AppShell currentUserId={session.user.id} />}>
                <Route
                  index
                  element={
                    <RequireAirport>
                      <FeedScreen />
                    </RequireAirport>
                  }
                />
                <Route path="messages" element={<MessagesScreen />} />
                <Route path="account" element={<AccountScreen />} />
              </Route>
            </Route>
```

- [ ] **Step 4: Typecheck and run tests**

Run: `npm run build && npm run test`
Expected: both succeed, all vitest tests (including the new `geo.test.ts`) pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useAirportPresence.ts src/components/NotAtAirportScreen.tsx src/App.tsx
git commit -m "Gate the feed and first publish behind an airport geofence check"
```

---

### Task 4 (human, not automatable): Verify with a real browser location override

**Files:** none — manual verification using Chrome DevTools.

**Why it can't be a subagent task:** Playwright's headless browser doesn't have visible DevTools for the human to interact with, and this needs an authenticated real session anyway (matched to a real logged-in account with a profile).

- [ ] **Step 1: Confirm "at the airport" works**

Open the app in Chrome, DevTools → More tools → Sensors → Location → "Other…" → enter latitude `55.9736`, longitude `37.4125` (or pick a nearby preset if Chrome ever adds one). Reload. Expected: feed loads normally (after the browser's own location-permission prompt is accepted).

- [ ] **Step 2: Confirm "not at the airport" is blocked with a clear message**

In the same Sensors panel, change location to central Moscow (`55.7558`, `37.6173`) or any far-away city. Reload. Expected: instead of the feed, see "Это приложение работает только в аэропорту Шереметьево (SVO)..." with an approximate distance and a "Проверить снова" button. Confirm Messages and Account are still reachable via the bottom nav (not blocked).

- [ ] **Step 3: Confirm the permission-denied path**

In Chrome's site settings (or DevTools → Sensors, if it exposes a "denied" simulation) block location access for the site. Reload. Expected: the "Нужен доступ к местоположению..." message, not a blank screen or a crash.

---

## Self-Review Notes

- **Spec coverage:** distance math (Task 1), single source of truth for airport coordinates + `liveContext.ts` cleanup (Task 2), the hook + screen + route wiring covering all five presence states and the "only feed + first publish" scoping (Task 3), manual verification of all three practical states — at airport, far away, permission denied (Task 4). All spec sections covered.
- **Placeholder scan:** none — every step has literal code or literal DevTools actions.
- **Type consistency:** `AirportPresenceStatus` is defined once in `useAirportPresence.ts` (Task 3, Step 1) and imported by `NotAtAirportScreen.tsx` (Step 2) and used structurally by `RequireAirport` in `App.tsx` (Step 3) — no duplicate definitions. `AIRPORT`'s shape (Task 2) matches every place that reads `.latitude`/`.longitude`/`.radiusKm`/`.name`/`.code`.
