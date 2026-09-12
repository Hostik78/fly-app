// Набор устройств нужен только локальному инструменту предпросмотра. Само приложение
// не содержит веток «если iPhone / если Samsung»: на настоящем телефоне оно по-прежнему
// адаптируется стандартной вёрсткой и env(safe-area-inset-*). Здесь модели — лишь удобные
// эталоны, на которых разработчик заранее видит узкий, высокий и широкий экран.
export type DeviceCutout = 'none' | 'notch' | 'dynamic-island' | 'punch-hole'

export interface DevicePreset {
  id: string
  label: string
  platform: 'iOS' | 'Android'
  width: number
  height: number
  cutout: DeviceCutout
  safeArea: {
    top: number
    right: number
    bottom: number
    left: number
  }
  screenRadius: number
}

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  {
    id: 'iphone-se',
    label: 'iPhone SE',
    platform: 'iOS',
    width: 375,
    height: 667,
    cutout: 'none',
    safeArea: { top: 20, right: 0, bottom: 0, left: 0 },
    screenRadius: 18,
  },
  {
    id: 'iphone-13-mini',
    label: 'iPhone 13 mini',
    platform: 'iOS',
    width: 375,
    height: 812,
    cutout: 'notch',
    safeArea: { top: 50, right: 0, bottom: 34, left: 0 },
    screenRadius: 42,
  },
  {
    id: 'iphone-15-pro',
    label: 'iPhone 15 Pro',
    platform: 'iOS',
    width: 393,
    height: 852,
    cutout: 'dynamic-island',
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
    screenRadius: 45,
  },
  {
    id: 'iphone-15-pro-max',
    label: 'iPhone 15 Pro Max',
    platform: 'iOS',
    width: 430,
    height: 932,
    cutout: 'dynamic-island',
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
    screenRadius: 48,
  },
  {
    id: 'galaxy-s23',
    label: 'Samsung Galaxy S23',
    platform: 'Android',
    width: 360,
    height: 780,
    cutout: 'punch-hole',
    safeArea: { top: 28, right: 0, bottom: 24, left: 0 },
    screenRadius: 38,
  },
  {
    id: 'pixel-8',
    label: 'Google Pixel 8',
    platform: 'Android',
    width: 412,
    height: 915,
    cutout: 'punch-hole',
    safeArea: { top: 28, right: 0, bottom: 24, left: 0 },
    screenRadius: 42,
  },
] as const

export const DEFAULT_DEVICE_ID = 'iphone-15-pro'

export type DevicePreviewMode =
  | { type: 'off' }
  | { type: 'host' }
  | { type: 'frame'; deviceId: string }

interface DevicePreviewEnvironment {
  isDev: boolean
  search: string
  hasFinePointer: boolean
}

// Внешняя «студия» нужна только компьютеру. На реальном сенсорном телефоне даже
// локальный dev-сервер обязан открыть Fly напрямую, иначе получился бы телефон в телефоне.
// Параметр device-preview означает, что документ уже загружен ВНУТРИ iframe выбранной
// модели; повторно оборачивать его нельзя.
export function getDevicePreviewMode({ isDev, search, hasFinePointer }: DevicePreviewEnvironment): DevicePreviewMode {
  if (!isDev) return { type: 'off' }
  const embeddedDeviceId = new URLSearchParams(search).get('device-preview')
  if (embeddedDeviceId) return { type: 'frame', deviceId: getDevicePreset(embeddedDeviceId).id }
  return hasFinePointer ? { type: 'host' } : { type: 'off' }
}

export function buildDevicePreviewUrl(currentHref: string, device: DevicePreset): string {
  const url = new URL(currentHref)
  url.searchParams.set('device-preview', device.id)
  url.searchParams.set('preview-safe-top', String(device.safeArea.top))
  url.searchParams.set('preview-safe-right', String(device.safeArea.right))
  url.searchParams.set('preview-safe-bottom', String(device.safeArea.bottom))
  url.searchParams.set('preview-safe-left', String(device.safeArea.left))
  return `${url.pathname}${url.search}${url.hash}`
}

export function getDevicePreset(id: string | null | undefined): DevicePreset {
  return DEVICE_PRESETS.find((device) => device.id === id)
    ?? DEVICE_PRESETS.find((device) => device.id === DEFAULT_DEVICE_ID)!
}

interface FitScaleInput {
  viewportWidth: number
  viewportHeight: number
  device: DevicePreset
}

const TOOLBAR_HEIGHT = 72
const WORKSPACE_PADDING = 16
const BEZEL = 12

// «Вместить в окно» считается от реального места вокруг телефона. Масштаб никогда
// не становится больше 100%: иначе крупный монитор искусственно растянул бы CSS-пиксели
// и создавал ложное впечатление о размере текста и кнопок на настоящем устройстве.
export function calculateFitScale({ viewportWidth, viewportHeight, device }: FitScaleInput): number {
  const availableWidth = Math.max(1, viewportWidth - WORKSPACE_PADDING * 2)
  const availableHeight = Math.max(1, viewportHeight - TOOLBAR_HEIGHT - WORKSPACE_PADDING * 2)
  const framedWidth = device.width + BEZEL * 2
  const framedHeight = device.height + BEZEL * 2

  return Math.min(1, availableWidth / framedWidth, availableHeight / framedHeight)
}
