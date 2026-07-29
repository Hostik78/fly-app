# Persist Chat Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save chat messages to the database (instead of only `MessagesScreen`'s in-memory state) so conversations survive a reload, gated by a real mutual-match check enforced in the database itself.

**Architecture:** A new `messages` table (sender/recipient, RLS restricted to participants for reading and to verified mutual-likers for inserting). A new `useConversation(currentUserId, otherUserId)` hook loads the two-way message history and exposes `sendMessage`. `ChatScreen` now owns its own data (via `useOutletContext` for `currentUserId`, matching the pattern every other screen already uses), dropping the `messages`/`onSend` props it used to get from `MessagesScreen`. `MessagesScreen` drops the in-memory `messagesByMatch` state entirely and shows each match's own post quote as the list preview instead of a "last message" (avoiding an extra per-match query).

**Tech Stack:** `@supabase/supabase-js` (already installed), Supabase CLI (already linked). No new npm packages.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-29-persist-messages-design.md`.
- No read/unread tracking, no live-updating chat while sitting in it (fetch once per screen open, same as feed/matches) — both explicitly out of scope per the spec.
- The `messages_insert_if_matched` RLS policy must check mutual likes in both directions — sending is a real security boundary, not just a UI gate.
- Schema changes apply via the linked Supabase CLI.
- Apply the `LESSONS.md` grants lesson: `revoke all on public.messages from anon, authenticated;` before granting the intended `select, insert`.
- No automated tests for the Supabase-network parts (same reasoning as every prior backend piece).

---

### Task 1: Create the `messages` table

**Files:**
- Create: `supabase/migrations/<timestamp>_create_messages_table.sql`

- [ ] **Step 1: Create the migration**

```bash
supabase migration new create_messages_table
```

- [ ] **Step 2: Fill it in**

```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

alter table public.messages enable row level security;

-- Видно сообщения, где я отправитель или получатель
create policy "messages_select_own" on public.messages
  for select
  to authenticated
  using ( (select auth.uid()) = sender_id or (select auth.uid()) = recipient_id );

-- Писать можно только от своего имени, и только тому, с кем есть настоящее
-- взаимное совпадение - проверка прямо в базе, не только в интерфейсе.
create policy "messages_insert_if_matched" on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (select 1 from public.likes where liker_id = sender_id and liked_id = recipient_id)
    and exists (select 1 from public.likes where liker_id = recipient_id and liked_id = sender_id)
  );

revoke all on public.messages from anon, authenticated;
grant select, insert on public.messages to authenticated;
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
PGPASSWORD="$SUPABASE_DB_PASSWORD" /opt/homebrew/opt/libpq/bin/psql "$CONN" -c "\d public.messages"
PGPASSWORD="$SUPABASE_DB_PASSWORD" /opt/homebrew/opt/libpq/bin/psql "$CONN" -c "select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='messages' and grantee in ('anon','authenticated') order by 1,2;"
```

Expected: table with the right columns, both RLS policies, grants show only `authenticated`/`SELECT` and `authenticated`/`INSERT`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "Create messages table"
```

---

### Task 2: Wire real message persistence into the chat

**Files:**
- Create: `src/lib/useConversation.ts`
- Modify: `src/components/ChatScreen.tsx`
- Modify: `src/components/MessagesScreen.tsx`

**Interfaces:**
- Produces: `ChatMessage` (moves from `ChatScreen.tsx` to `useConversation.ts` — the data-shape type now lives with the data-fetching hook, not the component). `useConversation(currentUserId: string | undefined, otherUserId: string | undefined): { messages: ChatMessage[]; loading: boolean; sendMessage: (text: string) => Promise<void> }`.
- Consumes: `AppOutletContext` (`currentUserId`) from `src/components/AppShell.tsx` (unchanged from the previous piece).

- [ ] **Step 1: Create `src/lib/useConversation.ts`**

