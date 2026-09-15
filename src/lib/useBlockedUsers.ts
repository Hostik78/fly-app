// Хук для экрана "Заблокированные" получает только тех людей, которых текущий
// пользователь сам заблокировал. База соединяет блокировку с анкетой и заметкой
// внутри get_blocked_profiles(), поэтому широкое чтение таблиц не требуется.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'
import { reportDatabaseReadError } from './databaseReadError'

export function useBlockedUsers(currentUserId: string | undefined): {
  blocked: Profile[]
  loading: boolean
  error: boolean
  retry: () => void
  unblock: (userId: string) => Promise<void>
} {
  const [blocked, setBlocked] = useState<Profile[]>([])
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

    function fail(context: string, cause: unknown) {
      reportDatabaseReadError(context, cause)
      if (!cancelled) {
        setError(true)
        setLoading(false)
      }
    }

    async function load() {
      const blockedResult = await supabase.rpc('get_blocked_profiles')
      if (blockedResult.error) {
        fail('не удалось загрузить список блокировок', blockedResult.error)
        return
      }
      const blockedRows = blockedResult.data
      if (!blockedRows || blockedRows.length === 0) {
        if (!cancelled) {
          setBlocked([])
          setLoading(false)
        }
        return
      }

      const merged: Profile[] = blockedRows.map((row) => {
        return {
          id: row.user_id,
          gender: (row.gender ?? undefined) as Profile['gender'],
          category: row.category as ProfileCategory,
          hobby: (row.hobby ?? undefined) as HobbyId | undefined,
          quote: row.quote,
          age: row.age ?? undefined,
          height: row.height ?? undefined,
          languages: row.languages ?? undefined,
          likedByMe: false,
        }
      })

      if (!cancelled) {
        setBlocked(merged)
        setLoading(false)
      }
    }

    load().catch((cause: unknown) => fail('неожиданная ошибка загрузки блокировок', cause))
    return () => {
      cancelled = true
    }
  }, [currentUserId, loadAttempt])

  // Разблокировать - удаляет свою же строку (RLS разрешает удалять только
  // собственные блокировки, см. blocked_users_delete_own) и убирает человека
  // из списка на экране сразу же, не дожидаясь перезахода.
  async function unblock(userId: string) {
    if (!currentUserId) return
    const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', currentUserId).eq('blocked_id', userId)
    if (error) throw error
    setBlocked((current) => current.filter((profile) => profile.id !== userId))
  }

  return {
    blocked,
    loading,
    error,
    retry: () => setLoadAttempt((attempt) => attempt + 1),
    unblock,
  }
}
