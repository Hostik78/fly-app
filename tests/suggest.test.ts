import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Проверяем реальный серверный обработчик. Внешние запросы заменены,
// чтобы тесты не отправляли данные людей и не расходовали платный API.
const external = vi.hoisted(() => ({ getUser: vi.fn(), create: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: external.getUser } }) }))
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create: external.create } } }))
import handler from '../api/suggest'

const valid = { category: 'communication', context: { weather: 'ясно', temperature: 18, timeOfDay: 'день' } }
async function request(body: unknown) {
  let status = 200
  let result: unknown
  const response = {
    setHeader: vi.fn(),
    status: (code: number) => { status = code; return response },
    json: (value: unknown) => { result = value; return response },
  }
  await handler({ method: 'POST', headers: { authorization: 'Bearer test-token' }, body } as VercelRequest, response as unknown as VercelResponse)
  return { status, result }
}

describe('проверка входных данных подсказок', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    external.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
    external.create.mockResolvedValue({ content: [{ type: 'text', text: '["Ищу компанию на кофе"]' }] })
  })

  it.each([
    null, {}, [],
    { ...valid, category: 42 },
    { ...valid, category: 'unknown' },
    { ...valid, context: 'text' },
    { ...valid, context: { ...valid.context, weather: 'x'.repeat(10000) } },
    { ...valid, context: { ...valid.context, timeOfDay: 'x'.repeat(10000) } },
    { ...valid, context: { ...valid.context, temperature: '18' } },
    { ...valid, context: { ...valid.context, temperature: 1e100 } },
  ])('отклоняет некорректное тело до платного запроса (случай %#)', async (body) => {
    expect((await request(body)).status).toBe(400)
    expect(external.create).not.toHaveBeenCalled()
  })

  it('сохраняет работу обычного запроса', async () => {
    expect(await request(valid)).toEqual({ status: 200, result: { suggestions: ['Ищу компанию на кофе'] } })
  })

  it('работает без сведений о погоде', async () => {
    expect((await request({ ...valid, context: { weather: null, temperature: null, timeOfDay: 'ночь' } })).status).toBe(200)
    expect(external.create).toHaveBeenCalledOnce()
  })
})
