import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DeviceGlyphIcon, SidePanelIcon, ZoomInIcon, ZoomOutIcon } from './icons'

// Какой вырез экрана у устройства — это ДАННЫЕ, а не отдельная логика под каждую модель.
// Компонент ниже просто читает это поле и рисует нужную фигуру (или ничего).
// 'none' - нет выреза (например, iPhone SE с кнопкой Touch ID, любой планшет)
// 'notch' - классическая "чёлка" (старые iPhone с Face ID)
// 'dynamic-island' - плавающая таблетка (новые iPhone Pro/15+)
// 'punch-hole' - маленькая круглая дырка под камеру (большинство Android)
type CutoutType = 'none' | 'notch' | 'dynamic-island' | 'punch-hole'

// Группа в выпадающем списке — просто для удобной навигации по длинному списку устройств.
type DeviceGroup = 'iPhone' | 'Android' | 'Планшеты'

interface DeviceOption {
  id: string
  label: string
  width: number
  height: number
  cutout: CutoutType
  group: DeviceGroup
}

// Стандартный набор устройств — логические размеры экрана в точках (не "окно минус тулбар
// браузера", а полный экран целиком, как в симуляторе Xcode/Android Studio).
// iPhone - официальные размеры из Apple Human Interface Guidelines.
// Android - типичные референсные устройства (Pixel, Samsung Galaxy), которые чаще всего
// используют для проверки вёрстки, аналогично списку в Chrome DevTools.
const devices: DeviceOption[] = [
  // iPhone
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667, cutout: 'none', group: 'iPhone' },
  { id: 'iphone-13-mini', label: 'iPhone 13 mini', width: 375, height: 812, cutout: 'notch', group: 'iPhone' },
  { id: 'iphone-14', label: 'iPhone 13 / 14', width: 390, height: 844, cutout: 'notch', group: 'iPhone' },
  { id: 'iphone-15', label: 'iPhone 14 Pro / 15', width: 393, height: 852, cutout: 'dynamic-island', group: 'iPhone' },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, height: 932, cutout: 'dynamic-island', group: 'iPhone' },
  // Android
  { id: 'galaxy-s23', label: 'Samsung Galaxy S23', width: 360, height: 780, cutout: 'punch-hole', group: 'Android' },
  { id: 'pixel-7', label: 'Google Pixel 7', width: 412, height: 915, cutout: 'punch-hole', group: 'Android' },
  { id: 'galaxy-s23-ultra', label: 'Samsung Galaxy S23 Ultra', width: 384, height: 824, cutout: 'punch-hole', group: 'Android' },
  // Планшеты
  { id: 'ipad-mini', label: 'iPad mini', width: 768, height: 1024, cutout: 'none', group: 'Планшеты' },
  { id: 'ipad-air', label: 'iPad Air', width: 820, height: 1180, cutout: 'none', group: 'Планшеты' },
  { id: 'ipad-pro', label: 'iPad Pro 12.9″', width: 1024, height: 1366, cutout: 'none', group: 'Планшеты' },
]

// Порядок групп в выпадающем списке
const groupOrder: DeviceGroup[] = ['iPhone', 'Android', 'Планшеты']

// Границы и шаг для ручного зума — вместо того, чтобы полагаться на зум трекпада/браузера,
// который может не работать (например, внутри окна просмотра артефакта) или подтормаживать.
const ZOOM_MIN = 50
const ZOOM_MAX = 150
const ZOOM_STEP = 10

interface DevicePreviewProps {
  children: ReactNode // то, что показываем внутри рамки телефона (экран приложения)
  controlsSlot?: ReactNode // необязательная панель сбоку (например, панель экспериментов с контентом)
}

// Рисует вырез экрана нужной формы по данным устройства — единственное место,
// где вообще есть разница между моделями, и оно управляется данными, а не условиями "if iPhone".
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
  return null // 'none' - у устройства нет выреза, ничего не рисуем
}

