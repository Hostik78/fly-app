import { useEffect, useRef, useState } from 'react'
import {
  buildDevicePreviewUrl,
  calculateFitScale,
  DEVICE_PRESETS,
  getDevicePreset,
  type DeviceCutout,
} from '../lib/devicePreview'
import { setStoredTheme, type ThemePreference } from '../lib/theme'
import './DevicePreview.css'

const DEVICE_STORAGE_KEY = 'fly-preview-device'
const BEZEL = 12

type Zoom = 'fit' | 0.75 | 1

function readStoredDeviceId(): string {
  try {
    return localStorage.getItem(DEVICE_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function readAppliedTheme(root: HTMLElement = document.documentElement): ThemePreference {
  const applied = root.dataset.theme
  return applied === 'light' || applied === 'dark' ? applied : 'system'
}

function DeviceCutout({ cutout }: { cutout: DeviceCutout }) {
  if (cutout === 'notch') return <div aria-hidden="true" className="preview-cutout preview-cutout--notch" />
  if (cutout === 'dynamic-island') return <div aria-hidden="true" className="preview-cutout preview-cutout--island" />
  if (cutout === 'punch-hole') return <div aria-hidden="true" className="preview-cutout preview-cutout--punch" />
  return null
}

// Это не «десктопная версия Fly», а локальный стенд проверки мобильного приложения.
// Сам Fly загружается в iframe: у него действительно меняются window.innerWidth,
// window.innerHeight и CSS media queries, как в выбранном смартфоне. Простая рамка-div
// этого не умеет и лишь создаёт похожую картинку, поэтому здесь нужна изоляция документа.
export function DevicePreview() {
  const [deviceId, setDeviceId] = useState(readStoredDeviceId)
  const [theme, setTheme] = useState<ThemePreference>(readAppliedTheme)
  const [zoom, setZoom] = useState<Zoom>('fit')
  const [frameHash, setFrameHash] = useState(window.location.hash)
  const [windowSize, setWindowSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const frameThemeObserverRef = useRef<MutationObserver | null>(null)
  const device = getDevicePreset(deviceId)
  const fitScale = calculateFitScale({ viewportWidth: windowSize.width, viewportHeight: windowSize.height, device })
  const scale = zoom === 'fit' ? fitScale : zoom

  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => () => frameThemeObserverRef.current?.disconnect(), [])

  function chooseDevice(nextId: string) {
    // HashRouter хранит текущий раздел после #. Сохраняем hash внутреннего Fly,
    // чтобы смена iPhone на Android не выкидывала разработчика обратно на входной маршрут.
    const currentFrameHash = iframeRef.current?.contentWindow?.location.hash
    if (currentFrameHash) setFrameHash(currentFrameHash)
    setDeviceId(nextId)
    setZoom('fit')
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, nextId)
    } catch {
      // В приватном режиме сохранение может быть запрещено. Выбор продолжает
      // работать до перезагрузки, поэтому dev-инструмент не должен падать.
    }
  }

  function chooseTheme(nextTheme: ThemePreference) {
    setTheme(nextTheme)
    setStoredTheme(nextTheme)

    // iframe того же локального origin, поэтому тему можно применить без перезапуска
    // приложения и повторной заставки. При следующей загрузке её подхватит localStorage.
    const frameRoot = iframeRef.current?.contentDocument?.documentElement
    if (!frameRoot) return
    if (nextTheme === 'system') delete frameRoot.dataset.theme
    else frameRoot.dataset.theme = nextTheme
  }

  const frameWidth = device.width + BEZEL * 2
  const frameHeight = device.height + BEZEL * 2
  const frameBaseUrl = new URL(window.location.href)
  frameBaseUrl.hash = frameHash
  const frameUrl = buildDevicePreviewUrl(frameBaseUrl.href, device)

  function handleFrameLoad() {
    const frameRoot = iframeRef.current?.contentDocument?.documentElement
    const frameWindow = iframeRef.current?.contentWindow
    if (!frameRoot || !frameWindow) return
    // Браузер сначала создаёт технический about:blank и только потом открывает src.
    // Его пустой hash нельзя принимать за маршрут Fly — иначе #/messages потеряется
    // ещё до настоящей загрузки iframe.
    if (!new URLSearchParams(frameWindow.location.search).has('device-preview')) return

    setTheme(readAppliedTheme(frameRoot))
    setFrameHash(frameWindow.location.hash)
    frameThemeObserverRef.current?.disconnect()
    const observer = new MutationObserver(() => setTheme(readAppliedTheme(frameRoot)))
    observer.observe(frameRoot, { attributes: true, attributeFilter: ['data-theme'] })
    frameThemeObserverRef.current = observer
  }

  return (
    <div className="preview-studio">
      <header className="preview-toolbar">
        <div className="preview-toolbar__controls">
          <label className="preview-visually-hidden" htmlFor="preview-device">Модель телефона</label>
          <select
            id="preview-device"
            aria-label="Модель телефона"
            value={device.id}
            onChange={(event) => chooseDevice(event.target.value)}
            className="preview-select preview-select--device"
          >
            {DEVICE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} · {preset.width}×{preset.height}
              </option>
            ))}
          </select>

          <span aria-hidden="true" className="preview-divider" />

          <label className="preview-visually-hidden" htmlFor="preview-theme">Тема приложения</label>
          <select
            id="preview-theme"
            aria-label="Тема приложения"
            value={theme}
            onChange={(event) => chooseTheme(event.target.value as ThemePreference)}
            className="preview-select preview-select--theme"
          >
            <option value="system">Как в системе</option>
            <option value="light">Светлая</option>
            <option value="dark">Тёмная</option>
          </select>

          <span aria-hidden="true" className="preview-divider" />

          <div className="preview-zoom" aria-label="Масштаб предпросмотра">
            {([['fit', 'Вместить'], [0.75, '75%'], [1, '100%']] as const).map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={zoom === value}
                onClick={() => setZoom(value)}
                className="preview-zoom__button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="preview-workspace">
        <div className="preview-workspace__canvas">
          <div
            className="preview-frame-wrapper"
            style={{ width: frameWidth * scale, height: frameHeight * scale }}
          >
            <div
              data-preview-device={device.id}
              data-preview-width={device.width}
              data-preview-height={device.height}
              className="preview-phone"
              style={{
                width: frameWidth,
                height: frameHeight,
                borderRadius: device.screenRadius + BEZEL,
                transform: `scale(${scale})`,
              }}
            >
              <div className="preview-screen" style={{ borderRadius: device.screenRadius }}>
                <iframe
                  ref={iframeRef}
                  key={device.id}
                  src={frameUrl}
                  title={`Fly на ${device.label}`}
                  className="preview-iframe"
                  onLoad={handleFrameLoad}
                />
                <DeviceCutout cutout={device.cutout} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
