import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { FeedScreen } from './components/FeedScreen'
import { MessagesScreen } from './components/MessagesScreen'
import { AccountScreen } from './components/AccountScreen'
import { AppShell } from './components/AppShell'
import { CreateStatusScreen } from './components/CreateStatusScreen'
import { DevicePreview } from './components/DevicePreview'
import { LoginScreen } from './components/LoginScreen'
import { useSession } from './lib/useSession'
import { supabase } from './lib/supabase'
import type { Profile, ProfileCategory } from './data/profiles'
import type { HobbyId } from './data/hobbies'

// RequireStatus — "охранник" маршрутов: пока человек не опубликовал свою заметку
// (hasPosted === false), любая попытка попасть на Ленту/Сообщения/Аккаунт
// перенаправляется на экран создания заметки. Это и есть механика Pure -
// сначала пишешь сам, потом видишь остальных.
function RequireStatus({ hasPosted }: { hasPosted: boolean }) {
  if (!hasPosted) return <Navigate to="/new" replace />
  return <Outlet />
}

// Корневой компонент приложения — то, с чего всё начинается.
//
// hasPosted живёт здесь же: как только человек опубликовал заметку на экране
// CreateStatusScreen, мы открываем доступ ко всему остальному приложению.
// Пока это просто состояние в памяти (сбрасывается при перезагрузке страницы) -
// этого достаточно для первого шага, позже можно будет сохранять его понастоящему.
//
// DevicePreview снаружи — это НЕ часть самого приложения, а инструмент для удобной
// разработки (рамка телефона). Когда дойдём до публикации для настоящих
// пользователей, эту обёртку можно будет просто убрать.
function App() {
  const { session, loading } = useSession()
  const [hasPosted, setHasPosted] = useState(false)
  // Пока не знаем, есть ли уже публикация у вошедшего человека - показываем общий
  // экран загрузки (см. postLoading в overallLoading ниже), а не экран создания.
  const [postLoading, setPostLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setPostLoading(false)
      return
    }
    let cancelled = false
    setPostLoading(true)
    supabase
      .from('posts')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setHasPosted(!!data)
          setPostLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  // Общая проверка "загрузки" перед показом приложения: либо ещё проверяем вход,
  // либо (уже войдя) ещё проверяем, есть ли публикация.
  const overallLoading = loading || (!!session && postLoading)

  // Список анкет, с которыми уже "совпали" (взаимный лайк) - живёт здесь, а не в самой
  // Ленте, потому что его должны видеть и Лента, и Сообщения одновременно.
  const [matches, setMatches] = useState<Profile[]>([])

  async function handlePublish(quote: string, category: ProfileCategory, hobby: HobbyId | null) {
    if (!session) return
    const { error } = await supabase
      .from('posts')
      .insert({ user_id: session.user.id, quote, category, hobby })
    if (error) throw error
    setHasPosted(true)
  }

  // Вызывается при лайке карточки на Ленте. Совпадение случается, только если человек
  // на тестовых данных отмечен как "заранее заинтересован в вас" (interestedInYou) -
  // по-настоящему это будет известно лишь после реального лайка с той стороны.
  function handleLike(profile: Profile) {
    if (!profile.interestedInYou) return
    setMatches((current) => {
      // profile.quote используется как уникальный идентификатор анкеты (у тестовых
      // данных пока нет отдельного поля id) - не добавляем одно и то же совпадение дважды.
      if (current.some((match) => match.quote === profile.quote)) return current
      return [...current, profile]
    })
  }

  return (
    <DevicePreview>
      {overallLoading ? (
        // Проверка входа занимает доли секунды - полноценный экран загрузки не нужен
        <div className="h-full w-full bg-white" />
      ) : !session ? (
        <LoginScreen />
      ) : (
        /*
          HashRouter, а не BrowserRouter: маршруты хранятся после знака "#" в адресе
          (например, .../#/messages), а не в самом пути страницы. Это специально нужно,
          когда сайт может открыться по любому, заранее неизвестному адресу (например,
          опубликованный снимок на claude.ai) - роутер тогда не зависит от того,
          по какому именно пути его открыли.
        */
        <HashRouter>
          <Routes>
            {/*
              Если заметка уже опубликована, а человек всё равно зашёл на /new (например, по старой
              ссылке) - сразу отправляем его в ленту. Это же условие само сработает и сразу после
              публикации: hasPosted меняется -> App перерисовывается -> элемент маршрута пересчитывается.
            */}
            <Route
              path="/new"
              element={hasPosted ? <Navigate to="/" replace /> : <CreateStatusScreen onSubmit={handlePublish} />}
            />
            <Route element={<RequireStatus hasPosted={hasPosted} />}>
              <Route element={<AppShell matches={matches} onLike={handleLike} />}>
                <Route index element={<FeedScreen />} />
                <Route path="messages" element={<MessagesScreen />} />
                <Route path="account" element={<AccountScreen />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      )}
    </DevicePreview>
  )
}

export default App
