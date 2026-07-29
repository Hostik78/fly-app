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
