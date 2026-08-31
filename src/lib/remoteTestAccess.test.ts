import { describe, expect, it } from 'vitest'
import { hasActiveRemoteTestAccess } from './remoteTestAccess'

describe('закрытый доступ для удалённой проверки', () => {
  const now = Date.parse('2026-09-01T00:00:00Z')

  it('разрешает проверку до служебной даты окончания', () => {
    expect(hasActiveRemoteTestAccess({ fly_remote_test_until: '2026-09-15T00:00:00.000Z' }, now)).toBe(true)
  })

  it('не принимает истёкшую или поддельную дату', () => {
    expect(hasActiveRemoteTestAccess({ fly_remote_test_until: '2026-08-31T23:59:59.000Z' }, now)).toBe(false)
    expect(hasActiveRemoteTestAccess({ fly_remote_test_until: true }, now)).toBe(false)
    expect(hasActiveRemoteTestAccess({}, now)).toBe(false)
    expect(hasActiveRemoteTestAccess({ fly_remote_test_until: '2026-02-31T00:00:00.000Z' }, now)).toBe(false)
  })
})
