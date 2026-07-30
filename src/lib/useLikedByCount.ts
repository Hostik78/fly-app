// Хук для строки "Кто меня лайкнул" на экране Аккаунт: спрашивает у базы ОДНО
// число - сколько человек лайкнули меня, а я им ещё нет - без самих записей
// (кто именно). Число считает специальная функция в базе (count_pending_likes,
// см. её миграцию) - обычный select сюда не подходит, потому что политика
// безопасности намеренно не даёт прочитать чужой id из входящего лайка, пока
// лайк не стал взаимным.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useLikedByCount(currentUserId: string | undefined): { count: number; loading: boolean } {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    supabase.rpc('count_pending_likes').then(({ data }) => {
      if (!cancelled) {
        setCount(data ?? 0)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [currentUserId])

  return { count, loading }
}
