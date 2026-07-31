// Хук переписки с одним конкретным человеком: грузит существующие сообщения между
// двумя людьми (в обе стороны, по created_at), даёт функцию отправки нового, и
// сам добавляет в список входящие сообщения по мере того, как они приходят -
// не нужно перезаходить на экран, чтобы увидеть новое сообщение от собеседника.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Database } from './database.types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Одно сообщение в переписке. from: 'them' - от собеседника, 'me' - от вас.
export interface ChatMessage {
  id: string
  text: string
  from: 'me' | 'them'
}

type MessageRow = Database['public']['Tables']['messages']['Row']

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
    let channel: RealtimeChannel | null = null
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
        if (cancelled) return
        setMessages(
          (data ?? []).map((row) => ({
            id: row.id,
            text: row.text,
            from: row.sender_id === currentUserId ? 'me' : 'them',
          })),
        )
        setLoading(false)

        // Живое обновление - подписываемся только ТЕПЕРЬ, когда история уже точно
        // на экране (не отдельным независимым useEffect, стартующим одновременно
        // с запросом истории). Если бы подписка началась раньше и собеседник успел
        // бы написать ровно в этот момент, более поздний ответ на запрос истории
        // (отправленный ДО его сообщения) перезаписал бы весь список выше и стёр
        // уже показанное живое сообщение, будто его не было - см. миграцию
        // enable_realtime_messages.sql про то, почему это вообще приходит.
        //
        // Фильтр по recipient_id ловит все входящие сообщения мне от кого угодно -
        // дальше вручную сужаем до именно этого собеседника. Свои же отправленные
        // сообщения сюда никогда не попадают (у них recipient_id - собеседник, а
        // не я), поэтому дублировать то, что sendMessage уже добавил сам, не нужно.
        channel = supabase
          .channel(`messages:${currentUserId}:${otherUserId}`)
          .on<MessageRow>(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${currentUserId}` },
            ({ new: row }) => {
              if (row.sender_id !== otherUserId) return
              setMessages((current) => [...current, { id: row.id, text: row.text, from: 'them' }])
            },
          )
          .subscribe()
      })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
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
