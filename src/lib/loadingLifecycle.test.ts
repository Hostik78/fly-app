import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  consumeLoadingSkipAfterAutoUpdate,
  markLoadingSkipAfterAutoUpdate,
} from './loadingLifecycle'

afterEach(() => vi.unstubAllGlobals())

function useMemorySessionStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
}

describe('одноразовый пропуск заставки после автообновления', () => {
  it('пропускает только первый запуск после служебной перезагрузки', () => {
    useMemorySessionStorage()

    markLoadingSkipAfterAutoUpdate()

    expect(consumeLoadingSkipAfterAutoUpdate()).toBe(true)
    expect(consumeLoadingSkipAfterAutoUpdate()).toBe(false)
  })

  it('не ломает запуск, если sessionStorage недоступен', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('Storage disabled') },
      setItem: () => { throw new Error('Storage disabled') },
      removeItem: () => { throw new Error('Storage disabled') },
    })

    expect(() => markLoadingSkipAfterAutoUpdate()).not.toThrow()
    expect(consumeLoadingSkipAfterAutoUpdate()).toBe(false)
  })
})
