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
// видна СРАЗУ и остаётся видна, пока видео явно не запущено кодом ниже (см.
// autoPlay - его тут намеренно нет).
//
// preload="auto" - явная просьба браузеру начать грузить видео заранее (см.
// также main.tsx - там ещё раньше есть отдельная подсказка <link rel="preload">).
//
// Почему НЕТ autoPlay: раньше видео запускалось сразу, как только появлялся
// хотя бы первый кадр ('loadeddata') - на медленном мобильном интернете это
// означало, что проигрывание стартует, когда скачана только небольшая часть
// файла, а дальше браузер то и дело останавливается на долю секунды, чтобы
// докачать следующий кусок - видео "подвисало" прямо во время показа. Теперь
// запуск (.play()) откладывается до события 'canplaythrough' - браузер сам
// присылает его именно тогда, когда, по его оценке, докачает остаток файла
// быстрее, чем видео успеет его "проиграть" - то есть проигрывание больше не
// должно останавливаться на середине. Пока это событие не пришло - виден
// статичный кадр (poster), тоже не пустой экран.
//
// Запасной таймер (FALLBACK_READY_MS) - на случай, если 'canplaythrough' так и
// не пришло (например, совсем нет сети) - экран загрузки не должен зависнуть
// навечно из-за одного лишь ролика. Он же на всякий случай пробует запустить
// .play() - если видео к этому моменту готово частично, лучше показать хоть
// что-то, чем ничего.
import { useEffect, useRef } from 'react'
import loadingVideo from '../assets/loading-screen.mp4'
import loadingPoster from '../assets/loading-screen-poster.jpg'

const FALLBACK_READY_MS = 3500

interface LoadingScreenProps {
  onReady: () => void
}

export function LoadingScreen({ onReady }: LoadingScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Общий "флажок" между запасным таймером и событием 'canplaythrough' - неважно,
  // что сработает раньше, onReady должен уйти наружу только один раз.
  const readyCalledRef = useRef(false)

  function callOnReadyOnce() {
    if (readyCalledRef.current) return
    readyCalledRef.current = true
    onReady()
  }

  function handleCanPlayThrough() {
    videoRef.current?.play().catch(() => {})
    callOnReadyOnce()
  }

  useEffect(() => {
    const video = videoRef.current
    // Если браузер уже успел докачать видео раньше, чем React повесил
    // обработчик onCanPlayThrough ниже (бывает при закешированном видео на
    // повторном заходе) - readyState 4 (HAVE_ENOUGH_DATA) означает, что
    // событие уже прошло мимо нас, и ждать его больше не нужно.
    if (video && video.readyState >= 4) {
      handleCanPlayThrough()
    }
    const fallback = setTimeout(handleCanPlayThrough, FALLBACK_READY_MS)
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
        muted
        loop
        playsInline
        onCanPlayThrough={handleCanPlayThrough}
        className="h-full w-full object-cover"
      />
    </div>
  )
}
