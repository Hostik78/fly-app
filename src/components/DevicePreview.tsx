import { useEffect, useRef, useState, type ReactNode } from 'react'

// Какой вырез экрана у устройства — это ДАННЫЕ, а не отдельная логика под каждую модель.
// 'none' - нет выреза, 'dynamic-island' - плавающая таблетка (iPhone 14 Pro/15+)
type CutoutType = 'none' | 'notch' | 'dynamic-island' | 'punch-hole'

// Фиксированный размер рамки предпросмотра - без выпадающего списка моделей и кнопок зума,
// просто один разумный размер по умолчанию (iPhone 14 Pro / 15).
const DEVICE = { width: 393, height: 852, cutout: 'dynamic-island' as CutoutType }

// Границы зума для жеста pinch-to-zoom трекпадом (кнопок для этого больше нет,
// но жест двумя пальцами по-прежнему работает)
const ZOOM_MIN = 50
const ZOOM_MAX = 150

interface DevicePreviewProps {
  children: ReactNode // то, что показываем внутри рамки телефона (экран приложения)
}

// Рисует вырез экрана нужной формы
function DeviceCutout({ cutout }: { cutout: CutoutType }) {
  if (cutout === 'notch') {
    return <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-6 bg-black rounded-b-2xl z-10" />
  }
  if (cutout === 'dynamic-island') {
    return <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[90px] h-[26px] bg-black rounded-full z-10" />
  }
  if (cutout === 'punch-hole') {
    return <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black rounded-full z-10" />
  }
  return null
}

// DevicePreview — это НЕ часть самого приложения, а инструмент для удобной разработки:
// просто рамка телефона вокруг экрана. Когда придёт время публиковать готовое приложение
// для настоящих пользователей, эту обёртку можно будет просто убрать, оставив <FeedScreen />.
export function DevicePreview({ children }: DevicePreviewProps) {
  const [zoom, setZoom] = useState(100)
  // Ссылка на обёртку рамки телефона - именно на ней ловим жест pinch-to-zoom
  const frameWrapperRef = useRef<HTMLDivElement>(null)
  const scale = zoom / 100

  // Жест "сжать/разжать двумя пальцами" на трекпаде macOS браузер передаёт как обычное
  // колесо мыши (wheel), но с зажатой клавишей Ctrl. Слушаем такие события и вместо
  // прокрутки страницы меняем зум рамки.
  useEffect(() => {
    const frameWrapper = frameWrapperRef.current
    if (!frameWrapper) return

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey) return
      event.preventDefault()
      setZoom((current) => {
        const next = Math.round(current - event.deltaY)
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
      })
    }

    frameWrapper.addEventListener('wheel', handleWheel, { passive: false })
    return () => frameWrapper.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#e9edf3]">
      {/* Внешняя обёртка размером точно под текущий масштаб — нужна, чтобы после
          трансформации рамка занимала на странице ровно столько места, сколько видно глазами */}
      <div
        ref={frameWrapperRef}
        style={{ width: DEVICE.width * scale, height: DEVICE.height * scale }}
        className="relative"
      >
        <div
          style={{
            width: DEVICE.width,
            height: DEVICE.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            willChange: 'transform',
          }}
          className="absolute top-0 left-0 bg-black rounded-[54px] p-3 shadow-[0_30px_60px_rgba(30,40,70,0.18)]"
        >
          <DeviceCutout cutout={DEVICE.cutout} />
          <div className="w-full h-full rounded-[42px] overflow-hidden bg-white">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
