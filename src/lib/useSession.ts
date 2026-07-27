// Небольшой хук (переиспользуемый кусок логики React), который следит за тем,
// вошёл ли человек в аккаунт. Ничего не знает про экраны - просто сообщает
// текущее состояние входа.

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange сам присылает текущее состояние сразу при подписке
    // (событие INITIAL_SESSION), а дальше сообщает о каждом входе/выходе -
    // отдельный запрос "проверь, есть ли сессия" не нужен.
    const { data } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
