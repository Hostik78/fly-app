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
import { reportDatabaseReadError } from './databaseReadError'

const PRESENCE_CHANNEL = 'online-users'
// Как часто записывать "я ещё тут" в свою анкету (last_seen_at) - раз в минуту,
// пока хук примонтирован. Не пытаемся поймать момент отключения (закрытие
// вкладки не гарантирует, что сетевой запрос успеет уйти) - вместо этого
// просто "пинг по таймеру": в любой момент last_seen_at отстаёт от реальности
// максимум на этот интервал, этого достаточно для фразы "был в сети N назад".
const LAST_SEEN_HEARTBEAT_MS = 60 * 1000

export function useOnlinePresence(currentUserId: string): { onlineIds: Set<string>; statusKnown: boolean } {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())
  const [statusKnown, setStatusKnown] = useState(false)

  useEffect(() => {
    let cancelled = false
    setOnlineIds(new Set())
    setStatusKnown(false)
    // key: currentUserId - тогда presenceState() сразу даёт id пользователей
    // как ключи объекта, без разбора самого содержимого track().
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: currentUserId } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      if (cancelled) return
      setOnlineIds(new Set(Object.keys(channel.presenceState())))
      // Только sync означает, что сервер уже прислал настоящий снимок. Само
      // подключение SUBSCRIBED ещё не говорит, что пустой Set = «все офлайн».
      setStatusKnown(true)
    })

    channel.subscribe((status) => {
      if (cancelled) return
      if (status === 'SUBSCRIBED') {
        void channel.track({ online_at: new Date().toISOString() })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Пустой Set при сбое нельзя трактовать как «все офлайн»: это просто
        // означает, что сейчас мы не знаем статус. Экраны получают statusKnown
        // отдельно и не показывают категоричное «Не в сети» в этот момент.
        setStatusKnown(false)
        setOnlineIds(new Set())
        reportDatabaseReadError('канал статусов присутствия недоступен', { status })
      }
    })

    async function pingLastSeen() {
      const { error } = await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', currentUserId)
      if (error) reportDatabaseReadError('не удалось обновить время последнего присутствия', error)
    }
    void pingLastSeen()
    const heartbeat = setInterval(() => void pingLastSeen(), LAST_SEEN_HEARTBEAT_MS)

    return () => {
      cancelled = true
      clearInterval(heartbeat)
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  return { onlineIds, statusKnown }
}
