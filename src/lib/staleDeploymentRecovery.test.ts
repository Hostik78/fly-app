import { describe, expect, it } from 'vitest'
import { recoverFromStaleDeployment } from './staleDeploymentRecovery'

describe('восстановление старой вкладки после обновления Fly', () => {
  it('обновляет service worker и перезагружает страницу при исчезнувшем динамическом модуле', async () => {
    const actions: string[] = []
    let savedFailure: string | null = null

    const recovered = await recoverFromStaleDeployment(
      new TypeError(
        'Failed to fetch dynamically imported module: https://fly-app-eight.vercel.app/assets/AccountScreen-old.js',
      ),
      'index-build-one.js',
      {
        readFailures: () => savedFailure ? [savedFailure] : [],
        saveLastFailure: (failure) => {
          savedFailure = failure
          actions.push('remember')
          return true
        },
        updateApplication: async () => {
          actions.push('update')
        },
        reload: () => {
          actions.push('reload')
        },
      },
    )

    expect(recovered).toBe(true)
    expect(savedFailure).toBe(
      'index-build-one.js|https://fly-app-eight.vercel.app/assets/AccountScreen-old.js',
    )
    expect(actions).toEqual(['remember', 'update', 'reload'])
  })

  it('не перезагружает страницу из-за обычной сетевой ошибки', async () => {
    const actions: string[] = []

    const recovered = await recoverFromStaleDeployment(
      new TypeError('Failed to fetch'),
      'index-build-one.js',
      {
        readFailures: () => [],
        saveLastFailure: () => {
          actions.push('remember')
          return true
        },
        updateApplication: async () => {
          actions.push('update')
        },
        reload: () => actions.push('reload'),
      },
    )

    expect(recovered).toBe(false)
    expect(actions).toEqual([])
  })

  it('в Safari снова восстанавливает вкладку после выхода новой версии', async () => {
    let savedFailure: string | null = 'index-build-one.js|Importing a module script failed.'
    let reloads = 0
    const actions = {
      readFailures: () => savedFailure ? [savedFailure] : [],
      saveLastFailure: (failure: string) => {
        savedFailure = failure
        return true
      },
      updateApplication: async () => {},
      reload: () => {
        reloads++
      },
    }

    const recovered = await recoverFromStaleDeployment(
      new TypeError('Importing a module script failed.'),
      'index-build-two.js',
      actions,
    )

    expect(recovered).toBe(true)
    expect(savedFailure).toBe('index-build-two.js|Importing a module script failed.')
    expect(reloads).toBe(1)
  })

  it('не рискует циклической перезагрузкой, если попытку невозможно запомнить', async () => {
    const actions: string[] = []

    const recovered = await recoverFromStaleDeployment(
      new TypeError('Importing a module script failed.'),
      'index-build-one.js',
      {
        readFailures: () => [],
        saveLastFailure: () => false,
        updateApplication: async () => {
          actions.push('update')
        },
        reload: () => actions.push('reload'),
      },
    )

    expect(recovered).toBe(false)
    expect(actions).toEqual([])
  })

  it('учитывает свежую отметку history, даже если в sessionStorage осталась старая', async () => {
    let reloads = 0

    const recovered = await recoverFromStaleDeployment(
      new TypeError('Importing a module script failed.'),
      'index-build-two.js',
      {
        readFailures: () => [
          'index-build-one.js|Importing a module script failed.',
          'index-build-two.js|Importing a module script failed.',
        ],
        saveLastFailure: () => true,
        updateApplication: async () => {},
        reload: () => {
          reloads++
        },
      },
    )

    expect(recovered).toBe(false)
    expect(reloads).toBe(0)
  })
})
