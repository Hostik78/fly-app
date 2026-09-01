import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { LoadErrorState } from './LoadErrorState'

describe('состояние ошибки загрузки', () => {
  it('объясняет проблему без технического текста и даёт повторить запрос', () => {
    const html = renderToString(<LoadErrorState onRetry={vi.fn()} />)

    expect(html).toContain('Не удалось загрузить')
    expect(html).toContain('Проверить снова')
    expect(html).not.toContain('PostgrestError')
  })

  it('поддерживает компактный вид внутри уже открытого экрана', () => {
    const html = renderToString(<LoadErrorState compact onRetry={vi.fn()} />)

    expect(html).toContain('data-compact="true"')
  })
})
