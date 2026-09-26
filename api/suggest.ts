// Серверная функция Vercel (Node.js): по категории и текущему контексту
// (погода + время суток) просит Anthropic API сочинить 2-3 живые, не банальные
// фразы для заметки "Что вы ищете сейчас?". Ключ Anthropic живёт только тут,
// в переменных окружения — никогда не попадает в код браузера.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic()
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

interface SuggestRequestBody {
  category: string
  context: {
    weather: string | null
    temperature: number | null
    timeOfDay: string
  }
}

// Проверка TypeScript не действует на данные из интернета. Допускаем только
// значения, которые действительно отправляет приложение, а не произвольный
// текст для платной модели. Ограничения частоты запросов нужны отдельно.
function isSuggestRequest(value: unknown): value is SuggestRequestBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const body = value as Record<string, unknown>
  const allowedCategories = ['communication', 'romance', 'hobbies', 'fellow-travelers', 'networking', 'friendship']
  if (typeof body.category !== 'string' || !allowedCategories.includes(body.category)) return false
  if (!body.context || typeof body.context !== 'object' || Array.isArray(body.context)) return false
  const context = body.context as Record<string, unknown>
  const weather = ['ясно', 'облачно', 'туман', 'дождь', 'снег', 'ливень', 'гроза']
  return (context.weather === null || (typeof context.weather === 'string' && weather.includes(context.weather)))
    && (context.temperature === null || (typeof context.temperature === 'number'
      && Number.isFinite(context.temperature) && context.temperature >= -100 && context.temperature <= 60))
    && typeof context.timeOfDay === 'string'
    && ['утро', 'день', 'вечер', 'ночь'].includes(context.timeOfDay)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ suggestions: [] })
    return
  }

  // Без этой проверки функцию мог дёргать кто угодно из интернета напрямую
  // (не только сама браузерная кнопка "Нужна идея?" внутри приложения) - это
  // прямой канал тратить деньги с привязанного платного Anthropic-аккаунта.
  // Тот же приём, что и в api/delete-account.ts - токен подтверждает, что
  // запрос пришёл от реально вошедшего пользователя.
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    res.status(401).json({ suggestions: [] })
    return
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ suggestions: [] })
    return
  }

  if (!isSuggestRequest(req.body)) {
    res.status(400).json({ suggestions: [] })
    return
  }
  const { category, context } = req.body

  const weatherText = context.weather
    ? `сейчас ${context.weather}${context.temperature != null ? `, ${context.temperature}°C` : ''}`
    : 'погода неизвестна'

  try {
    const response = await client.messages.create(
      {
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content:
              `Ты помогаешь человеку в аэропорту написать короткую живую заметку о том, ` +
              `чем он сейчас занят, для категории "${category}". ` +
              `Время суток: ${context.timeOfDay}. Погода: ${weatherText}.\n\n` +
              `Придумай 2-3 коротких (до 12 слов) не банальных фразы от первого лица. ` +
              `Избегай штампов вроде "ищу свою настоящую любовь" или "занимаюсь своей жизнью". ` +
              `Верни ТОЛЬКО JSON-массив строк, без пояснений и без markdown-разметки.`,
          },
        ],
      },
      { timeout: 4000 },
    )

    const textBlock = response.content.find((block) => block.type === 'text')
    const parsed: unknown = JSON.parse(textBlock?.text ?? '[]')
    const suggestions = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []

    res.status(200).json({ suggestions })
  } catch {
    // Таймаут, сетевая ошибка или не тот формат ответа — просто пустой список,
    // без ошибки на экране (см. design-спеку: это бонус, а не обязательная часть)
    res.status(200).json({ suggestions: [] })
  }
}
