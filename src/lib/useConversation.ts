// Хук переписки с одним конкретным человеком: грузит существующие сообщения между
// двумя людьми (в обе стороны, по created_at), даёт функцию отправки нового, и
// сам добавляет в список входящие сообщения по мере того, как они приходят -
// не нужно перезаходить на экран, чтобы увидеть новое сообщение от собеседника.
//
// Плюс статус "Отправлено/Доставлено/Просмотрено" на своих сообщениях - см.
// docs/superpowers/specs/2026-08-03-chat-receipts-presence-profile-design.md.
// "Доставлено" здесь значит "долетело до браузера собеседника" (не до его
// телефона через ОС, как у WhatsApp - это нам с веб-сайта не видно).
// "Просмотрено" - собеседник получил сообщение, ПОКА вкладка была видима и в
// фокусе (стандартный document.visibilityState, см. markReceived ниже).

import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Database } from './database.types'

// Одно сообщение в переписке. from: 'them' - от собеседника, 'me' - от вас.
// deliveredAt/readAt заполнены только у сообщений from: 'me' - у входящих
// это не нужно показывать (свой же статус собеседнику не показываем тоже).
export interface ChatMessage {
  id: string
  text: string
  from: 'me' | 'them'
  deliveredAt?: string | null
  readAt?: string | null
}

type MessageRow = Database['public']['Tables']['messages']['Row']

export function useConversation(
  currentUserId: string | undefined,
  otherUserId: string | undefined,
): { messages: ChatMessage[]; loading: boolean; sendMessage: (text: string) => Promise<void> } {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  // Нужен внутри слушателя visibilitychange, который живёт в отдельном
  // useEffect - ref, а не просто messages, чтобы не пересоздавать подписку
  // на каждое изменение списка сообщений.
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  useEffect(() => {
    if (!currentUserId || !otherUserId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    // Помечает delivered_at (и, если вкладка видна и в фокусе, read_at) для
    // ЧУЖИХ сообщений мне, которые ещё не отмечены - вызывается и при первой
    // загрузке истории, и при получении новых сообщений живьём, и повторно,
    // когда вкладка возвращается в фокус (см. подписку на visibilitychange ниже).
    async function markReceived(rows: Pick<MessageRow, 'id' | 'delivered_at' | 'read_at'>[]) {
      const now = new Date().toISOString()
      const isVisible = document.visibilityState === 'visible'

      const undelivered = rows.filter((row) => !row.delivered_at).map((row) => row.id)
      if (undelivered.length > 0) {
        await supabase
          .from('messages')
          .update(isVisible ? { delivered_at: now, read_at: now } : { delivered_at: now })
          .in('id', undelivered)
      }

      // Доставлено раньше, но прочитано только сейчас (вкладка была свёрнута,
      // когда сообщение пришло, теперь снова видна) - отдельным запросом, чтобы
      // не перезаписать уже настоящий delivered_at более новой меткой времени.
      // undelivered и deliveredButUnread никогда не пересекаются (взаимоисключающие
      // условия delivered_at/!delivered_at), доп. проверку на пересечение не пишем.
      const deliveredButUnread = rows.filter((row) => row.delivered_at && !row.read_at).map((row) => row.id)
      if (isVisible && deliveredButUnread.length > 0) {
        await supabase.from('messages').update({ read_at: now }).in('id', deliveredButUnread)
      }
    }

    // Подписываемся на канал СНАЧАЛА, до запроса истории - а не после (как было
    // раньше). Между ответом на запрос истории и моментом, когда подписка на
    // канал реально подтверждена (это не мгновенно - у Realtime свой handshake),
    // есть окно: сообщение, отправленное собеседником именно тогда, раньше просто
    // терялось - Supabase Realtime не досылает события, случившиеся до
    // подтверждения подписки, и оно появилось бы только после повторного захода
    // в чат (хотя в базе, конечно, сохранялось). Теперь подписка идёт первой:
    // если что-то придёт живьём раньше ответа на историю, оно просто добавится
    // в пока пустой messages, а когда история подгрузится - склеится с ней ниже
    // (fetchedIds убирает дубли, если одно и то же сообщение всё же попало и в
    // историю, и было поймано живьём).
    const channel = supabase
      .channel(`messages:${currentUserId}:${otherUserId}`)
      .on<MessageRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${currentUserId}` },
        ({ new: row }) => {
          if (row.sender_id !== otherUserId) return
          setMessages((current) =>
            current.some((message) => message.id === row.id)
              ? current
              : [...current, { id: row.id, text: row.text, from: 'them', deliveredAt: row.delivered_at, readAt: row.read_at }],
          )
          void markReceived([row])
        },
      )
      .on<MessageRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentUserId}` },
        ({ new: row }) => {
          if (row.recipient_id !== otherUserId) return
          setMessages((current) =>
            current.map((message) =>
              message.id === row.id ? { ...message, deliveredAt: row.delivered_at, readAt: row.read_at } : message,
            ),
          )
        },
      )
      .subscribe()

    supabase
      .from('messages')
      .select('id, sender_id, text, created_at, delivered_at, read_at')
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`,
      )
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const rows = data ?? []
        const fetchedIds = new Set(rows.map((row) => row.id))
        setMessages((current) => {
          // current тут - только то, что успело прилететь живьём ДО того, как
          // пришёл ответ на историю (см. комментарий у channel выше) - история
          // всегда идёт первой (она и есть более ранние сообщения), а то живое,
          // чего в ней ещё нет, дописывается следом, без дублей по id.
          const liveOnly = current.filter((message) => !fetchedIds.has(message.id))
          return [
            ...rows.map((row) => ({
              id: row.id,
              text: row.text,
              from: (row.sender_id === currentUserId ? 'me' : 'them') as 'me' | 'them',
              deliveredAt: row.delivered_at,
              readAt: row.read_at,
            })),
            ...liveOnly,
          ]
        })
        setLoading(false)

        const theirRows = rows.filter((row) => row.sender_id === otherUserId)
        if (theirRows.length > 0) void markReceived(theirRows)
      })

    // Вкладка вернулась в фокус - у уже показанных чужих сообщений могло быть
    // "доставлено", но не "просмотрено" (пришли, пока вкладка была свёрнута) -
    // досчитываем read_at для них сейчас.
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      const theirUnread = messagesRef.current.filter((message) => message.from === 'them' && !message.readAt)
      if (theirUnread.length === 0) return
      void markReceived(theirUnread.map((message) => ({ id: message.id, delivered_at: message.deliveredAt ?? null, read_at: message.readAt ?? null })))
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
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
    setMessages((current) => [...current, { id: data.id, text: data.text, from: 'me', deliveredAt: null, readAt: null }])
  }

  return { messages, loading, sendMessage }
}
