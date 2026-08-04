import { describe, expect, it } from 'vitest'
import { getAvatarUrl } from './avatar'

describe('getAvatarUrl', () => {
  // Баг, который тут реально был: 0 - "ложное" значение в JS, и первая версия
  // кода (`cacheBustKey ? ... : ...`) из-за этого пропускала "?v=" именно на
  // нулевой версии - то есть каждый первый рендер после перезагрузки страницы
  // (avatarVersion стартует с 0) не сбрасывал кеш браузера, как будто версии
  // не передавали вообще. См. LESSONS.md.
  it('adds ?v= even when the version is 0', () => {
    expect(getAvatarUrl('user-1', 0)).toMatch(/\?v=0$/)
  })

  it('adds ?v= for a real version number', () => {
    expect(getAvatarUrl('user-1', 3)).toMatch(/\?v=3$/)
  })

  it('omits ?v= only when no version is passed at all', () => {
    expect(getAvatarUrl('user-1')).not.toContain('?v=')
  })
})
