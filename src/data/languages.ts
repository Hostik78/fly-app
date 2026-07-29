// Список кодов языков (двухбуквенные коды ISO 639-1 - международный стандарт).
// Список кодов скопирован из https://github.com/haliaeetus/iso-639/blob/master/data/iso_639-1.json.
// Русские названия к кодам не хранятся здесь - получаются на лету через встроенную
// в браузер функцию Intl.DisplayNames, поэтому не нужно самим переводить и
// поддерживать список названий в актуальном состоянии.

const languageCodes = [
  'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az', 'ba', 'be', 'bg', 'bh',
  'bi', 'bm', 'bn', 'bo', 'br', 'bs', 'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy', 'da',
  'de', 'dv', 'dz', 'ee', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'ff', 'fi', 'fj', 'fo', 'fr',
  'fy', 'ga', 'gd', 'gl', 'gn', 'gu', 'gv', 'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
  'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj',
  'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lg', 'li', 'ln',
  'lo', 'lt', 'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'na', 'nb',
  'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny', 'oc', 'oj', 'om', 'or', 'os', 'pa', 'pi',
  'pl', 'ps', 'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk',
  'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'ti',
  'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo',
  'wa', 'wo', 'xh', 'yi', 'yo', 'za', 'zh', 'zu',
] as const

const languageDisplayNames = new Intl.DisplayNames(['ru'], { type: 'language' })

// Русское название языка по коду (например 'fr' -> 'французский'). Если браузер
// вдруг не знает конкретный код - возвращаем сам код (тогда getLanguageName(code)
// вернёт то же самое, что и передали - на этом признаке и построен фильтр ниже).
export function getLanguageName(code: string): string {
  return languageDisplayNames.of(code) ?? code
}

export interface LanguageOption {
  code: string
  name: string
}

// Список языков с русскими названиями, отсортированный по алфавиту -
// то, что показывается в окне выбора языков.
//
// Проверено на практике: примерно для 50 из 184 кодов ISO 639-1 (редкие языки вроде
// чеченского или чувашского) браузер вообще не знает русского названия и вернул бы
// голый код ("aa", "ab" и т.п.) - для аэропортового приложения это маловероятный
// выбор и выглядело бы как мусор в списке, поэтому такие коды отсеиваются.
// У пары кодов (например 'ak' - акан и 'tw' - тви, близкий диалект) браузер, наоборот,
// даёт одно и то же название на двоих - оставляем только первое вхождение, чтобы в
// списке не было двух одинаковых на вид пунктов.
const seenNames = new Set<string>()
export const languageOptions: LanguageOption[] = languageCodes
  .map((code) => ({ code, name: getLanguageName(code) }))
  .filter((option) => option.name !== option.code)
  .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  .filter((option) => {
    if (seenNames.has(option.name)) return false
    seenNames.add(option.name)
    return true
  })

// Обратное преобразование - из строки, сохранённой в базе ("русский, английский"),
// обратно в коды языков, чтобы можно было заново открыть галочки при редактировании
// анкеты. Работает, потому что строка в базе - это как раз join(', ') от таких же
// названий (см. ProfileSetupScreen.tsx) - разбираем её назад по тому же разделителю.
export function getLanguageCodesFromNames(text: string | null): string[] {
  if (!text) return []
  const names = new Set(text.split(', '))
  return languageOptions.filter((option) => names.has(option.name)).map((option) => option.code)
}
