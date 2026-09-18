import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

// Проверяем реальные маршруты и нижнее меню без входа в production.
// Только сеть и содержимое сложных экранов заменены для изоляции переходов.
vi.mock('./lib/supabase', () => ({ supabase: {} }))
vi.mock('./lib/useOnlinePresence', () => ({ useOnlinePresence: () => ({ onlineIds: new Set(), statusKnown: true }) }))
vi.mock('./lib/useAirportPresence', () => ({ useAirportPresence: () => ({ status: 'not-at-airport', distanceKm: 615, retry: () => {} }) }))
vi.mock('./components/MessagesScreen', () => ({ MessagesScreen: () => <h1>Мои сообщения</h1> }))
vi.mock('./components/AccountScreen', () => ({ AccountScreen: () => <h1>Мой аккаунт</h1> }))

async function renderRoute(route: string, hasPosted = false) {
  vi.stubGlobal('window', { location: { search: '' }, matchMedia: () => ({ matches: false }) })
  const { ApplicationRoutes } = await import('./App')
  return renderToString(<MemoryRouter initialEntries={[route]}>
    <ApplicationRoutes currentUserId="test-user" hasPosted={hasPosted} onPublish={async () => {}} />
  </MemoryRouter>)
}

describe('навигация нового пользователя вне аэропорта', () => {
  it('сохраняет три ссылки на экране географического ограничения до первой заметки', async () => {
    const html = await renderRoute('/new')
    expect(html).toContain('615')
    expect(html).toContain('Основная навигация')
    expect(html).toContain('href="/messages"')
    expect(html).toContain('href="/account"')
    expect(html).toContain('href="/new"')
  })
  it('разрешает сообщения до первой заметки вне аэропорта', async () => {
    const html = await renderRoute('/messages')
    expect(html).toContain('Мои сообщения')
    expect(html).not.toContain('615')
  })
  it('сохраняет географическое ограничение ленты после публикации', async () => {
    const html = await renderRoute('/', true)
    expect(html).toContain('615')
    expect(html).toContain('href="/account"')
  })
})
