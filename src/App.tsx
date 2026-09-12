import { Suspense, useCallback, useEffect, useState, lazy, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { FeedScreen } from './components/FeedScreen'
import { MessagesScreen } from './components/MessagesScreen'
import { AppShell } from './components/AppShell'
import { CreateStatusScreen } from './components/CreateStatusScreen'
import { LoginScreen } from './components/LoginScreen'
import { ProfileSetupScreen } from './components/ProfileSetupScreen'
import { NotAtAirportScreen } from './components/NotAtAirportScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { useSession } from './lib/useSession'
import { useAirportPresence } from './lib/useAirportPresence'
import { supabase } from './lib/supabase'
import type { ProfileCategory } from './data/profiles'
import type { HobbyId } from './data/hobbies'
import { isExistingProfileConflict } from './lib/profilePersistence'
import { firstDatabaseReadError, reportDatabaseReadError } from './lib/databaseReadError'
import { LoadErrorState } from './components/LoadErrorState'
import { consumeLoadingSkipAfterAutoUpdate } from './lib/loadingLifecycle'

// Заставка с волнами (см. LoadingScreen.tsx) создаётся один раз на каждый
// настоящий запуск документа. Поэтому обычная перезагрузка страницы и новый
// запуск приложения после выгрузки из памяти снова показывают волны. А быстрое
// переключение в Telegram, блокировка телефона или возврат в уже живую вкладку
// ничего не перемонтируют — React остаётся в памяти, и заставка не появляется.
// Отдельная отметка в sessionStorage здесь не нужна и даже вредна: это хранилище
// переживает Command+R, поэтому прежняя логика ошибочно пропускала новый запуск.
// Минимальное время показа нужно, чтобы даже при мгновенной загрузке заставка
// не мелькала одним кадром. Если данные требуют больше времени, живая графика
// продолжает двигаться сколько угодно и закрывается только после их готовности.
const FIXED_LOADING_SCREEN_MS = 1400

// Локальный режим просмотра заставки: позволяет дизайнеру спокойно оценить
// бесконечное движение, не пытаясь поймать короткие 1,4 секунды настоящего
// запуска. Работает только через npm run dev и полностью вырезается из сборки.
const splashPreviewTheme = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('splash')
  : null
const isSplashPreview = splashPreviewTheme === 'light' || splashPreviewTheme === 'dark'
if (isSplashPreview) document.documentElement.dataset.theme = splashPreviewTheme

// lazy(...) - только AccountScreen: нужен не всем и не сразу (только по клику
// на вкладку "Аккаунт"), поэтому его код браузер скачает отдельным кусочком,
// когда он реально понадобится (граница ожидания - Suspense - стоит внутри
// AppShell.tsx, вокруг <Outlet/>, а не здесь - см. её комментарий там: если
// поставить границу тут, на время догрузки пропадала бы вообще вся нижняя
// навигация, а не только содержимое вкладки).
//
// ProfileSetupScreen и CreateStatusScreen раньше тоже были lazy, но это оказалось
// плохим компромиссом: это не "редко нужные" экраны, а ОБЯЗАТЕЛЬНЫЙ шаг для 100%
// новых людей сразу после входа, один за другим - и именно в этот момент (первое
// впечатление) стало на одну-две лишних паузы с пустым экраном больше, а видимая
// экономия у самих этих двух экранов небольшая. Вернули на обычную загрузку.
// Именованный экспорт (export function X) оборачиваем в .then(...), потому что
// lazy() ожидает export default - у наших компонентов его нет.
const AccountScreen = lazy(() => import('./components/AccountScreen').then((m) => ({ default: m.AccountScreen })))

// Сам симулятор загружается отдельным dev-only куском. В production условие DEV
// заранее превращается в false, поэтому ни его JavaScript, ни отдельный CSS-файл
// панели не попадают в то, что скачивает настоящий пользователь.
const DevicePreview = import.meta.env.DEV
  ? lazy(() => import('./components/DevicePreview').then((m) => ({ default: m.DevicePreview })))
  : null

const isEmbeddedDevicePreview = import.meta.env.DEV
  && new URLSearchParams(window.location.search).has('device-preview')
const shouldUseDevicePreview = import.meta.env.DEV
  && !isEmbeddedDevicePreview
  && window.matchMedia('(pointer: fine)').matches

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
  if (status === 'checking') return <div className="h-full w-full" />
  if (status !== 'at-airport' && status !== 'test-access') {
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
// DevicePreview — не часть самого приложения, а отдельная локальная «студия».
// FlyApp остаётся единым настоящим приложением: в iframe студии и на реальном
// телефоне запускается один и тот же компонент. На сенсорном устройстве dev-сервер
// тоже открывает FlyApp напрямую, без нарисованного «телефона внутри телефона».
function FlyApp() {
  const { session, loading, error: sessionError, retry: retrySession } = useSession()
  const [hasProfile, setHasProfile] = useState(false)
  const [hasPosted, setHasPosted] = useState(false)
  // Пока не знаем ни то, ни другое - показываем общий экран загрузки (см.
  // accountLoading в overallLoading ниже), а не следующий экран. Оба запроса
  // идут одновременно (Promise.all) - анкета и публикация не зависят друг от
  // друга, обеим нужен только session.user.id, поэтому нет смысла ждать одну
  // по очереди с другой.
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState(false)
  const [accountLoadAttempt, setAccountLoadAttempt] = useState(0)
  const currentUserId = session?.user.id

  useEffect(() => {
    if (!currentUserId) {
      setAccountError(false)
      setAccountLoading(false)
      return
    }
    let cancelled = false
    setAccountLoading(true)
    setAccountError(false)
    // Сбрасываем на "нет анкеты/публикации", пока не пришёл ответ - иначе при
    // смене аккаунта в другой открытой вкладке (Supabase синхронизирует вход
    // через localStorage) на долю секунды могли бы остаться данные предыдущего
    // человека.
    setHasProfile(false)
    setHasPosted(false)

    Promise.all([
      supabase.from('profiles').select('user_id').eq('user_id', currentUserId).maybeSingle(),
      supabase.from('posts').select('id').eq('user_id', currentUserId).maybeSingle(),
    ]).then(([profileResult, postResult]) => {
      if (cancelled) return
      const error = firstDatabaseReadError(profileResult, postResult)
      if (error) {
        reportDatabaseReadError('не удалось проверить анкету и заметку при входе', error)
        setAccountError(true)
        setAccountLoading(false)
        return
      }
      setHasProfile(!!profileResult.data)
      setHasPosted(!!postResult.data)
      setAccountLoading(false)
    }).catch((error: unknown) => {
      if (cancelled) return
      reportDatabaseReadError('неожиданная ошибка проверки аккаунта', error)
      setAccountError(true)
      setAccountLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [currentUserId, accountLoadAttempt])

  // Общая проверка "загрузки" перед показом приложения: сначала проверяем вход,
  // потом (уже войдя) анкету и публикацию разом.
  const overallLoading = loading || (!!session && accountLoading)

  // На каждом новом запуске документа держим заставку минимум заданное время.
  // Если проверка входа/анкеты требует больше времени, волны продолжают жить
  // до готовности настоящих данных — пустой экран между ними и приложением не
  // появляется.
  const [skipLoadingAfterAutoUpdate] = useState(consumeLoadingSkipAfterAutoUpdate)
  const [fixedTimeElapsed, setFixedTimeElapsed] = useState(skipLoadingAfterAutoUpdate)
  useEffect(() => {
    if (skipLoadingAfterAutoUpdate) return
    const timer = setTimeout(() => setFixedTimeElapsed(true), FIXED_LOADING_SCREEN_MS)
    return () => clearTimeout(timer)
  }, [skipLoadingAfterAutoUpdate])
  const showLoadingScreen = !skipLoadingAfterAutoUpdate && (overallLoading || !fixedTimeElapsed)
  // Заставка остаётся смонтированной ещё немного после готовности приложения,
  // чтобы успеть плавно раствориться НАД уже открытым экраном, а не исчезнуть
  // скачком перед тем, как React начнёт рисовать ленту.
  // После растворения слой окончательно удаляется до конца жизни этого
  // документа. Обычные перерисовки и возврат вкладки в фокус его не создают.
  const [loadingScreenMounted, setLoadingScreenMounted] = useState(!skipLoadingAfterAutoUpdate)
  const handleLoadingScreenFinished = useCallback(() => {
    setLoadingScreenMounted(false)
  }, [])

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
    // Если первый запрос дошёл до базы, а ответ потерялся, повторный insert
    // закономерно сообщает «такая анкета уже есть». Считаем это успехом, но
    // НЕ обновляем строку: так временная ошибка чтения не затрёт старую анкету.
    if (error && !isExistingProfileConflict(error)) throw error
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

  // Пока данные ещё неизвестны, под непрозрачной заставкой лежит нейтральный
  // пустой слой. Как только данные готовы, настоящий экран монтируется сразу,
  // а заставка ещё 650 мс мягко растворяется над ним.
  const appContent = overallLoading ? (
    <div className="h-full w-full bg-fly-bg" />
  ) : sessionError ? (
    <LoadErrorState
      onRetry={retrySession}
      title="Не удалось проверить вход"
    />
  ) : !session ? (
    <LoginScreen />
  ) : accountError ? (
    <LoadErrorState onRetry={() => setAccountLoadAttempt((attempt) => attempt + 1)} />
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
  )

  const content = isSplashPreview ? (
    <div className="relative h-full w-full overflow-hidden">
      <LoadingScreen leaving={false} onFinished={() => {}} />
    </div>
  ) : (
    <div className="relative h-full w-full overflow-hidden">
      {appContent}
      {loadingScreenMounted && (
        <LoadingScreen
          leaving={!showLoadingScreen}
          onFinished={handleLoadingScreenFinished}
        />
      )}
    </div>
  )

  return content
}

function App() {
  if (shouldUseDevicePreview && DevicePreview) {
    return (
      <Suspense fallback={<div style={{ width: '100%', height: '100%', background: '#100D16' }} />}>
        <DevicePreview />
      </Suspense>
    )
  }
  return <FlyApp />
}

export default App
