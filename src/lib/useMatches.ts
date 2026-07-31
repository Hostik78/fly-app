// Хук, который вычисляет настоящие совпадения (взаимный лайк): кого лайкнул(а) я,
// и кто лайкнул(а) меня - пересечение этих двух списков и есть совпадения.
// Публикации и анкеты для них склеиваются так же, как в useFeedProfiles.ts - независимая
// копия той же небольшой логики: два хука, у каждого свой источник списка user_id
// (там - "все, кроме себя", здесь - "пересечение лайков"), общий хелпер пока не выносим,
// чтобы не трогать уже проверенный useFeedProfiles ради такого небольшого дублирования.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile, ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'

export function useMatches(currentUserId: string | undefined): { matches: Profile[]; loading: boolean } {
  const [matches, setMatches] = useState<Profile[]>([])
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
      const [{ data: iLiked }, { data: likedMe }] = await Promise.all([
        supabase.from('likes').select('liked_id').eq('liker_id', userId),
        supabase.from('likes').select('liker_id').eq('liked_id', userId),
      ])
      const likedMeSet = new Set((likedMe ?? []).map((row) => row.liker_id))
      const matchUserIds = (iLiked ?? []).map((row) => row.liked_id).filter((id) => likedMeSet.has(id))

      if (matchUserIds.length === 0) {
        if (!cancelled) {
          setMatches([])
          setLoading(false)
        }
        return
      }

      const [{ data: posts }, { data: profileRows }] = await Promise.all([
        supabase.from('posts').select('user_id, quote, category, hobby, created_at').in('user_id', matchUserIds),
        supabase.from('profiles').select('user_id, gender, age, height, languages').in('user_id', matchUserIds),
      ])

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
          likedByMe: true, // совпадение возможно только если лайкнули друг друга
        }
      })

      if (!cancelled) {
        setMatches(merged)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  return { matches, loading }
}
