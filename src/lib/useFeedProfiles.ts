// Хук, который грузит настоящую ленту: публикации всех, кроме себя, плюс анкеты
// этих же людей, склеенные в один список. Два отдельных запроса вместо одного
// SQL-джойна - posts и profiles намеренно не связаны внешним ключом друг на друга
// (см. 2026-07-28-profile-setup-design.md, "Почему отдельная таблица"), поэтому
// склеиваем на стороне кода по user_id.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'

const NEW_THRESHOLD_MS = 60 * 60 * 1000 // час
// Сколько последних заметок грузим за раз - без ограничения лента однажды скачивала
// бы вообще все публикации всех пользователей сразу, и чем больше людей в приложении,
// тем медленнее она открывалась бы у каждого. 50 самых свежих (публикации и так
// отсортированы по дате) - разумный запас с большим отступом от того, что реально
// поместится на экране за один раз.
const FEED_LIMIT = 50

export function useFeedProfiles(
  currentUserId: string | undefined,
): { profiles: Profile[]; loading: boolean; markLiked: (userId: string) => void } {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false)
      return
    }
    // Копия в свою переменную - TypeScript не переносит сужение "не undefined"
    // внутрь вложенной function load() (в отличие от обычных локальных переменных).
    const userId = currentUserId
    let cancelled = false
    setLoading(true)

    async function load() {
      const [{ data: posts }, { data: myLikes }] = await Promise.all([
        supabase
          .from('posts')
          .select('user_id, quote, category, hobby, created_at')
          .neq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(FEED_LIMIT),
        supabase.from('likes').select('liked_id').eq('liker_id', userId),
      ])
      const likedIds = new Set((myLikes ?? []).map((row) => row.liked_id))

      const userIds = (posts ?? []).map((post) => post.user_id)
      const { data: profileRows } =
        userIds.length > 0
          ? await supabase.from('profiles').select('user_id, gender, age, height, languages').in('user_id', userIds)
          : { data: [] }

      const infoByUserId = new Map((profileRows ?? []).map((row) => [row.user_id, row]))
      const now = Date.now()

      const merged: Profile[] = (posts ?? []).map((post) => {
        const info = infoByUserId.get(post.user_id)
        return {
          id: post.user_id,
          gender: (info?.gender ?? undefined) as Profile['gender'],
          category: post.category as ProfileCategory,
          hobby: (post.hobby ?? undefined) as HobbyId | undefined,
          isNew: now - new Date(post.created_at).getTime() < NEW_THRESHOLD_MS,
          quote: post.quote,
          age: info?.age ?? undefined,
          height: info?.height ?? undefined,
          languages: info?.languages ?? undefined,
          likedByMe: likedIds.has(post.user_id),
        }
      })

      if (!cancelled) {
        setProfiles(merged)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUserId])

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

  return { profiles, loading, markLiked }
}
