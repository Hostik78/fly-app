// Кто из ВСЕХ пользователей приложения сейчас онлайн - один общий канал на
// всех (не по одному на пару, как у "печатает" - тут не нужно знать, с кем
// именно человек сейчас в переписке, просто факт "открыто ли у него приложение").
//
// Технически - Supabase Realtime Presence: при подключении каждый "отмечается"
// (track) в общем канале, при отключении (закрыл вкладку, потерял сеть) Supabase
// сам убирает его из списка - отдельно писать "я вышел" не нужно, это и есть
// разница между Presence и обычным Broadcast (там сообщения не привязаны к тому,
// подключён ли ещё отправитель).
//
// Подключается один раз на уровне AppShell.tsx (см. её комментарий), а не в
// каждом экране отдельно - иначе на каждую вкладку открывался бы свой канал.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const PRESENCE_CHANNEL = 'online-users'
// Как часто записывать "я ещё тут" в свою анкету (last_seen_at) - раз в минуту,
// пока хук примонтирован. Не пытаемся поймать момент отключения (закрытие
// вкладки не гарантирует, что сетевой запрос успеет уйти) - вместо этого
// просто "пинг по таймеру": в любой момент last_seen_at отстаёт от реальности
// максимум на этот интервал, этого достаточно для фразы "был в сети N назад".
const LAST_SEEN_HEARTBEAT_MS = 60 * 1000

export function useOnlinePresence(currentUserId: string): Set<string> {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    // key: currentUserId - тогда presenceState() сразу даёт id пользователей
    // как ключи объекта, без разбора самого содержимого track().
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: currentUserId } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      setOnlineIds(new Set(Object.keys(channel.presenceState())))
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ online_at: new Date().toISOString() })
      }
    })

    function pingLastSeen() {
      void supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', currentUserId)
    }
    pingLastSeen()
    const heartbeat = setInterval(pingLastSeen, LAST_SEEN_HEARTBEAT_MS)

    return () => {
      clearInterval(heartbeat)
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  return onlineIds
}
