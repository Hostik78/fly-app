// Хук для ОДНОГО открытого разговора (используется в ChatScreen): и слушает,
// печатает ли мне собеседник прямо сейчас, и умеет сообщить обратно "печатаю я
// сам". Один и тот же realtime-канал используется в обе стороны.
//
// Технически - Supabase Realtime Broadcast: сообщения "печатает" никуда не
// сохраняются в базу (это и не нужно - через 3 секунды без новых нажатий индикатор
// сам гаснет), просто пролетают напрямую между теми, кто сейчас слушает этот канал.
// Список у кого какие совпадения - для случая "нужно следить сразу за несколькими
// людьми" (список в "Сообщения") - см. useTypingStatus.ts, у него только слушание,
// без отправки, но по тому же самому имени канала (typingChannel.ts).

import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { TYPING_CLEAR_MS, typingChannelName } from './typingChannel'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { reportDatabaseReadError } from './databaseReadError'

// Не отправляем "печатаю" на каждое нажатие клавиши - достаточно не чаще,
// чем раз в столько миллисекунд. Собеседник всё равно узнает об этом почти
// сразу (это не задержка ответа, а просто чтобы не заваливать канал событиями).
const SEND_THROTTLE_MS = 2000

export function useTypingChannel(
  currentUserId: string | undefined,
  otherUserId: string | undefined,
): { theyAreTyping: boolean; notifyTyping: () => void } {
  const [theyAreTyping, setTheyAreTyping] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentAtRef = useRef(0)

  useEffect(() => {
    setTheyAreTyping(false)
    if (!currentUserId || !otherUserId) return

    const channel = supabase.channel(typingChannelName(currentUserId, otherUserId))
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        // Канал общий на двоих - без этой проверки собственная отправка тоже
        // считалась бы "собеседник печатает".
        if (payload.from !== otherUserId) return
        setTheyAreTyping(true)
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
        clearTimerRef.current = setTimeout(() => setTheyAreTyping(false), TYPING_CLEAR_MS)
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reportDatabaseReadError('канал индикатора набора текста недоступен', { status })
        }
      })
    channelRef.current = channel

    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [currentUserId, otherUserId])

  function notifyTyping() {
    if (!currentUserId || !channelRef.current) return
    const now = Date.now()
    if (now - lastSentAtRef.current < SEND_THROTTLE_MS) return
    lastSentAtRef.current = now
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: currentUserId } })
  }

  return { theyAreTyping, notifyTyping }
}
