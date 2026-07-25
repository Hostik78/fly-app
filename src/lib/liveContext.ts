// Достаёт "живой" контекст для подсказок статуса: погоду и время суток.
// Ничего не знает про интерфейс или категории — просто отдаёт наружу простой объект.
// Погоду запрашивает у Open-Meteo (бесплатный сервис, без API-ключа и регистрации).

export type TimeOfDay = 'утро' | 'день' | 'вечер' | 'ночь'

export interface LiveContext {
  timeOfDay: TimeOfDay
  // null, если погоду не удалось получить (нет интернета, сервис не ответил) —
  // в этом случае шаблоны используют вариант без погоды
  weather: string | null
  temperature: number | null
}

// Координаты аэропорта Шереметьево (SVO) — захардкожены, так как приложение
// пока не определяет геолокацию человека (см. design-спеку фичи)
const SVO_LATITUDE = 55.9736
const SVO_LONGITUDE = 37.4125

// Кэш на время сессии — чтобы не запрашивать погоду заново при каждом открытии панели
let cachedContext: LiveContext | null = null

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours()
  if (hour >= 6 && hour < 12) return 'утро'
  if (hour >= 12 && hour < 18) return 'день'
  if (hour >= 18 && hour < 23) return 'вечер'
  return 'ночь'
}

// Переводит код погоды Open-Meteo в короткое русское слово.
// Коды описаны в документации Open-Meteo (WMO weather codes)
function describeWeatherCode(code: number): string {
  if (code === 0) return 'ясно'
  if (code <= 3) return 'облачно'
  if (code === 45 || code === 48) return 'туман'
  if (code >= 51 && code <= 67) return 'дождь'
  if (code >= 71 && code <= 77) return 'снег'
  if (code >= 80 && code <= 82) return 'ливень'
  if (code >= 95) return 'гроза'
  return 'облачно'
}

export async function getLiveContext(): Promise<LiveContext> {
  if (cachedContext) return cachedContext

  const timeOfDay = getTimeOfDay()

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${SVO_LATITUDE}` +
      `&longitude=${SVO_LONGITUDE}&current=temperature_2m,weather_code`
    const response = await fetch(url)
    if (!response.ok) throw new Error('weather request failed')
    const data = await response.json()
    cachedContext = {
      timeOfDay,
      weather: describeWeatherCode(data.current.weather_code),
      temperature: Math.round(data.current.temperature_2m),
    }
  } catch {
    // Нет интернета или сервис не ответил — работаем без погоды
    cachedContext = { timeOfDay, weather: null, temperature: null }
  }

  return cachedContext
}
