// Экран "Аккаунт" - все пункты подключены к настоящему бэкенду или ведут на
// настоящий экран: "Выйти", "Редактировать анкету", "Изменить заметку", "Кто
// меня лайкнул" (см. useLikedByCount), "Уведомления" (см. usePushNotifications),
// "Помощь" (см. HelpScreen.tsx).
import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getLanguageCodesFromNames } from '../data/languages'
import { useLikedByCount } from '../lib/useLikedByCount'
import { usePushNotifications } from '../lib/usePushNotifications'
import { getAvatarUrl, uploadAvatar } from '../lib/avatar'
import { ProfileSetupScreen } from './ProfileSetupScreen'
import { CreateStatusScreen } from './CreateStatusScreen'
import { HelpScreen } from './HelpScreen'
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
  const pushNotifications = usePushNotifications(currentUserId)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [post, setPost] = useState<PostRow | null>(null)
  const [loadingPost, setLoadingPost] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  // Фото профиля - показываем сразу, оптимистично (публичный бакет, см. avatar.ts) -
  // если файла на самом деле нет, <img onError> сам переключит на градиент-заглушку,
  // отдельно спрашивать базу "есть ли фото" не нужно.
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  function handleSignOut() {
    void supabase.auth.signOut()
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // тот же файл можно будет выбрать ещё раз подряд
    if (!file || !currentUserId) return
    setUploadingAvatar(true)
    setAvatarError(null)
    try {
      await uploadAvatar(currentUserId, file)
      setAvatarBroken(false)
      // Файл лежит по тому же адресу, что и раньше (перезаписан) - без смены
      // "версии" в ссылке браузер показал бы старую картинку из своего кеша.
      setAvatarVersion((version) => version + 1)
    } catch {
      // Причина может быть и в сети, и в самом файле (например, формат, который
      // браузер не смог прочитать, см. resizeImage в avatar.ts) - текст
      // намеренно не называет конкретную причину, чтобы не отправлять человека
      // не в ту сторону (не "проверьте интернет", если дело было в файле).
      setAvatarError('Не получилось загрузить фото. Попробуйте другое изображение или ещё раз.')
    } finally {
      setUploadingAvatar(false)
    }
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

  if (showHelp) {
    return <HelpScreen onBack={() => setShowHelp(false)} />
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-5 pt-3 pb-1">
        <h1 className="text-xl font-semibold text-fly-ink">Аккаунт</h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-4">
        {/* Фото профиля - кружок сам по себе кнопка (см. avatarInputRef): тап
            открывает обычный выбор файла с телефона/компьютера. Пока настоящего
            фото нет (или оно не загрузилось - avatarBroken) - градиент-заглушка,
            как и было. */}
        <div className="flex flex-col items-center gap-2 pb-6">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-20 h-20 rounded-full overflow-hidden transition-opacity disabled:opacity-60"
          >
            {avatarBroken || !currentUserId ? (
              <div className="w-full h-full bg-gradient-to-br from-fly-tint-accent to-fly-accent" />
            ) : (
              <img
                src={getAvatarUrl(currentUserId, avatarVersion)}
                onError={() => setAvatarBroken(true)}
                alt="Фото профиля"
                className="w-full h-full object-cover"
              />
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs font-semibold">
                …
              </div>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <p className="text-sm text-fly-gray">
            {uploadingAvatar ? 'Загружаем фото…' : 'Нажмите на кружок, чтобы добавить фото'}
          </p>
          {avatarError && <p className="text-xs text-fly-gray text-center px-6">{avatarError}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={loadingProfile}
            onClick={startEditingProfile}
            className="px-4 py-3 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border text-sm text-fly-ink text-left transition-opacity disabled:opacity-60"
          >
            {loadingProfile ? 'Загружаем…' : 'Редактировать анкету'}
          </button>

          <button
            type="button"
            disabled={loadingPost}
            onClick={startEditingPost}
            className="px-4 py-3 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border text-sm text-fly-ink text-left transition-opacity disabled:opacity-60"
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
          <div className="px-4 py-3 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border text-sm text-fly-ink flex items-center justify-between">
            <span>Кто меня лайкнул</span>
            {likedByCount > 0 && (
              <span className="text-xs font-bold text-white bg-fly-accent min-w-[20px] px-2 py-0.5 rounded-full text-center">
                {likedByCount}
              </span>
            )}
          </div>

          {/*
            Уведомления - через стандартный Web Push (см. usePushNotifications.ts),
            не своя рисованная система. unsupported/denied - показываем как есть,
            не нажимается: "denied" браузер не даёт спросить повторно из кода вообще,
            это можно поменять только вручную в настройках самого браузера.
          */}
          {pushNotifications.status === 'unsupported' ? (
            <div className="px-4 py-3 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border text-sm text-fly-gray">
              Уведомления не поддерживаются этим браузером
            </div>
          ) : pushNotifications.status === 'denied' ? (
            <div className="px-4 py-3 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border text-sm text-fly-gray">
              Уведомления запрещены в браузере
            </div>
          ) : (
            <button
              type="button"
              disabled={pushNotifications.loading}
              onClick={pushNotifications.subscribed ? pushNotifications.unsubscribe : pushNotifications.subscribe}
              className="px-4 py-3 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border text-sm text-fly-ink text-left transition-opacity disabled:opacity-60 flex items-center justify-between"
            >
              <span>Уведомления</span>
              <span className="text-xs font-semibold text-fly-gray">
                {pushNotifications.loading
                  ? '…'
                  : pushNotifications.subscribed
                    ? 'Включены · выключить'
                    : 'Включить'}
              </span>
            </button>
          )}
          {pushNotifications.error && (
            <p className="text-xs text-fly-gray px-1">{pushNotifications.error}</p>
          )}

          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="px-4 py-3 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border text-sm text-fly-ink text-left"
          >
            Помощь
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-3 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border text-sm text-fly-ink text-left"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  )
}
