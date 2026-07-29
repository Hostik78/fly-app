import { describe, expect, it } from 'vitest'
import { getLanguageCodesFromNames, getLanguageName, languageOptions } from './languages'

describe('getLanguageCodesFromNames', () => {
  it('returns an empty list for null or empty text', () => {
    expect(getLanguageCodesFromNames(null)).toEqual([])
    expect(getLanguageCodesFromNames('')).toEqual([])
  })

  it('is the reverse of joining names with ", " (round-trips through the real join format)', () => {
    const codes = ['ru', 'en', 'fr']
    const text = codes.map(getLanguageName).join(', ')
    expect(getLanguageCodesFromNames(text)).toEqual(expect.arrayContaining(codes))
    expect(getLanguageCodesFromNames(text)).toHaveLength(codes.length)
  })

  it('ignores names it does not recognise', () => {
    expect(getLanguageCodesFromNames('не язык вообще')).toEqual([])
  })
})

describe('languageOptions', () => {
  it('has no duplicate names or codes', () => {
    const names = languageOptions.map((option) => option.name)
    const codes = languageOptions.map((option) => option.code)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
