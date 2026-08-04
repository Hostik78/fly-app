// Хук, который грузит настоящую ленту: публикации всех, кроме себя (и кроме
// скрытых/заблокированных), плюс анкеты этих же людей, склеенные в один список.
// Сам список постов приходит из готовой функции базы get_feed_posts() (см.
// миграцию 20260804152508), а не обычным select с фильтром в коде - раньше
// здесь же отдельно грузился список заблокированных id и вычитался на стороне
// кода, но код-ревью нашёл, что через это можно было вычислить, кто именно
// тебя заблокировал (сравнить свои исходящие блокировки с общим списком) - см.
// подробный комментарий в самой миграции. Теперь база сразу отдаёт готовый
// список постов, без единого "сырого" id, который можно было бы вычесть.
//
// Профили (пол/возраст/рост/языки) - отдельным запросом: posts и profiles
// намеренно не связаны внешним ключом друг на друга (см.
// 2026-07-28-profile-setup-design.md, "Почему отдельная таблица"), поэтому
// склеиваем на стороне кода по user_id.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'

const NEW_THRESHOLD_MS = 60 * 60 * 1000 // час

export function useFeedProfiles(
  currentUserId: string | undefined,
): {
  profiles: Profile[]
  loading: boolean
  markLiked: (userId: string) => void
  hideProfile: (userId: string) => Promise<void>
  blockProfile: (userId: string) => Promise<void>
} {
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
      // Лимит "сколько последних заметок" теперь внутри самой get_feed_posts()
      // (см. миграцию) - без него лента однажды скачивала бы все публикации
      // всех пользователей сразу, и чем больше людей в приложении, тем медленнее
      // она открывалась бы у каждого.
      const [{ data: posts }, { data: myLikes }] = await Promise.all([
        supabase.rpc('get_feed_posts'),
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

  return { profiles, loading, markLiked, hideProfile, blockProfile }
}
