import { describe, expect, it } from 'vitest'
import { isExistingProfileConflict } from './profilePersistence'

describe('повторное сохранение анкеты', () => {
  it('считает конфликт уникального user_id уже выполненным сохранением', () => {
    expect(isExistingProfileConflict({ code: '23505' })).toBe(true)
  })

  it('не скрывает сетевые и остальные ошибки', () => {
    expect(isExistingProfileConflict({ code: 'PGRST301' })).toBe(false)
    expect(isExistingProfileConflict(null)).toBe(false)
  })
})
