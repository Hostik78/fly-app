# AI Status Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Нужна идея?" (Need an idea?) button to `CreateStatusScreen` that suggests short status phrases — instant template-based ones seeded with real weather/time-of-day, followed by 2-3 AI-generated ones from a Vercel serverless function.

**Architecture:** Four independent, single-purpose modules (live context fetcher, template data, serverless AI endpoint, UI panel) wired together in the last task. Matches the approved design spec at `docs/superpowers/specs/2026-07-23-ai-status-suggestions-design.md`.

**Tech Stack:** React 19 + TypeScript (existing), Vite, Vercel Functions (Node.js runtime, zero-config `api/*.ts`), `@anthropic-ai/sdk`, Open-Meteo (no API key), Vitest (new — first test runner in this repo).

## Global Constraints

- Никаких секретов в коде браузера: ключ Anthropic только в переменных окружения Vercel и `.env.local`, никогда не импортируется в `src/`.
- Погода — Open-Meteo, без API-ключа, координаты Шереметьево (SVO) захардкожены как константа.
- Модель для генерации фраз — `claude-haiku-4-5` (быстрая и дешёвая модель, а не флагманская reasoning-модель — соответствует задаче: короткие креативные фразы, бюджет по времени ~4 секунды).
- Если что-то не отвечает вовремя или возвращает не тот формат — тихий откат к пустому списку/шаблонам, без ошибок на экране (это бонус-фича, не обязательная часть экрана).
- Стиль кода соответствует существующему проекту: подробные комментарии на русском, функциональные React-компоненты, Tailwind-классы с уже существующими токенами (`fly-*`).

---

### Task 1: `src/lib/liveContext.ts` — погода и время суток

**Files:**
- Create: `src/lib/liveContext.ts`

**Interfaces:**
- Produces: `export type TimeOfDay = 'утро' | 'день' | 'вечер' | 'ночь'`; `export interface LiveContext { timeOfDay: TimeOfDay; weather: string | null; temperature: number | null }`; `export function getTimeOfDay(date?: Date): TimeOfDay`; `export async function getLiveContext(): Promise<LiveContext>`.

No automated test for this file (per the approved design spec — the first test in the project covers `suggestionTemplates.ts` only; this file mixes network access, which the spec explicitly leaves untested at this stage). Verify manually in Task 1's last step.

- [ ] **Step 1: Write the file**

```typescript
// Достаёт "живой" контекст для подсказок статуса: погоду и время суток.
// Ничего не знает про интерфейс или категории — просто отдаёт наружу простой объект.
// Погоду запрашивает у Open-Meteo (бесплатный сервис, без API-ключа и регистрации).

export type TimeOfDay = 'утро' | 'день' | 'вечер' | 'ночь'

export interface LiveContext {
  timeOfDay: TimeOfDay
  // null, если погоду не удалось получить (нет интернета, сервис не ответил) —
  // в этом случае шаблоны используют вариант без погоды
  weather: string | null
  temperature: number | null
}

// Координаты аэропорта Шереметьево (SVO) — захардкожены, так как приложение
// пока не определяет геолокацию человека (см. design-спеку фичи)
const SVO_LATITUDE = 55.9736
const SVO_LONGITUDE = 37.4125

// Кэш на время сессии — чтобы не запрашивать погоду заново при каждом открытии панели
let cachedContext: LiveContext | null = null

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours()
  if (hour >= 6 && hour < 12) return 'утро'
  if (hour >= 12 && hour < 18) return 'день'
  if (hour >= 18 && hour < 23) return 'вечер'
  return 'ночь'
}

// Переводит код погоды Open-Meteo в короткое русское слово.
// Коды описаны в документации Open-Meteo (WMO weather codes)
function describeWeatherCode(code: number): string {
  if (code === 0) return 'ясно'
  if (code <= 3) return 'облачно'
  if (code === 45 || code === 48) return 'туман'
  if (code >= 51 && code <= 67) return 'дождь'
  if (code >= 71 && code <= 77) return 'снег'
  if (code >= 80 && code <= 82) return 'ливень'
  if (code >= 95) return 'гроза'
  return 'облачно'
}

export async function getLiveContext(): Promise<LiveContext> {
  if (cachedContext) return cachedContext

  const timeOfDay = getTimeOfDay()

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${SVO_LATITUDE}` +
      `&longitude=${SVO_LONGITUDE}&current=temperature_2m,weather_code`
    const response = await fetch(url)
    if (!response.ok) throw new Error('weather request failed')
    const data = await response.json()
    cachedContext = {
      timeOfDay,
      weather: describeWeatherCode(data.current.weather_code),
      temperature: Math.round(data.current.temperature_2m),
    }
  } catch {
    // Нет интернета или сервис не ответил — работаем без погоды
    cachedContext = { timeOfDay, weather: null, temperature: null }
  }

  return cachedContext
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors mentioning `liveContext.ts`

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the app in a browser, open the browser console, and run:

