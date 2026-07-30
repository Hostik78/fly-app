import { useEffect, useState, lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { FeedScreen } from './components/FeedScreen'
import { MessagesScreen } from './components/MessagesScreen'
import { AppShell } from './components/AppShell'
import { DevicePreview } from './components/DevicePreview'
import { LoginScreen } from './components/LoginScreen'
import { NotAtAirportScreen } from './components/NotAtAirportScreen'
import { useSession } from './lib/useSession'
import { useAirportPresence } from './lib/useAirportPresence'
import { supabase } from './lib/supabase'
import type { ProfileCategory } from './data/profiles'
import type { HobbyId } from './data/hobbies'

// lazy(...) - эти три экрана нужны не сразу при открытии приложения (анкета
// заполняется один раз, заметка редактируется редко, экран аккаунта - только
// по клику на вкладку). Раньше их код входил в тот же файл, что скачивается
// в самом начале для абсолютно всех - теперь браузер скачает их отдельным
// кусочком, только когда они реально понадобятся. Именованный экспорт
// (export function X) оборачиваем в .then(...), потому что lazy() ожидает
// export default - у наших компонентов его нет.
const AccountScreen = lazy(() => import('./components/AccountScreen').then((m) => ({ default: m.AccountScreen })))
const ProfileSetupScreen = lazy(() =>
  import('./components/ProfileSetupScreen').then((m) => ({ default: m.ProfileSetupScreen })),
)
const CreateStatusScreen = lazy(() =>
  import('./components/CreateStatusScreen').then((m) => ({ default: m.CreateStatusScreen })),
)

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
  const [hasPosted, setHasPosted] = useState(false)
  // Пока не знаем ни то, ни другое - показываем общий экран загрузки (см.
  // accountLoading в overallLoading ниже), а не следующий экран. Оба запроса
  // идут одновременно (Promise.all) - анкета и публикация не зависят друг от
  // друга, обеим нужен только session.user.id, поэтому нет смысла ждать одну
  // по очереди с другой.
  const [accountLoading, setAccountLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setAccountLoading(false)
      return
    }
    let cancelled = false
    setAccountLoading(true)
    // Сбрасываем на "нет анкеты/публикации", пока не пришёл ответ - иначе при
    // смене аккаунта в другой открытой вкладке (Supabase синхронизирует вход
    // через localStorage) на долю секунды могли бы остаться данные предыдущего
    // человека.
    setHasProfile(false)
    setHasPosted(false)

    Promise.all([
      supabase.from('profiles').select('user_id').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('posts').select('id').eq('user_id', session.user.id).maybeSingle(),
    ]).then(([profileResult, postResult]) => {
      if (!cancelled) {
        setHasProfile(!!profileResult.data)
        setHasPosted(!!postResult.data)
        setAccountLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  // Общая проверка "загрузки" перед показом приложения: сначала проверяем вход,
  // потом (уже войдя) анкету и публикацию разом.
  const overallLoading = loading || (!!session && accountLoading)

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
      {/*
        Suspense - "подожди, пока довскроется код" для трёх экранов, обёрнутых
        в lazy(...) выше (AccountScreen, ProfileSetupScreen, CreateStatusScreen).
        fallback показывается только на те доли секунды, пока грузится их файл -
        берём тот же пустой белый экран, что и для overallLoading, чтобы не было
        заметно разницы между "проверяем вход" и "довскрываем экран".
      */}
      <Suspense fallback={<div className="h-full w-full bg-white" />}>
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
      </Suspense>
    </DevicePreview>
  )
}

export default App
