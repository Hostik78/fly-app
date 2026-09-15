// Хук получает готовые анкеты совпадений через одну закрытую выборку базы.
// Взаимность и блокировки проверяются до возврата результата, а прямое чтение
// произвольных profiles/posts клиенту больше не требуется.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'
import { reportDatabaseReadError } from './databaseReadError'

export function useMatches(
  currentUserId: string | undefined,
): {
  matches: Profile[]
  loading: boolean
  error: boolean
  retry: () => void
  blockMatch: (userId: string) => Promise<void>
} {
  const [matches, setMatches] = useState<Profile[]>([])
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
      const matchResult = await supabase.rpc('get_match_profiles')
      if (matchResult.error) {
        fail('не удалось загрузить список совпадений', matchResult.error)
        return
      }
      const matchRows = matchResult.data
      if (!matchRows || matchRows.length === 0) {
        if (!cancelled) {
          setMatches([])
          setLoading(false)
        }
        return
      }

      const merged: Profile[] = matchRows.map((row) => {
        return {
          id: row.user_id,
          gender: (row.gender ?? undefined) as Profile['gender'],
          category: row.category as ProfileCategory,
          hobby: (row.hobby ?? undefined) as HobbyId | undefined,
          quote: row.quote,
          age: row.age ?? undefined,
          height: row.height ?? undefined,
          languages: row.languages ?? undefined,
          lastSeenAt: row.last_seen_at ?? undefined,
          likedByMe: true, // совпадение возможно только если лайкнули друг друга
        }
      })

      if (!cancelled) {
        setMatches(merged)
        setLoading(false)
      }
    }

    load().catch((cause: unknown) => fail('неожиданная ошибка загрузки совпадений', cause))
    return () => {
      cancelled = true
    }
  }, [currentUserId, loadAttempt])

  // "Заблокировать" из открытого чата (см. ChatScreen.tsx/ProfileDetailSheet.tsx) -
  // сохраняет блокировку (её сразу учтёт get_match_user_ids выше при следующей
  // загрузке) и убирает совпадение из списка сразу же, тем же приёмом, что и
  // hideProfile/blockProfile в useFeedProfiles.ts.
  async function blockMatch(userId: string) {
    if (!currentUserId) return
    const { error } = await supabase.from('blocked_users').insert({ blocker_id: currentUserId, blocked_id: userId })
    if (error) throw error
    setMatches((current) => current.filter((profile) => profile.id !== userId))
  }

  return {
    matches,
    loading,
    error,
    retry: () => setLoadAttempt((attempt) => attempt + 1),
    blockMatch,
  }
}