```typescript
// Хук переписки с одним конкретным человеком: грузит существующие сообщения между
// двумя людьми (в обе стороны, по created_at) и даёт функцию отправки нового.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Одно сообщение в переписке. from: 'them' - от собеседника, 'me' - от вас.
export interface ChatMessage {
  id: string
  text: string
  from: 'me' | 'them'
}

export function useConversation(
  currentUserId: string | undefined,
  otherUserId: string | undefined,
): { messages: ChatMessage[]; loading: boolean; sendMessage: (text: string) => Promise<void> } {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUserId || !otherUserId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    supabase
      .from('messages')
      .select('id, sender_id, text, created_at')
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`,
      )
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setMessages(
            (data ?? []).map((row) => ({
              id: row.id,
              text: row.text,
              from: row.sender_id === currentUserId ? 'me' : 'them',
            })),
          )
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentUserId, otherUserId])

  async function sendMessage(text: string) {
    if (!currentUserId || !otherUserId) return
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: currentUserId, recipient_id: otherUserId, text })
      .select('id, text')
      .single()
    if (error) throw error
    setMessages((current) => [...current, { id: data.id, text: data.text, from: 'me' }])
  }

  return { messages, loading, sendMessage }
}
```

- [ ] **Step 2: Rewrite `src/components/ChatScreen.tsx`**

```typescript
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Profile } from '../data/profiles'
import { getIcebreakers } from '../data/icebreakers'
import { getAgeWord } from '../lib/pluralize'
import { useConversation, type ChatMessage } from '../lib/useConversation'
import type { AppOutletContext } from './AppShell'
import { BackArrowIcon, SendIcon } from './icons'

interface ChatScreenProps {
  match: Profile
  onBack: () => void
}