// DevicePreview — это НЕ часть самого приложения, а инструмент для удобной разработки:
// рамка телефона + выбор модели + зум, похоже на предпросмотр в Xcode.
// Когда придёт время публиковать готовое приложение для настоящих пользователей,
// эту обёртку можно будет просто убрать, оставив один <FeedScreen />.
export function DevicePreview({ children, controlsSlot }: DevicePreviewProps) {
  // Какая модель телефона выбрана сейчас. По умолчанию — iPhone 14 Pro / 15.
  const [deviceId, setDeviceId] = useState('iphone-15')
  // Текущий масштаб в процентах: 100% - реальный размер экрана телефона.
  const [zoom, setZoom] = useState(100)
  // Показана ли панель экспериментов сбоку от рамки телефона
  const [showControls, setShowControls] = useState(true)
  // Ссылка на обёртку рамки телефона - именно на ней ловим жест pinch-to-zoom
  const frameWrapperRef = useRef<HTMLDivElement>(null)

  const device = devices.find((item) => item.id === deviceId) ?? devices[3]
  const scale = zoom / 100

  // Жест "сжать/разжать двумя пальцами" на трекпаде macOS браузер передаёт как обычное
  // колесо мыши (wheel), но с зажатой клавишей Ctrl - так уже давно принято во всех браузерах,
  // это не наша выдумка. Слушаем именно такие события и вместо прокрутки страницы меняем зум.
  // React вешает wheel-обработчики как "passive" по умолчанию, а preventDefault в passive-режиме
  // браузер игнорирует - поэтому подписываемся на настоящее DOM-событие через useEffect,
  // указывая passive: false, чтобы preventDefault реально сработал.
  useEffect(() => {
    const frameWrapper = frameWrapperRef.current
    if (!frameWrapper) return

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey) return // обычная прокрутка (без Ctrl) нас не касается
      event.preventDefault() // не даём странице заодно масштабироваться целиком
      setZoom((current) => {
        const next = Math.round(current - event.deltaY)
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
      })
    }

    frameWrapper.addEventListener('wheel', handleWheel, { passive: false })
    return () => frameWrapper.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#e9edf3]">
      {/* Панель управления предпросмотром — по виду похожа на панель инструментов Xcode:
          одна цельная плашка, разделитель между группами кнопок, системный шрифт macOS.
          Фон здесь сплошной (без backdrop-blur) - размытие фона дорого стоит браузеру
          при каждом кадре зума трекпадом и вызывает подтормаживание (см. LESSONS.md). */}
      <div className="sticky top-0 z-20 w-full flex justify-center py-4 px-5">
        <div
          className="flex items-center gap-3 bg-white border border-black/[0.06] rounded-xl shadow-[0_4px_16px_rgba(30,40,70,0.10)] px-3 py-2 flex-wrap justify-center"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
        >
          {/* Выпадающий список моделей телефона, сгруппированный по категориям —
              стандартный HTML <optgroup>, без собственного велосипеда для группировки */}
          <label className="flex items-center gap-2 text-[13px] font-medium text-fly-ink">
            <DeviceGlyphIcon />
            <select
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="bg-[#F4F5F8] rounded-lg pl-2.5 pr-1.5 py-1.5 cursor-pointer outline-none border border-transparent hover:bg-[#ECEDF2] focus:border-fly-blue max-w-[220px]"
            >
              {groupOrder.map((group) => (
                <optgroup key={group} label={group}>
                  {devices
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} — {item.width}×{item.height}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>

          {/* Разделитель между группой "устройство" и группой "зум" — как в тулбаре Xcode */}
          <div className="w-px h-6 bg-black/10" />

          {/* Кнопки ручного зума: минус (лупа с минусом), процент, плюс (лупа с плюсом) */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setZoom((current) => Math.max(ZOOM_MIN, current - ZOOM_STEP))}
              disabled={zoom <= ZOOM_MIN}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-fly-ink hover:bg-[#F4F5F8] active:bg-[#E9EBF1] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              aria-label="Уменьшить масштаб"
            >
              <ZoomOutIcon />
            </button>
            <span className="text-[13px] font-medium text-fly-gray w-11 text-center tabular-nums select-none">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((current) => Math.min(ZOOM_MAX, current + ZOOM_STEP))}
              disabled={zoom >= ZOOM_MAX}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-fly-ink hover:bg-[#F4F5F8] active:bg-[#E9EBF1] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              aria-label="Увеличить масштаб"
            >
              <ZoomInIcon />
            </button>
          </div>

          {/* Кнопка показать/скрыть панель экспериментов - только если она вообще передана снаружи */}
          {controlsSlot && (
            <>
              <div className="w-px h-6 bg-black/10" />
              <button
                type="button"
                onClick={() => setShowControls((current) => !current)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                  showControls ? 'bg-fly-tint-blue text-fly-blue-deep' : 'text-fly-ink hover:bg-[#F4F5F8]'
                }`}
                aria-label="Показать/скрыть панель экспериментов"
                title="Панель экспериментов с контентом"
              >
                <SidePanelIcon />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Рамка телефона и (опционально) панель экспериментов рядом друг с другом */}
      <div className="flex items-start justify-center gap-6 px-5">
        {/* Внешняя обёртка размером точно под текущий масштаб (device × scale) — нужна,
            чтобы после трансформации рамка занимала на странице ровно столько места,
            сколько видно глазами, и не наезжала на соседние элементы и не обрезалась. */}
        <div
          ref={frameWrapperRef}
          style={{ width: device.width * scale, height: device.height * scale }}
          className="relative my-6 flex-shrink-0"
        >
          {/* Рамка телефона рисуется в НАСТОЯЩЕМ размере устройства, а масштабируется
              через CSS transform - так внутренняя вёрстка экрана всегда работает с
              реальными пикселями телефона и не "плывёт" при разных значениях зума.
              willChange подсказывает браузеру заранее подготовить GPU-слой для этого
              элемента - зум трекпадом/кнопками меньше тормозит на слабых машинах. */}
          <div
            style={{
              width: device.width,
              height: device.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              willChange: 'transform',
            }}
            className="absolute top-0 left-0 bg-black rounded-[10%] p-3 shadow-[0_30px_60px_rgba(30,40,70,0.18)]"
          >
            {/* Вырез экрана — форма зависит от данных устройства, см. DeviceCutout выше */}
            <DeviceCutout cutout={device.cutout} />

            {/* Сама область экрана. overflow-hidden только обрезает углы под скруглённую
                рамку - прокрутка списка анкет работает внутри children (FeedScreen),
                а не здесь, поэтому свайпы никогда не "трогают" саму рамку. */}
            <div className="w-full h-full rounded-[8%] overflow-hidden bg-white">
              {children}
            </div>
          </div>
        </div>

        {/* Панель экспериментов сбоку — показывается только если передана снаружи и включена кнопкой выше */}
        {controlsSlot && showControls && <div className="my-6">{controlsSlot}</div>}
      </div>
    </div>
  )
}
