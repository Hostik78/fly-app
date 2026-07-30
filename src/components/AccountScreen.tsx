// Экран "Аккаунт" — визуальный стиль всего приложения ещё будет меняться (см.
// notes.md), поэтому оформление намеренно простое, без лишних деталей.
//
// По-настоящему рабочие пункты - "Выйти", "Редактировать анкету", "Изменить заметку".
// Остальные (Кто меня лайкнул и т.д.) пока декоративные, ждут своих кусков бэкенда.
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getLanguageCodesFromNames } from '../data/languages'
import { useLikedByCount } from '../lib/useLikedByCount'
import { ProfileSetupScreen } from './ProfileSetupScreen'
import { CreateStatusScreen } from './CreateStatusScreen'
import type { AppOutletContext } from './AppShell'
import type { ProfileCategory } from '../data/profiles'
import type { HobbyId } from '../data/hobbies'

interface ProfileRow {
  gender: 'male' | 'female' | null
  age: number | null
  height: number | null
  languages: string | null
}

interface PostRow {
  quote: string
  category: ProfileCategory
  hobby: HobbyId | null
}

export function AccountScreen() {
  const { currentUserId } = useOutletContext<AppOutletContext>()
  const { count: likedByCount } = useLikedByCount(currentUserId)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [post, setPost] = useState<PostRow | null>(null)
  const [loadingPost, setLoadingPost] = useState(false)

  function handleSignOut() {
    void supabase.auth.signOut()
  }

  async function startEditingProfile() {
    setLoadingProfile(true)
    const { data } = await supabase
      .from('profiles')
      .select('gender, age, height, languages')
      .eq('user_id', currentUserId)
      .maybeSingle()
    // gender в сгенерированных типах базы - просто "string" (Postgres не показывает
    // TypeScript-у сами значения check-ограничения) - приводим к настоящему,
    // более узкому типу, который база и так гарантирует.
    setProfile((data as ProfileRow | null) ?? { gender: null, age: null, height: null, languages: null })
    setLoadingProfile(false)
  }

  async function handleUpdateProfile(
    gender: 'male' | 'female' | null,
    age: number | null,
    height: number | null,
    languages: string | null,
  ) {
    const { error } = await supabase
      .from('profiles')
      .update({ gender, age, height, languages })
      .eq('user_id', currentUserId)
    if (error) throw error
    setProfile(null)
  }

  async function startEditingPost() {
    setLoadingPost(true)
    const { data } = await supabase
      .from('posts')
      .select('quote, category, hobby')
      .eq('user_id', currentUserId)
      .maybeSingle()
    // category/hobby в сгенерированных типах базы - просто "string" - тот же случай,
    // что и с gender в startEditingProfile выше.
    if (data) setPost(data as PostRow)
    setLoadingPost(false)
  }

  async function handleUpdatePost(quote: string, category: ProfileCategory, hobby: HobbyId | null) {
    const { error } = await supabase.from('posts').update({ quote, category, hobby }).eq('user_id', currentUserId)
    if (error) throw error
    setPost(null)
  }

  if (profile) {
    return (
      <ProfileSetupScreen
        initialValues={{
          gender: profile.gender,
          age: profile.age,
          height: profile.height,
          languageCodes: getLanguageCodesFromNames(profile.languages),
        }}
        submitLabel="Сохранить"
        onCancel={() => setProfile(null)}
        onSubmit={handleUpdateProfile}
      />
    )
  }

  if (post) {
    return (
      <CreateStatusScreen
        initialValues={post}
        submitLabel="Сохранить"
        onCancel={() => setPost(null)}
        onSubmit={handleUpdatePost}
      />
    )
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-5 pt-3 pb-1">
        <h1 className="text-xl font-semibold text-fly-ink">Аккаунт</h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-4">
        {/* Заглушка вместо фото профиля */}
        <div className="flex flex-col items-center gap-3 pb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E4F2FD] to-[#BFE0F9]" />
          <p className="text-sm text-fly-gray">Здесь будет ваша анкета</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={loadingProfile}
            onClick={startEditingProfile}
            className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink text-left transition-opacity disabled:opacity-60"
          >
            {loadingProfile ? 'Загружаем…' : 'Редактировать анкету'}
          </button>

          <button
            type="button"
            disabled={loadingPost}
            onClick={startEditingPost}
            className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink text-left transition-opacity disabled:opacity-60"
          >
            {loadingPost ? 'Загружаем…' : 'Изменить заметку'}
          </button>

          {/*
            "Кто меня лайкнул" - показываем только ЧИСЛО, без имён (см. useLikedByCount) -
            специально так, чтобы не сломать механику "совпадение видно только когда оно
            уже взаимное" (см. миграцию tighten_likes_select_to_hide_one_sided.sql).
            Число не показываем вовсе, если оно 0 - пустой значок "0" выглядел бы как
            декоративный мусор, а не как настоящая информация.
          */}
          <div className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink flex items-center justify-between">
            <span>Кто меня лайкнул</span>
            {likedByCount > 0 && (
              <span className="text-xs font-bold text-white bg-fly-coral min-w-[20px] px-2 py-0.5 rounded-full text-center">
                {likedByCount}
              </span>
            )}
          </div>

          {/* Остальные пункты - пока декоративные, без действия по клику */}
          {['Настройки уведомлений', 'Помощь'].map((item) => (
            <div key={item} className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink">
              {item}
            </div>
          ))}

          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink text-left"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  )
}
