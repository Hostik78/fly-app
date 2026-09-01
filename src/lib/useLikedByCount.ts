// Хук для строки "Кто меня лайкнул" на экране Аккаунт: спрашивает у базы ОДНО
// число - сколько человек лайкнули меня, а я им ещё нет - без самих записей
// (кто именно). Число считает специальная функция в базе (count_pending_likes,
// см. её миграцию) - обычный select сюда не подходит, потому что политика
// безопасности намеренно не даёт прочитать чужой id из входящего лайка, пока
// лайк не стал взаимным.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { reportDatabaseReadError } from './databaseReadError'

export function useLikedByCount(currentUserId: string | undefined): {
  count: number
  loading: boolean
  error: boolean
  retry: () => void
} {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    if (!currentUserId) {
      setError(false)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)

    async function load() {
      try {
        const { data, error } = await supabase.rpc('count_pending_likes')
        // error здесь не бросает исключение (это особенность supabase-js), поэтому
        // проверяем его отдельно - иначе, например, случайно пропавшее право на вызов
        // функции (как уже один раз случилось с этой самой функцией) молча показало
        // бы "лайков нет", неотличимо от честного нуля, без единого предупреждения.
        if (error) reportDatabaseReadError('не удалось загрузить количество входящих лайков', error)
        if (!cancelled) {
          if (!error) setCount(data ?? 0)
          setError(!!error)
          setLoading(false)
        }
      } catch (cause) {
        reportDatabaseReadError('неожиданная ошибка загрузки количества входящих лайков', cause)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }
    void load()

    return () => {
      cancelled = true
    }
  }, [currentUserId, loadAttempt])

  return {
    count,
    loading,
    error,
    retry: () => setLoadAttempt((attempt) => attempt + 1),
  }
}
