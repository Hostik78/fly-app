// Цвет по полу - один и тот же язык по всему приложению: полоска в карточке
// ленты (ProfileCard), кружок-аватар в списке совпадений (MessagesScreen) и в
// шапке переписки (ChatScreen). Пол не указан - нейтральный серый, а не
// выдуманный цвет.
export function getGenderColor(gender: 'male' | 'female' | undefined): string {
  if (gender === 'female') return 'var(--color-fly-gender-female)'
  if (gender === 'male') return 'var(--color-fly-gender-male)'
  return 'var(--color-fly-gray)'
}
