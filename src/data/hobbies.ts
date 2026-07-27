// Список конкретных хобби для категории анкеты "Увлечения". Живёт отдельно от
// profiles.ts, потому что это данные про сами хобби, а не про анкету -
// используется и в ленте (второй ряд фильтров), и на экране создания заметки,
// и в подсказках для начала разговора.

export type HobbyId =
  | 'cycling'
  | 'photography'
  | 'movies'
  | 'books'
  | 'music'
  | 'sports'
  | 'cooking'
  | 'travel'

export interface HobbyOption {
  id: HobbyId
  label: string
}

export const hobbies: HobbyOption[] = [
  { id: 'cycling', label: 'Велосипед' },
  { id: 'photography', label: 'Фотография' },
  { id: 'movies', label: 'Кино' },
  { id: 'books', label: 'Книги' },
  { id: 'music', label: 'Музыка' },
  { id: 'sports', label: 'Спорт' },
  { id: 'cooking', label: 'Кулинария' },
  { id: 'travel', label: 'Путешествия' },
]
