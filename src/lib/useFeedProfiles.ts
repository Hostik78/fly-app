// Хук грузит уже готовую безопасную ленту через get_feed_profiles(). База сама
// соединяет заметку с анкетой и удаляет из результата себя, скрытых людей и
// блокировки в обе стороны. Клиент больше не получает право отдельно читать
// произвольные строки profiles/posts и не может обойти эту фильтрацию.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'
import { firstDatabaseReadError, reportDatabaseReadError } from './databaseReadError'

const NEW_THRESHOLD_MS = 60 * 60 * 1000 // час

export function useFeedProfiles(
  currentUserId: string | undefined,
): {
  profiles: Profile[]
  loading: boolean
  error: boolean
  retry: () => void
  markLiked: (userId: string) => void
  hideProfile: (userId: string) => Promise<void>
  blockProfile: (userId: string) => Promise<void>
} {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    if (!currentUserId) {
      setError(false)
      setLoading(false)
      return
    }
    // Копия в свою переменную - TypeScript не переносит сужение "не undefined"
    // внутрь вложенной function load() (в отличие от обычных локальных переменных).
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
      // Лимит "сколько последних анкет" находится внутри get_feed_profiles() —
      // без него лента однажды скачивала бы все публикации
      // всех пользователей сразу, и чем больше людей в приложении, тем медленнее
      // она открывалась бы у каждого.
      const [profilesResult, likesResult] = await Promise.all([
        supabase.rpc('get_feed_profiles'),
        supabase.from('likes').select('liked_id').eq('liker_id', userId),
      ])
      const initialError = firstDatabaseReadError(profilesResult, likesResult)
      if (initialError) {
        fail('не удалось загрузить ленту и лайки', initialError)
        return
      }
      const profileRows = profilesResult.data
      const myLikes = likesResult.data
      const likedIds = new Set((myLikes ?? []).map((row) => row.liked_id))
      const now = Date.now()

      const merged: Profile[] = (profileRows ?? []).map((row) => {
        return {
          id: row.user_id,
          gender: (row.gender ?? undefined) as Profile['gender'],
          category: row.category as ProfileCategory,
          hobby: (row.hobby ?? undefined) as HobbyId | undefined,
          isNew: now - new Date(row.created_at).getTime() < NEW_THRESHOLD_MS,
          quote: row.quote,
          age: row.age ?? undefined,
          height: row.height ?? undefined,
          languages: row.languages ?? undefined,
          likedByMe: likedIds.has(row.user_id),
        }
      })

      if (!cancelled) {
        setProfiles(merged)
        setLoading(false)
      }
    }

    load().catch((cause: unknown) => fail('неожиданная ошибка загрузки ленты', cause))
    return () => {
      cancelled = true
    }
  }, [currentUserId, loadAttempt])

  // Отмечает человека лайкнутым в уже загруженном списке - вызывается снаружи
  // (FeedScreen.tsx) сразу после того, как лайк по-настоящему сохранился в базу.
  // Без этого profile.likedByMe оставался бы устаревшим (посчитан один раз при
  // самой загрузке ленты), и при пересборке карточек (например, при смене
  // фильтра - см. key={activeFilter} в FeedScreen.tsx) уже лайкнутая карточка
  // снова показывала бы себя как нелайкнутую, а повторный лайк тихо падал бы
  // с ошибкой (liker_id+liked_id - первичный ключ, дубликат не пройдёт).
  function markLiked(userId: string) {
    setProfiles((current) => current.map((profile) => (profile.id === userId ? { ...profile, likedByMe: true } : profile)))
  }

  // "Скрыть анкету" - кнопка "⋯" на карточке (см. ProfileCard.tsx). Сохраняет
  // в базу (чтобы человек не вернулся в ленту после перезахода) и сразу же
  // убирает карточку с экрана - не ждём следующей перезагрузки ленты.
  async function hideProfile(userId: string) {
    if (!currentUserId) return
    const { error } = await supabase.from('hidden_profiles').insert({ hider_id: currentUserId, hidden_id: userId })
    if (error) throw error
    setProfiles((current) => current.filter((profile) => profile.id !== userId))
  }

  // "Заблокировать" - сильнее, чем hideProfile выше: сохраняет в blocked_users
  // (взаимная невидимость через get_feed_posts выше + запрет переписки на
  // уровне базы, см. миграцию 20260804152508) и сразу убирает карточку с
  // экрана, так же не дожидаясь следующей перезагрузки ленты.
  async function blockProfile(userId: string) {
    if (!currentUserId) return
    const { error } = await supabase.from('blocked_users').insert({ blocker_id: currentUserId, blocked_id: userId })
    if (error) throw error
    setProfiles((current) => current.filter((profile) => profile.id !== userId))
  }

  return {
    profiles,
    loading,
    error,
    retry: () => setLoadAttempt((attempt) => attempt + 1),
    markLiked,
    hideProfile,
    blockProfile,
  }
}
