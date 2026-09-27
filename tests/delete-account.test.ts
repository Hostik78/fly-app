import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Подменяем только внешнюю службу: проверяем настоящий обработчик без
// удаления реальных аккаунтов и без использования секретов проекта.
const service = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  deleteUser: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: service.getUser, admin: { deleteUser: service.deleteUser } },
    rpc: service.rpc,
    storage: { from: () => ({ remove: service.remove, list: service.list }) },
  }),
}))
import handler from '../api/delete-account'

async function request(method = 'POST', authorization: string | undefined = 'Bearer test-token') {
  let status = 200
  let body: unknown
  const headers: Record<string, unknown> = {}
  const response = {
    setHeader: (key: string, value: unknown) => { headers[key] = value },
    status: (value: number) => { status = value; return response },
    json: (value: unknown) => { body = value; return response },
  }
  // Чужой id в теле не должен влиять на выбор удаляемого аккаунта.
  await handler({ method, headers: { authorization }, body: { userId: 'other-user' } } as VercelRequest, response as unknown as VercelResponse)
  return { status, body, headers }
}

describe('удаление аккаунта', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    service.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
    service.rpc.mockResolvedValue({data:null,error:null})
    service.list.mockResolvedValue({data:[],error:null}).mockResolvedValueOnce({data:[{name:'avatar.jpg',id:'file'}],error:null})
    service.remove.mockResolvedValue({ data: [], error: null })
    service.deleteUser.mockResolvedValue({ data: {}, error: null })
  })

  it('не удаляет аккаунт и не сообщает успех при ошибке очистки фотографии', async () => {
    service.remove.mockResolvedValue({ data: null, error: { message: 'storage unavailable' } })
    expect((await request()).status).toBe(503)
    expect(service.deleteUser).not.toHaveBeenCalled()
  })

  it('удаляет только владельца проверенного токена после очистки фото', async () => {
    const result = await request()
    expect(result.status).toBe(200)
    expect(service.getUser).toHaveBeenCalledWith('test-token')
    expect(service.remove).toHaveBeenCalledWith(['owner/avatar.jpg'])
    expect(service.deleteUser).toHaveBeenCalledWith('owner')
    expect(service.remove.mock.invocationCallOrder[0]).toBeLessThan(service.deleteUser.mock.invocationCallOrder[0])
  })

  it('не удаляет аккаунт, если не удалось закрыть доступ к фото', async () => {
    service.rpc.mockResolvedValue({error:{message:'failed'}})
    expect((await request()).status).toBe(503)
    expect(service.deleteUser).not.toHaveBeenCalled()
  })

  it('не разрешает удаление без токена', async () => {
    expect((await request('POST', '')).status).toBe(401)
    expect(service.remove).not.toHaveBeenCalled()
    expect(service.deleteUser).not.toHaveBeenCalled()
  })

  it('не разрешает удаление по недействительному токену', async () => {
    service.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
    expect((await request()).status).toBe(401)
    expect(service.deleteUser).not.toHaveBeenCalled()
  })

  it('не выполняет удаление по GET', async () => {
    expect((await request('GET')).status).toBe(405)
    expect(service.getUser).not.toHaveBeenCalled()
  })

  it('не сообщает успех, если удаление аккаунта не удалось', async () => {
    service.deleteUser.mockResolvedValue({ error: { message: 'database unavailable' } })
    expect((await request()).status).toBe(500)
  })

  it('обрабатывает сетевой сбой без выдачи внутренних подробностей', async () => {
    service.remove.mockRejectedValue(new Error('private diagnostic information'))
    const result = await request()
    expect(result.status).toBe(503)
    expect(JSON.stringify(result.body)).not.toContain('private diagnostic')
    expect(service.deleteUser).not.toHaveBeenCalled()
  })

  it('запрещает кешировать результат чувствительного запроса', async () => {
    expect((await request()).headers['Cache-Control']).toBe('no-store')
  })
})
