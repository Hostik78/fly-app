// Небольшой хук (переиспользуемый кусок логики React), который следит за тем,
// вошёл ли человек в аккаунт. Ничего не знает про экраны - просто сообщает
// текущее состояние входа.

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { reportDatabaseReadError } from './databaseReadError'

export function useSession(): {
  session: Session | null
  loading: boolean
  error: boolean
  retry: () => void
} {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    // Подписка продолжает сообщать о входе/выходе между вкладками. Начальное
    // состояние дополнительно читаем через getSession ниже: у него есть явное
    // поле error, поэтому сбой хранилища/сессии не оставит вечный пустой экран.
    const { data } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (cancelled) return
      // INITIAL_SESSION читает то же начальное состояние, что getSession ниже,
      // но не даёт отдельного error. Если хранилище сессии сломано, эти два
      // ответа могут прийти в разном порядке и null из INITIAL_SESSION сотрёт
      // настоящую ошибку. Поэтому начальный ответ обрабатывает только getSession;
      // подписка остаётся для всех последующих входов/выходов.
      if (event === 'INITIAL_SESSION') return
      setSession(currentSession)
      setError(false)
      setLoading(false)
    })

    async function loadInitialSession() {
      try {
        const result = await supabase.auth.getSession()
        if (cancelled) return
        if (result.error) {
          reportDatabaseReadError('не удалось проверить текущий вход', result.error)
          setError(true)
        } else {
          setSession(result.data.session)
        }
        setLoading(false)
      } catch (cause) {
        if (cancelled) return
        reportDatabaseReadError('неожиданная ошибка проверки текущего входа', cause)
        setError(true)
        setLoading(false)
      }
    }
    void loadInitialSession()

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [loadAttempt])

  return {
    session,
    loading,
    error,
    retry: () => setLoadAttempt((attempt) => attempt + 1),
  }
}
