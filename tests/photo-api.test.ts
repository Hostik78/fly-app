import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
const service = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: service.getUser },
    rpc: service.rpc,
    storage: {
      from: () => ({ download: service.download, upload: service.upload, remove: service.remove }),
    },
  }),
}))
import handler from '../api/photo'
const owner = '10000000-0000-4000-8000-000000000001'
const path = `${owner}/30000000-0000-4000-8000-000000000001.jpg`
async function request(
  authorization = 'Bearer test',
  query: Record<string, string> = { owner },
  method = 'GET',
  body?: unknown,
) {
  let status = 200
  let output: unknown
  const headers: Record<string, unknown> = {}
  const response = {
    setHeader: (k: string, v: unknown) => {
      headers[k] = v
    },
    status: (n: number) => {
      status = n
      return response
    },
    json: (v: unknown) => {
      output = v
      return response
    },
    send: (v: unknown) => {
      output = v
      return response
    },
  }
  await handler(
    { method, headers: { authorization }, query, body } as VercelRequest,
    response as unknown as VercelResponse,
  )
  return { status, output, headers }
}
beforeEach(() => {
  vi.resetAllMocks()
  service.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: null })
  service.rpc.mockResolvedValue({ data: path, error: null })
  service.download.mockResolvedValue({
    data: new Blob(['photo'], { type: 'image/jpeg' }),
    error: null,
  })
})
describe('выдача фото', () => {
  it('требует авторизацию', async () => {
    expect((await request('')).status).toBe(401)
    expect(service.download).not.toHaveBeenCalled()
  })
  it('не читает файл без серверного разрешения', async () => {
    service.rpc.mockResolvedValue({ data: null, error: null })
    expect((await request()).status).toBe(404)
    expect(service.download).not.toHaveBeenCalled()
  })
  it('не выдаёт байты при отзыве во время скачивания', async () => {
    service.rpc
      .mockResolvedValueOnce({ data: path, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    expect((await request()).status).toBe(404)
  })
  it('запрещает кешировать фото во всех слоях', async () => {
    const r = await request()
    expect(r.status).toBe(200)
    expect(r.headers['Cache-Control']).toContain('no-store')
    expect(r.headers['Vercel-CDN-Cache-Control']).toBe('no-store')
    expect(r.headers['Content-Type']).toBe('image/jpeg')
    expect(Buffer.isBuffer(r.output)).toBe(true)
  })
  it('не позволяет передать произвольный Storage путь', async () => {
    expect((await request('Bearer test', { owner: '../other' })).status).toBe(400)
  })
  it('закрывается при ошибке базы, без внутренних подробностей', async () => {
    service.rpc.mockResolvedValue({ data: null, error: { message: 'secret diagnostic' } })
    const r = await request()
    expect(r.status).toBe(503)
    expect(JSON.stringify(r.output)).not.toContain('secret')
  })
  it('не принимает произвольный контент вместо JPEG', async () => {
    expect((await request('Bearer test', {}, 'POST', { image: 'aGVsbG8=' })).status).toBe(400)
    expect(service.upload).not.toHaveBeenCalled()
  })
})

it('HEAD проверяет доступ без чтения байтов', async () => {
  let status = 0
  const headers: Record<string, unknown> = {}
  const res = {
    setHeader: (k: string, v: unknown) => {
      headers[k] = v
    },
    status: (n: number) => {
      status = n
      return res
    },
    end: vi.fn(),
  }
  await handler(
    {
      method: 'HEAD',
      headers: { authorization: 'Bearer test' },
      query: { owner },
    } as unknown as VercelRequest,
    res as unknown as VercelResponse,
  )
  expect(status).toBe(200)
  expect(service.download).not.toHaveBeenCalled()
  expect(headers['X-Photo-Version']).toBe(path.split('/').at(-1))
})
it('при загрузке использует владельца сессии и снимает резерв только после публикации', async () => {
  service.rpc.mockImplementation(async (name: string) => ({
    data: name === 'photo_upload_start' ? path : null,
    error: null,
  }))
  service.upload.mockResolvedValue({ error: null })
  const r = await request('Bearer test', {}, 'POST', {
    owner: 'forged',
    image: Buffer.from([255, 216, 255, 217]).toString('base64'),
  })
  expect(r.status).toBe(200)
  expect(service.upload).toHaveBeenCalledWith(
    path,
    expect.any(Buffer),
    expect.objectContaining({ upsert: false }),
  )
  expect(service.rpc).toHaveBeenCalledWith('photo_commit', { path })
  expect(service.rpc).toHaveBeenLastCalledWith('photo_upload_finish', { path })
})
it('не снимает резерв при неизвестном результате Storage-загрузки', async () => {
  service.rpc.mockImplementation(async (name: string) => ({
    data: name === 'photo_upload_start' ? path : null,
    error: null,
  }))
  service.upload.mockRejectedValue(new Error('network gone'))
  expect(
    (
      await request('Bearer test', {}, 'POST', {
        image: Buffer.from([255, 216, 255, 217]).toString('base64'),
      })
    ).status,
  ).toBe(503)
  expect(service.rpc).not.toHaveBeenCalledWith('photo_upload_finish', expect.anything())
})
