// Хук для экрана "Заблокированные" (см. BlockedAccountsScreen.tsx) - список всех,
// кого текущий пользователь заблокировал, плюс возможность разблокировать.
// Собирает анкеты тем же приёмом склейки на стороне кода, что и useMatches.ts/
// useFeedProfiles.ts - см. их комментарий про то, почему posts и profiles не
// связаны внешним ключом друг на друга. В отличие от тех двух хуков, здесь
// список строится по blockedIds напрямую, а не по постам - у заблокированного
// человека вполне может уже не быть текущей заметки, но он всё равно должен
// остаться в списке заблокированных.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'
import { firstDatabaseReadError, reportDatabaseReadError } from './databaseReadError'

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
    const userId = currentUserId
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
      const blockedResult = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId)
      if (blockedResult.error) {
        fail('не удалось загрузить список блокировок', blockedResult.error)
        return
      }
      const blockedRows = blockedResult.data
      const blockedIds = (blockedRows ?? []).map((row) => row.blocked_id)

      if (blockedIds.length === 0) {
        if (!cancelled) {
          setBlocked([])
          setLoading(false)
        }
        return
      }

      const [postsResult, profilesResult] = await Promise.all([
        supabase.from('posts').select('user_id, quote, category, hobby').in('user_id', blockedIds),
        supabase.from('profiles').select('user_id, gender, age, height, languages').in('user_id', blockedIds),
      ])
      const detailError = firstDatabaseReadError(postsResult, profilesResult)
      if (detailError) {
        fail('не удалось загрузить анкеты заблокированных', detailError)
        return
      }
      const posts = postsResult.data
      const profileRows = profilesResult.data

      const postByUserId = new Map((posts ?? []).map((row) => [row.user_id, row]))
      const infoByUserId = new Map((profileRows ?? []).map((row) => [row.user_id, row]))

      const merged: Profile[] = blockedIds.map((id) => {
        const post = postByUserId.get(id)
        const info = infoByUserId.get(id)
        return {
          id,
          gender: (info?.gender ?? undefined) as Profile['gender'],
          category: (post?.category ?? 'communication') as ProfileCategory,
          hobby: (post?.hobby ?? undefined) as HobbyId | undefined,
          quote: post?.quote ?? '',
          age: info?.age ?? undefined,
          height: info?.height ?? undefined,
          languages: info?.languages ?? undefined,
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
