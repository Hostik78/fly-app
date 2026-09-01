// Хук, который вычисляет настоящие совпадения (взаимный лайк, минус
// заблокированные) - сам список id приходит из готовой функции базы
// get_match_user_ids() (см. миграцию 20260804152508), а не из вычитания
// "сырого" списка блокировок на стороне кода (см. подробный комментарий в
// самой миграции про то, почему так было раньше нельзя - можно было вычислить,
// кто именно тебя заблокировал). Публикации и анкеты для найденных id
// склеиваются так же, как в useFeedProfiles.ts - независимая копия той же
// небольшой логики, общий хелпер пока не выносим, чтобы не трогать уже
// проверенный useFeedProfiles ради такого небольшого дублирования.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'
import { firstDatabaseReadError, reportDatabaseReadError } from './databaseReadError'

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
      const matchResult = await supabase.rpc('get_match_user_ids')
      if (matchResult.error) {
        fail('не удалось загрузить список совпадений', matchResult.error)
        return
      }
      const matchRows = matchResult.data
      const matchUserIds = (matchRows ?? []).map((row) => row.user_id)

      if (matchUserIds.length === 0) {
        if (!cancelled) {
          setMatches([])
          setLoading(false)
        }
        return
      }

      const [postsResult, profilesResult] = await Promise.all([
        supabase.from('posts').select('user_id, quote, category, hobby, created_at').in('user_id', matchUserIds),
        supabase.from('profiles').select('user_id, gender, age, height, languages, last_seen_at').in('user_id', matchUserIds),
      ])
      const detailError = firstDatabaseReadError(postsResult, profilesResult)
      if (detailError) {
        fail('не удалось загрузить данные совпадений', detailError)
        return
      }
      const posts = postsResult.data
      const profileRows = profilesResult.data

      const infoByUserId = new Map((profileRows ?? []).map((row) => [row.user_id, row]))

      const merged: Profile[] = (posts ?? []).map((post) => {
        const info = infoByUserId.get(post.user_id)
        return {
          id: post.user_id,
          gender: (info?.gender ?? undefined) as Profile['gender'],
          category: post.category as ProfileCategory,
          hobby: (post.hobby ?? undefined) as HobbyId | undefined,
          quote: post.quote,
          age: info?.age ?? undefined,
          height: info?.height ?? undefined,
          languages: info?.languages ?? undefined,
          lastSeenAt: info?.last_seen_at ?? undefined,
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
