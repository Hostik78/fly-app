// Шаблоны фраз-подсказок для заметки "Что вы ищете сейчас?", по одной паре
// вариантов (с погодой / без погоды) на категорию. Чистые данные и чистая
// функция подстановки — без побочных эффектов, поэтому легко покрыть тестом.

import type { ProfileCategory } from './profiles'
import type { LiveContext } from '../lib/liveContext'

interface Template {
  withWeather: (weather: string, timeOfDay: string) => string
  withoutWeather: (timeOfDay: string) => string
}

const templates: Record<ProfileCategory, Template[]> = {
  communication: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather} — самое время поболтать, пока жду рейс`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, жду рейс и не прочь поболтать`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, погода — ${weather}, а мне интересно, с кем тут можно поговорить`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, интересно, с кем тут можно поговорить`,
    },
  ],
  romance: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather} — если тоже ждёте рейс и не против знакомства, пишите`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, жду рейс и не против нового знакомства`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, а из-за погоды (${weather}) время тянется медленно — было бы веселее вдвоём`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, время тянется медленно — было бы веселее вдвоём`,
    },
  ],
  hobbies: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, за окном ${weather} — расскажу про свои увлечения, если интересно`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, с радостью расскажу про свои увлечения`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather}, а у меня есть час — обсудим общие интересы?`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, есть час свободного времени — обсудим общие интересы?`,
    },
  ],
  'fellow-travelers': [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather} — если летим в одну сторону, можно скоротать время вместе`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, если летим в одну сторону — можно скоротать время вместе`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, погода — ${weather}, рейс ещё не скоро — ищу попутчика, чтобы не скучать`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, рейс ещё не скоро — ищу попутчика, чтобы не скучать`,
    },
  ],
  networking: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, на улице ${weather} — жду рейс и не против обсудить рабочие темы`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, жду рейс и не против обсудить рабочие темы`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, погода — ${weather}, есть время до посадки — расскажу, чем занимаюсь, если интересно`,
      withoutWeather: (timeOfDay) =>
        `Сейчас ${timeOfDay}, есть время до посадки — расскажу, чем занимаюсь, если интересно`,
    },
  ],
  friendship: [
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, за окном ${weather} — просто хочется с кем-то пообщаться по-дружески`,
      withoutWeather: (timeOfDay) => `Сейчас ${timeOfDay}, просто хочется с кем-то пообщаться по-дружески`,
    },
    {
      withWeather: (weather, timeOfDay) =>
        `Сейчас ${timeOfDay}, погода — ${weather}, жду рейс в одиночестве — рядом не помешает дружеская компания`,
      withoutWeather: (timeOfDay) =>
        `Сейчас ${timeOfDay}, жду рейс в одиночестве — рядом не помешает дружеская компания`,
    },
  ],
}

export function getSuggestions(category: ProfileCategory, context: LiveContext): string[] {
  return templates[category].map((template) =>
    context.weather
      ? template.withWeather(context.weather, context.timeOfDay)
      : template.withoutWeather(context.timeOfDay),
  )
}
