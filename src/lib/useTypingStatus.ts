// Хук для СПИСКА в "Сообщениях": кто из совпадений печатает мне прямо сейчас -
// сразу за несколькими людьми одновременно (по одному realtime-каналу на
// каждого), а не только за одним открытым разговором. Для одного открытого
// разговора (там ещё нужно и самому сообщать "печатаю") - см. useTypingChannel.ts.
// Имя канала - общее (typingChannel.ts), поэтому оба хука видят одни и те же события.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { TYPING_CLEAR_MS, typingChannelName } from './typingChannel'
import { reportDatabaseReadError } from './databaseReadError'

export function useTypingStatus(currentUserId: string | undefined, matchIds: string[]): Set<string> {
  const [typingIds, setTypingIds] = useState<Set<string>>(new Set())
  // Копия в строку - React сравнивает элементы массива в deps по ссылке, а
  // matchIds пересоздаётся заново при каждой перерисовке MessagesScreen.
  const matchIdsKey = matchIds.join(',')

  useEffect(() => {
    if (!currentUserId || matchIdsKey === '') {
      setTypingIds(new Set())
      return
    }
    const ids = matchIdsKey.split(',')
    const clearTimers = new Map<string, ReturnType<typeof setTimeout>>()

    const channels = ids.map((otherId) => {
      const channel = supabase.channel(typingChannelName(currentUserId, otherId))
      channel
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (payload.from !== otherId) return
          setTypingIds((current) => new Set(current).add(otherId))
          const existingTimer = clearTimers.get(otherId)
          if (existingTimer) clearTimeout(existingTimer)
          clearTimers.set(
            otherId,
            setTimeout(() => {
              setTypingIds((current) => {
                const next = new Set(current)
                next.delete(otherId)
                return next
              })
            }, TYPING_CLEAR_MS),
          )
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reportDatabaseReadError('канал статуса набора текста в списке недоступен', { status, otherId })
          }
        })
      return channel
    })

    return () => {
      clearTimers.forEach((timer) => clearTimeout(timer))
      channels.forEach((channel) => supabase.removeChannel(channel))
    }
  }, [currentUserId, matchIdsKey])

  return typingIds
}
