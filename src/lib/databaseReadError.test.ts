import { describe, expect, it } from 'vitest'
import { firstDatabaseReadError } from './databaseReadError'

describe('проверка результатов чтения базы', () => {
  it('не считает успешные ответы ошибкой', () => {
    expect(firstDatabaseReadError({ error: null }, { error: null })).toBeNull()
  })

  it('возвращает первую ошибку, чтобы пустые data не выдавались за пустой список', () => {
    const failure = { code: 'PGRST000', message: 'network failed' }

    expect(firstDatabaseReadError({ error: null }, { error: failure })).toBe(failure)
  })
})
