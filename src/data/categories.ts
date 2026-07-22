import type { ProfileCategory } from './profiles'

// Общий список категорий - подписи для человека к каждому значению ProfileCategory.
// Живёт в одном месте, чтобы фильтры в ленте и выбор категории при создании статуса
// всегда показывали одинаковый список, без дублирования текста в нескольких файлах.
export interface CategoryOption {
  id: ProfileCategory
  label: string
}

export const categories: CategoryOption[] = [
  { id: 'communication', label: 'Общение' },
  { id: 'romance', label: 'Романтика' },
  { id: 'hobbies', label: 'Увлечения' },
  { id: 'fellow-travelers', label: 'Попутчики' },
  { id: 'networking', label: 'Нетворкинг' },
  { id: 'friendship', label: 'Дружба' },
]