```js
import('/src/lib/liveContext.ts').then(m => m.getLiveContext().then(console.log))
```

Expected: an object like `{ timeOfDay: 'вечер', weather: 'облачно', temperature: 14 }` (exact values depend on real weather).

- [ ] **Step 4: Commit**

```bash
git add src/lib/liveContext.ts
git commit -m "$(cat <<'EOF'
Add live weather/time-of-day context for status suggestions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `src/data/suggestionTemplates.ts` — шаблоны фраз + первый тест в проекте

**Files:**
- Create: `src/data/suggestionTemplates.ts`
- Create: `src/data/suggestionTemplates.test.ts`
- Modify: `package.json` (add `vitest` devDependency + `test` script)

**Interfaces:**
- Consumes: `LiveContext` type from Task 1 (`src/lib/liveContext.ts`), `ProfileCategory` from `src/data/profiles.ts`.
- Produces: `export function getSuggestions(category: ProfileCategory, context: LiveContext): string[]` — returns exactly 2 strings per category, weather-aware when `context.weather` is set, plain fallback otherwise.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add the test script to `package.json`**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write the failing test**

```typescript
// src/data/suggestionTemplates.test.ts
import { describe, expect, it } from 'vitest'
import { getSuggestions } from './suggestionTemplates'
import { categories } from './categories'
import type { LiveContext } from '../lib/liveContext'

describe('getSuggestions', () => {
  const withWeather: LiveContext = { timeOfDay: 'вечер', weather: 'дождь', temperature: 8 }
  const withoutWeather: LiveContext = { timeOfDay: 'утро', weather: null, temperature: null }

  it('returns two non-empty suggestions for every category', () => {
    for (const { id } of categories) {
      const suggestions = getSuggestions(id, withWeather)
      expect(suggestions).toHaveLength(2)
      for (const text of suggestions) {
        expect(text.length).toBeGreaterThan(0)
      }
    }
  })

  it('mentions the weather and time of day when weather is known', () => {
    const suggestions = getSuggestions('communication', withWeather)
    expect(suggestions.join(' ')).toContain('дождь')
    expect(suggestions.join(' ')).toContain('вечер')
  })

  it('falls back to a weather-free phrasing when weather is unknown', () => {
    const suggestions = getSuggestions('communication', withoutWeather)
    expect(suggestions.join(' ')).not.toContain('null')
    expect(suggestions.join(' ')).toContain('утро')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/data/suggestionTemplates.test.ts`
Expected: FAIL — `Cannot find module './suggestionTemplates'`

- [ ] **Step 5: Write the templates**

```typescript
// src/data/suggestionTemplates.ts
// Шаблоны фраз-подсказок для заметки "Что вы ищете сейчас?", по одной паре
// вариантов (с погодой / без погоды) на категорию. Чистые данные и чистая
// функция подстановки — без побочных эффектов, поэтому легко покрыть тестом.

import type { ProfileCategory } from './profiles'
import type { LiveContext } from '../lib/liveContext'

interface Template {
  withWeather: (weather: string, timeOfDay: string) => string
  withoutWeather: (timeOfDay: string) => string
}

const templates: Record<ProfileCategory, Template[]> = {
  communication: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather} — самое время поболтать, пока жду рейс`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, жду рейс и не прочь поболтать`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, погода — ${weather}, а мне интересно, с кем тут можно поговорить`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, интересно, с кем тут можно поговорить`,
    },
  ],
  romance: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather} — если тоже ждёте рейс и не против знакомства, пишите`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, жду рейс и не против нового знакомства`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, а из-за погоды (${weather}) время тянется медленно — было бы веселее вдвоём`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, время тянется медленно — было бы веселее вдвоём`,
    },
  ],
  hobbies: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, за окном ${weather} — расскажу про свои увлечения, если интересно`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, с радостью расскажу про свои увлечения`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather}, а у меня есть час — обсудим общие интересы?`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, есть час свободного времени — обсудим общие интересы?`,
    },
  ],
  'fellow-travelers': [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather} — если летим в одну сторону, можно скоротать время вместе`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, если летим в одну сторону — можно скоротать время вместе`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, погода — ${weather}, рейс ещё не скоро — ищу попутчика, чтобы не скучать`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, рейс ещё не скоро — ищу попутчика, чтобы не скучать`,
    },
  ],
  networking: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather} — жду рейс и не против обсудить рабочие темы`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, жду рейс и не против обсудить рабочие темы`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, погода — ${weather}, есть время до посадки — расскажу, чем занимаюсь, если интересно`,
      withoutWeather: (timeOfDay) =>
        `Сейчас ${timeOfDay}, есть время до посадки — расскажу, чем занимаюсь, если интересно`,
    },
  ],
  friendship: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, за окном ${weather} — просто хочется с кем-то пообщаться по-дружески`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, просто хочется с кем-то пообщаться по-дружески`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, погода — ${weather}, жду рейс в одиночестве — рядом не помешает дружеская компания`,
      withoutWeather: (timeOfDay) =>
        `Сейчас ${timeOfDay}, жду рейс в одиночестве — рядом не помешает дружеская компания`,
    },
  ],
}

