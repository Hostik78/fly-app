import { describe, expect, it } from 'vitest'
import { isLikelyEmail } from './email'

describe('проверка адреса почты', () => {
  it('принимает обычный адрес с доменом', () => {
    expect(isLikelyEmail(' person@example.com ')).toBe(true)
  })

  it('отклоняет пустой адрес и строки без домена', () => {
    expect(isLikelyEmail('')).toBe(false)
    expect(isLikelyEmail('not-an-email')).toBe(false)
    expect(isLikelyEmail('person@')).toBe(false)
  })
})
