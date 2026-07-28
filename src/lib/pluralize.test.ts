import { describe, expect, it } from 'vitest'
import { getAgeWord } from './pluralize'

describe('getAgeWord', () => {
  it('returns "год" for numbers ending in 1, except 11', () => {
    expect(getAgeWord(1)).toBe('год')
    expect(getAgeWord(21)).toBe('год')
    expect(getAgeWord(31)).toBe('год')
    expect(getAgeWord(11)).not.toBe('год')
  })

  it('returns "года" for numbers ending in 2-4, except 12-14', () => {
    expect(getAgeWord(2)).toBe('года')
    expect(getAgeWord(3)).toBe('года')
    expect(getAgeWord(4)).toBe('года')
    expect(getAgeWord(22)).toBe('года')
    expect(getAgeWord(24)).toBe('года')
  })

  it('returns "лет" for 11-14 and everything else', () => {
    expect(getAgeWord(11)).toBe('лет')
    expect(getAgeWord(12)).toBe('лет')
    expect(getAgeWord(14)).toBe('лет')
    expect(getAgeWord(18)).toBe('лет')
    expect(getAgeWord(25)).toBe('лет')
    expect(getAgeWord(30)).toBe('лет')
    expect(getAgeWord(99)).toBe('лет')
  })
})
