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

async function renderStartup(shownBefore: boolean, storageBlocked = false) {
  vi.stubGlobal('window', {
    location: { search: '' },
    matchMedia: () => ({ matches: false }),
  })
  vi.stubGlobal('document', { documentElement: { dataset: {} } })
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      if (storageBlocked) throw new Error('Storage disabled')
      return shownBefore ? '1' : null
    },
  })
  const { default: App } = await import('./App')
  return renderToString(<App />)
}

describe('первый кадр запуска', () => {
  it('показывает волны при первом запуске', async () => {
    expect(await renderStartup(false)).toContain('<canvas')
  })

  it('не создаёт волны повторно, даже пока вход ещё проверяется', async () => {
    expect(await renderStartup(true)).not.toContain('<canvas')
  })

  it('не падает, если браузер запретил хранение состояния вкладки', async () => {
    await expect(renderStartup(false, true)).resolves.toContain('<canvas')
  })
})
