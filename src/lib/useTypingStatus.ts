import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Статус читается с повторной серверной проверкой блокировок. Подписка на
// угадываемый Broadcast-канал больше не может раскрыть чужой набор текста.
export function useTypingStatus(
  currentUserId: string | undefined,
  matchIds: string[],
): Set<string> {
  const [typingIds, setTypingIds] = useState<Set<string>>(new Set())
  const key = matchIds.join(',')
  useEffect(() => {
    let cancelled = false
    let busy = false
    setTypingIds(new Set())
    if (!currentUserId || !key) return
    const allowed = new Set(key.split(','))
    async function load() {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const { data, error } = await supabase.rpc('activity_read')
        if (error || !Array.isArray(data)) throw error
        const ids = data.flatMap((row) =>
          row &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          row.typing === true &&
          typeof row.user_id === 'string' &&
          allowed.has(row.user_id)
            ? [row.user_id]
            : [],
        )
        if (!cancelled) setTypingIds(new Set(ids))
      } catch {
        if (!cancelled) setTypingIds(new Set())
      } finally {
        busy = false
      }
    }
    function visibility() {
      setTypingIds(new Set())
      void load()
    }
    void load()
    const timer = setInterval(() => void load(), 2000)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [currentUserId, key])
  return typingIds
}
