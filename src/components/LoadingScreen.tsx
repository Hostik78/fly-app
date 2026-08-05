// Экран загрузки - показывается в самом начале, пока приложение проверяет,
// вошли ли вы в аккаунт (см. overallLoading/showLoadingScreen в App.tsx) -
// одинаково и для тех, кто уже входил раньше, и для тех, кто открывает сайт
// впервые. Ролик зациклен (loop) на случай, если проверка займёт дольше своих
// исходных 8 секунд.
//
// bg-fly-bg (не bg-white) - тот же самый цвет фона, что указан в манифесте
// PWA (background_color) и в настройках Android-приложения (backgroundColor
// в android/twa-manifest.json). Без этого совпадения между "родным" экраном
// заставки, который на телефоне рисует сама операционная система/браузер ДО
// того, как вообще успевает загрузиться наш сайт (это отдельный механизм,
// наш код его не рисует и не может убрать), и этим уже нашим экраном мог
// проскочить короткий цветовой "скачок" - выглядело бы как два разных
// экрана подряд, а не один плавный переход.
//
// poster - статичная картинка (первый кадр видео, см. loading-screen-poster.jpg) -
// видна СРАЗУ, ещё до того как само видео (тяжелее картинки) успеет скачаться
// из интернета.
//
// preload="auto" - явная просьба браузеру начать грузить видео заранее (см.
// также main.tsx - там ещё раньше есть отдельная подсказка <link rel="preload">).
//
// autoPlay + muted + playsInline - стандартное для браузеров сочетание:
// видео без звука браузер разрешает запускать само, без нажатия пользователем.
// playsInline - чтобы видео на iPhone проигрывалось прямо на месте, а не
// разворачивалось на весь экран поверх интерфейса.
//
// onReady (см. App.tsx) - вызывается, как только у видео РЕАЛЬНО появился
// готовый к показу первый кадр (событие 'loadeddata'), а не по истечении
// заранее выбранного времени - переход к остальному приложению происходит
// сразу, как только это произошло И данные (профиль, гео и т.п.) готовы, что
// раньше наступит.
//
// 'loadeddata', а не 'playing' - специально: 'playing' требует, чтобы
// проигрывание РЕАЛЬНО началось, а автозапуск видео в некоторых окружениях
// (например, режим экономии трафика, политики некоторых корпоративных
// телефонов) браузер может тихо заблокировать - тогда 'playing' не наступил
// бы вообще никогда, и пришлось бы каждый раз ждать запасные 2.5 секунды по
// таймеру, даже если картинка давно готова к показу. 'loadeddata' зависит
// только от того, скачался ли и декодировался ли первый кадр - он наступает
// независимо от того, разрешил ли браузер автозапуск.
//
// Если видео по какой-то причине (например, нет сети) так и не загрузилось -
// запасной таймер на 2.5 секунды всё равно даёт команду двигаться дальше,
// чтобы экран загрузки не завис бесконечно из-за одного лишь ролика.
import { useEffect, useRef } from 'react'
import loadingVideo from '../assets/loading-screen.mp4'
import loadingPoster from '../assets/loading-screen-poster.jpg'

const FALLBACK_READY_MS = 2500

interface LoadingScreenProps {
  onReady: () => void
}

export function LoadingScreen({ onReady }: LoadingScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Общий "флажок" между запасным таймером и событием 'loadeddata' - неважно,
  // что сработает раньше, onReady должен уйти наружу только один раз.
  const readyCalledRef = useRef(false)

  function callOnReadyOnce() {
    if (readyCalledRef.current) return
    readyCalledRef.current = true
    onReady()
  }

  useEffect(() => {
    const video = videoRef.current
    // Если браузер уже успел загрузить первый кадр раньше, чем React повесил
    // обработчик onLoadedData ниже (бывает при очень быстром/закешированном
    // видео) - readyState >= 2 (HAVE_CURRENT_DATA) означает, что событие уже
    // прошло мимо нас, и ждать его больше не нужно.
    if (video && video.readyState >= 2) {
      callOnReadyOnce()
    }
    video?.play().catch(() => {})
    const fallback = setTimeout(callOnReadyOnce, FALLBACK_READY_MS)
    return () => clearTimeout(fallback)
    // onReady стабильна между рендерами (см. useCallback в App.tsx) -
    // эффект не должен перезапускаться на каждый рендер самого экрана.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-full w-full overflow-hidden bg-fly-bg">
      <video
        ref={videoRef}
        src={loadingVideo}
        poster={loadingPoster}
        preload="auto"
        autoPlay
        muted
        loop
        playsInline
        onLoadedData={callOnReadyOnce}
        className="h-full w-full object-cover"
      />
    </div>
  )
}
