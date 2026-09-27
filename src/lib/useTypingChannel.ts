import { useRef } from 'react'
import { supabase } from './supabase'
import { useTypingStatus } from './useTypingStatus'

// Запись адресована конкретному собеседнику; база проверяет совпадение и
// блокировку, а срок жизни задаёт по серверным часам. Payload.from больше нет.
export function useTypingChannel(
  currentUserId: string | undefined,
  otherUserId: string | undefined,
) {
  const typing = useTypingStatus(currentUserId, otherUserId ? [otherUserId] : [])
  const lastSent = useRef(0)
  function notifyTyping() {
    if (!currentUserId || !otherUserId || Date.now() - lastSent.current < 2000) return
    lastSent.current = Date.now()
    void supabase.rpc('activity_write', { recipient: otherUserId }).then(() => {})
  }
  return { theyAreTyping: !!otherUserId && typing.has(otherUserId), notifyTyping }
}
