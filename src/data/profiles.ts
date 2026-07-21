// Этот файл хранит тестовые (придуманные) анкеты для ленты.
// Позже вместо этого списка анкеты будут приходить с сервера,
// а пока используем несколько примеров, чтобы видеть, как выглядит лента.

// Категория анкеты — по ней работают фильтры-таблетки над лентой.
// 'all' сюда не входит: "Все" — это не категория анкеты, а режим "показать всё".
export type ProfileCategory =
  | 'communication' // Общение
  | 'romance' // Романтика
  | 'hobbies' // Увлечения
  | 'fellow-travelers' // Попутчики
  | 'networking' // Нетворкинг
  | 'friendship' // Дружба

// Описываем форму одной анкеты — какие у неё есть поля и какого они типа.
export interface Profile {
  gender: 'male' | 'female' // пол анкеты — влияет на цвет карточки и букву на значке
  category: ProfileCategory // к какому фильтру относится анкета
  online: boolean // человек сейчас в сети (показываем зелёный значок "Онлайн")
  isNew?: boolean // анкета появилась недавно (значок "New"), поле необязательное
  quote: string // короткая фраза от человека — то, что видно в карточке
  age: number // возраст числом, чтобы можно было выделить его жирным
  ageWord: string // слово после числа: "год" / "года" / "лет" — своё для каждой анкеты
  height: number // рост в сантиметрах
  languages: string // на каких языках говорит человек, через запятую
}

// Список анкет, которые покажем в ленте
export const profiles: Profile[] = [
  {
    gender: 'female',
    category: 'romance',
    online: true,
    isNew: true,
    quote: 'Между рейсами читаю детектив и пью капучино. Составишь компанию?',
    age: 24,
    ageWord: 'года',
    height: 168,
    languages: 'рус, eng',
  },
  {
    gender: 'male',
    category: 'networking',
    online: true,
    quote: 'Лечу в командировку, есть пара часов — можем поработать вместе за кофе.',
    age: 31,
    ageWord: 'год',
    height: 182,
    languages: 'рус, eng, de',
  },
  {
    gender: 'female',
    category: 'communication',
    online: false,
    quote: 'Рейс задержали на три часа. Кто-нибудь тоже скучает у гейта — давайте просто поболтаем?',
    age: 27,
    ageWord: 'лет',
    height: 172,
    languages: 'рус, eng',
  },
  {
    gender: 'male',
    category: 'communication',
    online: true,
    quote: 'Никогда не был в этом городе транзитом дольше двух часов. Расскажите, что тут смотреть?',
    age: 29,
    ageWord: 'лет',
    height: 179,
    languages: 'рус',
  },
  {
    gender: 'female',
    category: 'hobbies',
    online: true,
    isNew: true,
    quote: 'Везу велосипед в багаже на соревнования. Кто ещё катается — шоссе или горы?',
    age: 26,
    ageWord: 'лет',
    height: 165,
    languages: 'рус, eng',
  },
  {
    gender: 'male',
    category: 'hobbies',
    online: false,
    quote: 'Ищу компанию посмотреть новый фильм в аэропортовском кинозале, пока ждём посадку.',
    age: 33,
    ageWord: 'года',
    height: 176,
    languages: 'рус, eng, fr',
  },
  {
    gender: 'female',
    category: 'fellow-travelers',
    online: true,
    quote: 'Тем же рейсом до Стамбула. Может, сядем рядом и обсудим, куда идти в первый день?',
    age: 22,
    ageWord: 'года',
    height: 170,
    languages: 'рус, eng, tur',
  },
  {
    gender: 'male',
    category: 'fellow-travelers',
    online: true,
    quote: 'Возвращаюсь домой тем же рейсом, что и вы, судя по табло. Возьмём такси на двоих?',
    age: 35,
    ageWord: 'лет',
    height: 184,
    languages: 'рус, eng',
  },
  {
    gender: 'female',
    category: 'friendship',
    online: false,
    quote: 'Не ищу романтику, просто приятно иногда встретить своих в чужом аэропорту. Общаемся?',
    age: 30,
    ageWord: 'лет',
    height: 174,
    languages: 'рус, eng, esp',
  },
]
