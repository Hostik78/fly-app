import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { FeedScreen } from './components/FeedScreen'
import { MessagesScreen } from './components/MessagesScreen'
import { AccountScreen } from './components/AccountScreen'
import { AppShell } from './components/AppShell'
import { CreateStatusScreen } from './components/CreateStatusScreen'
import { DevicePreview } from './components/DevicePreview'
import { LoginScreen } from './components/LoginScreen'
import { ProfileSetupScreen } from './components/ProfileSetupScreen'
import { NotAtAirportScreen } from './components/NotAtAirportScreen'
import { useSession } from './lib/useSession'
import { useAirportPresence } from './lib/useAirportPresence'
import { supabase } from './lib/supabase'
import type { ProfileCategory } from './data/profiles'
import type { HobbyId } from './data/hobbies'

// RequireStatus — "охранник" маршрутов: пока человек не опубликовал свою заметку
// (hasPosted === false), любая попытка попасть на Ленту/Сообщения/Аккаунт
// перенаправляется на экран создания заметки. Это и есть механика Pure -
// сначала пишешь сам, потом видишь остальных.
function RequireStatus({ hasPosted }: { hasPosted: boolean }) {
  if (!hasPosted) return <Navigate to="/new" replace />
  return <Outlet />
}

// RequireAirport — второй "охранник", но не редиректит (тут некуда - это не
// отдельный маршрут, а состояние прямо на месте): проверяет геолокацию и либо
// показывает то, что ему передали (children), либо NotAtAirportScreen с понятным
// объяснением. Оборачивает только ленту и первую публикацию - см. design-спеку
// "Что именно требует нахождения в аэропорту" (2026-07-29-airport-geofence-design.md).
function RequireAirport({ children }: { children: ReactNode }) {
  const { status, distanceKm, retry } = useAirportPresence()
  if (status === 'checking') return <div className="h-full w-full bg-white" />
  if (status !== 'at-airport') {
    return <NotAtAirportScreen status={status} distanceKm={distanceKm} onRetry={retry} />
  }
  return <>{children}</>
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
  const [hasProfile, setHasProfile] = useState(false)
  // Пока не знаем, заполнил ли вошедший человек анкету о себе - показываем общий
  // экран загрузки (см. profileLoading в overallLoading ниже), а не следующий экран.
  const [profileLoading, setProfileLoading] = useState(true)
  const [hasPosted, setHasPosted] = useState(false)
  // Пока не знаем, есть ли уже публикация у вошедшего человека - показываем общий
  // экран загрузки (см. postLoading в overallLoading ниже), а не экран создания.
  const [postLoading, setPostLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setProfileLoading(false)
      return
    }
    let cancelled = false
    setProfileLoading(true)
    supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setHasProfile(!!data)
          setProfileLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  useEffect(() => {
    // Ждём, пока не станет известно, что анкета уже есть - иначе успели бы
    // без нужды сходить в базу за публикацией раньше, чем показать анкету.
    if (!session || !hasProfile) return
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
  }, [session?.user.id, hasProfile])

  // Общая проверка "загрузки" перед показом приложения: сначала проверяем вход,
  // потом (уже войдя) анкету, потом (уже с анкетой) публикацию - по очереди,
  // а не тремя параллельными запросами.
  const overallLoading = loading || (!!session && (profileLoading || (hasProfile && postLoading)))

  async function handleProfileSubmit(
    gender: 'male' | 'female' | null,
    age: number | null,
    height: number | null,
    languages: string | null,
  ) {
    if (!session) return
    const { error } = await supabase
      .from('profiles')
      .insert({ user_id: session.user.id, gender, age, height, languages })
    if (error) throw error
    setHasProfile(true)
  }

  async function handlePublish(quote: string, category: ProfileCategory, hobby: HobbyId | null) {
    if (!session) return
    const { error } = await supabase
      .from('posts')
      .insert({ user_id: session.user.id, quote, category, hobby })
    if (error) throw error
    setHasPosted(true)
  }

  return (
    <DevicePreview>
      {overallLoading ? (
        // Проверка входа занимает доли секунды - полноценный экран загрузки не нужен
        <div className="h-full w-full bg-white" />
      ) : !session ? (
        <LoginScreen />
      ) : !hasProfile ? (
        <ProfileSetupScreen onSubmit={handleProfileSubmit} />
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
              element={
                hasPosted ? (
                  <Navigate to="/" replace />
                ) : (
                  <RequireAirport>
                    <CreateStatusScreen onSubmit={handlePublish} />
                  </RequireAirport>
                )
              }
            />
            <Route element={<RequireStatus hasPosted={hasPosted} />}>
              <Route element={<AppShell currentUserId={session.user.id} />}>
                <Route
                  index
                  element={
                    <RequireAirport>
                      <FeedScreen />
                    </RequireAirport>
                  }
                />
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
