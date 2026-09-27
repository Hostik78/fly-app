import { beforeEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { auth } }))
import { fetchAvatar } from './avatar'
beforeEach(() => {
  vi.restoreAllMocks()
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } })
})
describe('защищённая загрузка фото', () => {
  it('не запрашивает фото без сессии', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    const fetch = vi.spyOn(globalThis, 'fetch')
    expect(await fetchAvatar('owner')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('передаёт токен заголовком и запрещает кеш', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new Blob(['photo']), { status: 200 }))
    expect(await fetchAvatar('owner')).toBeInstanceOf(Blob)
    expect(fetch).toHaveBeenCalledWith(
      '/api/photo?owner=owner',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Authorization: 'Bearer session-token' },
      }),
    )
  })
  it('не возвращается к публичному пути при отказе', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 404 }))
    expect(await fetchAvatar('owner')).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
