import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Общих Presence-каналов нет. Список выдаёт база только для незаблокированных
// совпадений. Ошибка означает «статус неизвестен», а не «человек офлайн».
export function useOnlinePresence(currentUserId: string): {
  onlineIds: Set<string>
  statusKnown: boolean
} {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())
  const [statusKnown, setStatusKnown] = useState(false)
  useEffect(() => {
    let cancelled = false
    let busy = false
    let lastPing = 0
    async function load() {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        if (Date.now() - lastPing > 20000) {
          const ping = await supabase.rpc('activity_write', { recipient: null })
          if (ping.error) throw ping.error
          lastPing = Date.now()
        }
        const { data, error } = await supabase.rpc('activity_read')
        if (error || !Array.isArray(data)) throw error
        if (!cancelled) {
          setOnlineIds(
            new Set(
              data
                .filter(
                  (row) =>
                    row && typeof row === 'object' && !Array.isArray(row) && row.online === true,
                )
                .map((row) => String((row as { user_id: string }).user_id)),
            ),
          )
          setStatusKnown(true)
        }
      } catch {
        if (!cancelled) {
          setOnlineIds(new Set())
          setStatusKnown(false)
        }
      } finally {
        busy = false
      }
    }
    function visibility() {
      setOnlineIds(new Set())
      setStatusKnown(false)
      void load()
    }
    void load()
    const timer = setInterval(() => void load(), 5000)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [currentUserId])
  return { onlineIds, statusKnown }
}
