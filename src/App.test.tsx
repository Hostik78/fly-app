import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'

// Изолируем только вход и внешний сервис: проверяем настоящий App и настоящий
// экран волн, не обращаясь к аккаунтам пользователей во время теста.
vi.mock('./lib/supabase', () => ({ supabase: {} }))
vi.mock('./lib/useSession', () => ({
  useSession: () => ({ session: null, loading: true }),
}))
vi.mock('./components/DevicePreview', () => ({
  DevicePreview: ({ children }: { children: ReactNode }) => children,
}))

afterEach(() => vi.unstubAllGlobals())

async function renderStartup(
  { legacyShown = false, skipAfterAutoUpdate = false, storageBlocked = false } = {},
) {
  const storedValues = new Map<string, string>()
  if (legacyShown) storedValues.set('fly-loading-screen-shown', '1')
  if (skipAfterAutoUpdate) storedValues.set('fly-skip-loading-after-auto-update', '1')
  vi.stubGlobal('window', {
    location: { search: '' },
    matchMedia: () => ({ matches: false }),
  })
  vi.stubGlobal('document', { documentElement: { dataset: {} } })
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => {
      if (storageBlocked) throw new Error('Storage disabled')
      return storedValues.get(key) ?? null
    },
    removeItem: (key: string) => storedValues.delete(key),
  })
  const { default: App } = await import('./App')
  return renderToString(<App />)
}

describe('первый кадр запуска', () => {
  it('показывает волны при первом запуске', async () => {
    expect(await renderStartup()).toContain('<canvas')
  })

  it('снова показывает волны после настоящей перезагрузки страницы', async () => {
    // sessionStorage переживает Command+R. Старая реализация принимала эту
    // отметку за «приложение всё ещё открыто» и поэтому пропускала заставку.
    // Но сам факт нового монтирования App уже означает новый запуск документа:
    // быстрый возврат из Telegram вообще не размонтирует React и сюда не попадёт.
    expect(await renderStartup({ legacyShown: true })).toContain('<canvas')
  })

  it('не показывает волны после скрытого автообновления приложения', async () => {
    expect(await renderStartup({ skipAfterAutoUpdate: true })).not.toContain('<canvas')
  })

  it('не падает, если браузер запретил хранение состояния вкладки', async () => {
    await expect(renderStartup({ storageBlocked: true })).resolves.toContain('<canvas')
  })
})