export function getSuggestions(category: ProfileCategory, context: LiveContext): string[] {
  return templates[category].map((template) =>
    context.weather
      ? template.withWeather(context.weather, context.timeOfDay)
      : template.withoutWeather(context.timeOfDay),
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/data/suggestionTemplates.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/data/suggestionTemplates.ts src/data/suggestionTemplates.test.ts
git commit -m "$(cat <<'EOF'
Add status suggestion templates with first test in the project

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `api/suggest.ts` — серверная функция с ИИ-генерацией

**Files:**
- Create: `api/suggest.ts`
- Modify: `package.json` (add `@anthropic-ai/sdk` dependency, `@vercel/node` devDependency)

**Interfaces:**
- Consumes: `POST` body `{ category: string, context: { weather: string | null; temperature: number | null; timeOfDay: string } }`.
- Produces: JSON response `{ suggestions: string[] }` — always HTTP 200, empty array on any failure (per design spec — this is a bonus feature, never show an error to the user).

No automated test for this file (per the approved design spec — it depends on a live network call to Anthropic and isn't covered by the first test pass). Verify manually in the last step.

- [ ] **Step 1: Install dependencies**

```bash
npm install @anthropic-ai/sdk
npm install -D @vercel/node
```

- [ ] **Step 2: Add `ANTHROPIC_API_KEY` to local env**

Manual step (not automatable — this is a secret):
1. Get an Anthropic API key from the Anthropic Console.
2. Add it locally: append `ANTHROPIC_API_KEY=sk-ant-...` to `.env.local`.
3. Add it to Vercel too: `vercel env add ANTHROPIC_API_KEY` (or via the Vercel dashboard → Project → Settings → Environment Variables), so the deployed function can read it.

- [ ] **Step 3: Write the function**

```typescript
// api/suggest.ts
// Серверная функция Vercel (Node.js): по категории и текущему контексту
// (погода + время суток) просит Anthropic API сочинить 2-3 живые, не банальные
// фразы для заметки "Что вы ищете сейчас?". Ключ Anthropic живёт только тут,
// в переменных окружения — никогда не попадает в код браузера.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface SuggestRequestBody {
  category?: string
  context?: {
    weather: string | null
    temperature: number | null
    timeOfDay: string
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ suggestions: [] })
    return
  }

  const { category, context } = req.body as SuggestRequestBody

  if (!category || !context) {
    res.status(400).json({ suggestions: [] })
    return
  }

  const weatherText = context.weather
    ? `сейчас ${context.weather}${context.temperature != null ? `, ${context.temperature}°C` : ''}`
    : 'погода неизвестна'

  try {
    const response = await client.messages.create(
      {
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content:
              `Ты помогаешь человеку в аэропорту написать короткую живую заметку о том, ` +
              `чем он сейчас занят, для категории "${category}". ` +
              `Время суток: ${context.timeOfDay}. Погода: ${weatherText}.\n\n` +
              `Придумай 2-3 коротких (до 12 слов) не банальных фразы от первого лица. ` +
              `Избегай штампов вроде "ищу свою настоящую любовь" или "занимаюсь своей жизнью". ` +
              `Верни ТОЛЬКО JSON-массив строк, без пояснений и без markdown-разметки.`,
          },
        ],
      },
      { timeout: 4000 },
    )

    const textBlock = response.content.find((block) => block.type === 'text')
    const parsed: unknown = JSON.parse(textBlock?.text ?? '[]')
    const suggestions = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []

    res.status(200).json({ suggestions })
  } catch {
    // Таймаут, сетевая ошибка или не тот формат ответа — просто пустой список,
    // без ошибки на экране (см. design-спеку: это бонус, а не обязательная часть)
    res.status(200).json({ suggestions: [] })
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors mentioning `api/suggest.ts`

- [ ] **Step 5: Manual verification**

Run: `vercel dev` (or `npm run dev` if the Vercel CLI proxies `/api` automatically in this project — check `vercel dev` works if not), then in another terminal:

```bash
curl -X POST http://localhost:3000/api/suggest \
  -H "Content-Type: application/json" \
  -d '{"category":"communication","context":{"weather":"дождь","temperature":8,"timeOfDay":"вечер"}}'
```

Expected: `{"suggestions":["...", "..."]}` with 2-3 Russian phrases, within a few seconds.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json api/suggest.ts
git commit -m "$(cat <<'EOF'
Add Vercel function that generates AI status suggestions via Claude Haiku

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `src/components/SuggestionPanel.tsx` — кнопка и панель с подсказками

**Files:**
- Create: `src/components/SuggestionPanel.tsx`
- Modify: `src/components/icons.tsx` (add `SparkleIcon`)

**Interfaces:**
- Consumes: `getLiveContext` from `src/lib/liveContext.ts` (Task 1), `getSuggestions` from `src/data/suggestionTemplates.ts` (Task 2), `POST /api/suggest` from Task 3.
- Produces: `export function SuggestionPanel(props: { category: ProfileCategory; quote: string; onSelect: (text: string) => void }): JSX.Element`.

No automated test for this file (per the approved design spec — UI + network wiring isn't covered by the first test pass). Verify manually in the last step.

- [ ] **Step 1: Add the sparkle icon**

In `src/components/icons.tsx`, add at the end of the file:

```typescript
// Иконка "искорка" — помечает варианты подсказок, по-настоящему сочинённые ИИ
// (в отличие от заготовленных шаблонов)
export function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-3.5 h-3.5 stroke-fly-blue-deep">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
```

- [ ] **Step 2: Write the panel component**

```tsx
// src/components/SuggestionPanel.tsx
// Кнопка "Нужна идея?" и выезжающая снизу панель с подсказками текста заметки
// для CreateStatusScreen. Сначала мгновенно показывает шаблонные фразы
// (с реальной погодой/временем суток), потом асинхронно дорисовывает
// 1-2 варианта, по-настоящему сочинённых ИИ (помечены искоркой).
//
// Ничего не знает о внутренностях liveContext/suggestionTemplates — только
// вызывает их и рисует результат. Закрывается сама, если человек начинает
// печатать вручную (меняется проп quote не из-за выбора подсказки).

import { useEffect, useRef, useState } from 'react'
import { getLiveContext } from '../lib/liveContext'
import { getSuggestions } from '../data/suggestionTemplates'
import type { ProfileCategory } from '../data/profiles'
import { SparkleIcon } from './icons'

interface SuggestionPanelProps {
  category: ProfileCategory
  quote: string
  onSelect: (text: string) => void
}

export function SuggestionPanel({ category, quote, onSelect }: SuggestionPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [instant, setInstant] = useState<string[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  // Когда true, следующее изменение quote вызвано выбором подсказки, а не
  // ручным вводом — панель не должна закрываться сама по себе от этого
  const skipCloseRef = useRef(false)

  // Панель закрывается сама, если человек продолжил печатать вручную
  useEffect(() => {
    if (skipCloseRef.current) {
      skipCloseRef.current = false
      return
    }
    setIsOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote])

  async function handleToggle() {
    if (isOpen) {
      setIsOpen(false)
      return
    }

    setIsOpen(true)
    setAiSuggestions([])

    const context = await getLiveContext()
    setInstant(getSuggestions(category, context))

    setAiLoading(true)
    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, context }),
      })
      const data = await response.json()
      setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch {
      setAiSuggestions([])
    } finally {
      setAiLoading(false)
    }
  }

  function handlePick(text: string) {
    skipCloseRef.current = true
    onSelect(text)
    setIsOpen(false)
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-fly-blue-deep"
      >
        <SparkleIcon />
        Нужна идея?
      </button>

      {isOpen && (
        <div className="mt-2 flex flex-col gap-2 bg-[#F4F5F8] rounded-fly-md p-3">
          {instant.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => handlePick(text)}
              className="text-left text-sm text-fly-ink bg-white rounded-fly-md px-3 py-2"
            >
              {text}
            </button>
          ))}

          {aiSuggestions.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => handlePick(text)}
              className="text-left text-sm text-fly-ink bg-white rounded-fly-md px-3 py-2 flex items-start gap-1.5"
            >
              <span className="mt-0.5 flex-shrink-0">
                <SparkleIcon />
              </span>
              {text}
            </button>
          ))}

          {aiLoading && (
            <p className="text-xs text-fly-gray px-1">Придумываю ещё варианты…</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors mentioning `SuggestionPanel.tsx` or `icons.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/components/SuggestionPanel.tsx src/components/icons.tsx
git commit -m "$(cat <<'EOF'
Add SuggestionPanel component with instant and AI-generated suggestions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire `SuggestionPanel` into `CreateStatusScreen`

**Files:**
- Modify: `src/components/CreateStatusScreen.tsx`

**Interfaces:**
- Consumes: `SuggestionPanel` from Task 4.

- [ ] **Step 1: Add the import**

In `src/components/CreateStatusScreen.tsx`, add near the top:

```typescript
import { SuggestionPanel } from './SuggestionPanel'
```

- [ ] **Step 2: Render the panel under the textarea**

Find this block (currently right after the `<textarea>`):

```tsx
        <textarea
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          placeholder="Например: жду посадку у 14 гейта, есть час свободного времени..."
          rows={4}
          className="mt-6 w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue resize-none"
        />
```

Replace it with:

```tsx
        <textarea
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          placeholder="Например: жду посадку у 14 гейта, есть час свободного времени..."
          rows={4}
          className="mt-6 w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue resize-none"
        />

        <SuggestionPanel category={category} quote={quote} onSelect={setQuote} />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 4: Manual verification (golden path + edge case)**

Run: `npm run dev`, open `CreateStatusScreen` in the browser (it's the screen shown before publishing a status):
1. Tap "Нужна идея?" — 2 template phrases should appear immediately, followed within a couple seconds by 1-2 sparkle-marked AI phrases (or the panel just stays at 2 if the AI call fails — that's expected, not a bug).
2. Tap one phrase — it should fill the textarea and the panel should close.
3. Reopen the panel, then start typing manually in the textarea instead of picking a suggestion — the panel should close on the first keystroke.
4. Switch category, reopen the panel — the instant phrases should match the new category.

- [ ] **Step 5: Commit**

```bash
git add src/components/CreateStatusScreen.tsx
git commit -m "$(cat <<'EOF'
Wire SuggestionPanel into CreateStatusScreen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