// Экран переписки с одним конкретным совпадением. Это не отдельный маршрут,
// а вид, который MessagesScreen показывает вместо списка, когда выбрано совпадение -
// так проще, чем заводить новый URL-путь ради одного экрана.
export function ChatScreen({ match, onBack }: ChatScreenProps) {
  const { currentUserId } = useOutletContext<AppOutletContext>()
  const { messages: dbMessages, loading, sendMessage } = useConversation(currentUserId, match.id)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const genderLetter = match.gender === 'female' ? 'Ж' : match.gender === 'male' ? 'М' : '?'
  const avatarColor = match.gender === 'female' ? 'bg-fly-coral' : 'bg-fly-blue-deep'

  // Пока не загрузили - список пуст (не мигаем заглушкой раньше времени). Если
  // загрузили и настоящих сообщений нет - показываем фразу из анкеты как будто
  // это первое сообщение (не сохраняется в базу, только для показа).
  const messages: ChatMessage[] = loading
    ? []
    : dbMessages.length > 0
      ? dbMessages
      : [{ id: 'seed', text: match.quote, from: 'them' }]

  // Подсказки для начала разговора - только для категории "Увлечения" с известным
  // хобби, и только пока человек ещё не написал в этот чат ни одного сообщения сам.
  const hasSentMessage = messages.some((message) => message.from === 'me')
  const icebreakers =
    !hasSentMessage && match.category === 'hobbies' && match.hobby ? getIcebreakers(match.hobby) : []

  async function handleSend() {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError(null)
    try {
      await sendMessage(text)
      setDraft('')
    } catch {
      setError('Не получилось отправить. Проверьте интернет и попробуйте ещё раз.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Шапка переписки: кнопка назад к списку + кто это */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-3 pb-3 border-b border-[#F0F1F4]">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center text-fly-ink flex-shrink-0">
          <BackArrowIcon />
        </button>
        <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${avatarColor}`}>
          {genderLetter}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fly-ink truncate">
            {match.age !== undefined && `${match.age} ${getAgeWord(match.age)}`}
            {match.age !== undefined && match.height !== undefined && ', '}
            {match.height !== undefined && `${match.height} см`}
          </div>
          <div className="text-xs text-fly-gray">{match.online ? 'В сети' : 'Не в сети'}</div>
        </div>
      </div>

      {/* Лента сообщений: прокручивается независимо от шапки и поля ввода */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-2.5">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[75%] px-3.5 py-2.5 rounded-fly-md text-sm leading-relaxed ${
              message.from === 'me'
                ? 'self-end bg-fly-ink text-white'
                : 'self-start bg-[#F4F5F8] text-fly-ink'
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

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

      {error && <p className="flex-shrink-0 px-4 pb-1 text-xs text-fly-gray text-center">{error}</p>}

      {/* Поле ввода нового сообщения - всегда внизу, не скроллится вместе с лентой */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-[#F0F1F4]">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSend()
          }}
          placeholder="Написать сообщение..."
          className="flex-1 bg-[#F4F5F8] rounded-fly-md px-4 py-2.5 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="w-10 h-10 rounded-fly-md bg-fly-coral flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `src/components/MessagesScreen.tsx`**

```typescript
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MessageIcon } from './icons'
import { getAgeWord } from '../lib/pluralize'
import type { AppOutletContext } from './AppShell'
import type { Profile } from '../data/profiles'
import { useMatches } from '../lib/useMatches'
import { ChatScreen } from './ChatScreen'

// Экран "Сообщения". Показывает список совпадений (взаимный лайк), а по клику
// на любое из них - открывает переписку с этим человеком (см. ChatScreen).
export function MessagesScreen() {
  const { currentUserId } = useOutletContext<AppOutletContext>()
  const { matches, loading } = useMatches(currentUserId)

  // Какое совпадение сейчас открыто как переписка. null - показываем список.
  const [openMatch, setOpenMatch] = useState<Profile | null>(null)

  if (openMatch) {
    return <ChatScreen match={openMatch} onBack={() => setOpenMatch(null)} />
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Заголовок экрана - просто название раздела, без логотипа (он только на Ленте) */}
      <div className="flex-shrink-0 px-5 pt-3 pb-1">
        <h1 className="text-xl font-semibold text-fly-ink">Сообщения</h1>
      </div>

      {loading ? (
        <p className="text-center text-sm text-fly-gray py-10">Загружаем совпадения…</p>
      ) : matches.length === 0 ? (
        // Пустое состояние по центру - совпадений пока нет
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-10 text-center">
          <div className="w-14 h-14 rounded-full bg-fly-tint-blue flex items-center justify-center">
            <div className="w-6 h-6 text-fly-blue-deep">
              <MessageIcon />
            </div>
          </div>
          <p className="text-sm text-fly-gray leading-relaxed">
            Совпадений пока нет. Поставьте лайк в ленте — если он окажется взаимным, переписка появится здесь.
          </p>
        </div>
      ) : (
        // Список совпадений - клик по любому открывает переписку (ChatScreen)
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {matches.map((match) => {
            const genderLetter = match.gender === 'female' ? 'Ж' : match.gender === 'male' ? 'М' : '?'
            const avatarColor = match.gender === 'female' ? 'bg-fly-coral' : 'bg-fly-blue-deep'
            return (
              <button
                key={match.id}
                onClick={() => setOpenMatch(match)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[#F8F9FB]"
              >
                <div
                  className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold ${avatarColor}`}
                >
                  {genderLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-fly-ink">
                    {match.age !== undefined && `${match.age} ${getAgeWord(match.age)}`}
                    {match.age !== undefined && match.height !== undefined && ', '}
                    {match.height !== undefined && `${match.height} см`}
                  </div>
                  <p className="text-xs text-fly-gray truncate">{match.quote}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck and run tests**

Run: `npm run build && npm run test`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useConversation.ts src/components/ChatScreen.tsx src/components/MessagesScreen.tsx
git commit -m "Persist chat messages instead of keeping them in memory"
```

---

### Task 3 (human, not automatable): End-to-end verification with two matched accounts

**Files:** none.

**Why it can't be a subagent task:** requires two real email inboxes with an existing mutual like between them.

- [ ] **Step 1: Send and reload**

With two already-matched accounts, send a message from account A to account B. Reload account A's page, reopen the chat: the sent message should still be there (not reset to the seed quote).

- [ ] **Step 2: Both directions**

Reply from account B. Reload account B's page, reopen the chat: both messages (A's and B's) should show, in the right left/right alignment, in order.

- [ ] **Step 3: Error path**

With dev tools' Network tab set to Offline, try sending a message: expect the input text to stay in the box (not cleared), a short error message to appear, and no unhandled exception in the console. Go back online and confirm sending then works.

---

## Self-Review Notes

- **Spec coverage:** `messages` table + RLS (including the mutual-match insert check) (Task 1), `useConversation` hook, `ChatScreen` owning its own data, `MessagesScreen` simplified to show the post quote instead of a last-message preview (Task 2), two-account manual verification including the error path (Task 3). All spec sections covered, including the explicit "no read/unread", "no live updates", and "no last-message query" YAGNI cuts.
- **Placeholder scan:** none — every step has literal code, SQL, or manual actions.
- **Type consistency:** `ChatMessage` is defined once, in `useConversation.ts` (Step 1), and imported by `ChatScreen.tsx` (Step 2) — no duplicate definition. `ChatScreenProps` drops `messages`/`onSend` (Step 2), matching that `MessagesScreen.tsx` (Step 3) now renders `<ChatScreen match={openMatch} onBack={...} />` with no other props. `useConversation`'s second argument (`otherUserId`) is fed `match.id`, which exists on `Profile` from the real-feed piece.
