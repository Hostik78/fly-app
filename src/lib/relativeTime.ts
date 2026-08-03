// "Был(а) в сети N назад" в шапке чата - переводит точную дату/время в
// человеческую фразу. По духу как getAgeWord в pluralize.ts - своя функция
// вместо библиотеки, потому что нужен только один конкретный случай
// (русское склонение "минута/минуты/минут" и т.п.), а не универсальный
// форматтер дат на все случаи жизни.

function pluralizeUnit(value: number, one: string, few: string, many: string): string {
  const lastTwo = value % 100
  const lastOne = value % 10
  if (lastTwo >= 11 && lastTwo <= 14) return many
  if (lastOne === 1) return one
  if (lastOne >= 2 && lastOne <= 4) return few
  return many
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// "Был"/"Была" по полу анкеты, "Был(а)" - только если пол не указан (честная
// нейтральная форма, а не угадывание).
function wasSeenVerb(gender: 'male' | 'female' | undefined): string {
  if (gender === 'male') return 'Был'
  if (gender === 'female') return 'Была'
  return 'Был(а)'
}

export function formatLastSeen(lastSeenAt: string, gender: 'male' | 'female' | undefined): string {
  const verb = wasSeenVerb(gender)
  const diffMs = Date.now() - new Date(lastSeenAt).getTime()

  if (diffMs < MINUTE_MS) return `${verb} в сети только что`

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS)
    return `${verb} в сети ${minutes} ${pluralizeUnit(minutes, 'минуту', 'минуты', 'минут')} назад`
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS)
    return `${verb} в сети ${hours} ${pluralizeUnit(hours, 'час', 'часа', 'часов')} назад`
  }

  const days = Math.floor(diffMs / DAY_MS)
  if (days === 1) return `${verb} в сети вчера`
  return `${verb} в сети ${days} ${pluralizeUnit(days, 'день', 'дня', 'дней')} назад`
}
