// Русское склонение слова после числа возраста: "год"/"года"/"лет". Раньше это
// было отдельным полем у каждой тестовой анкеты (Profile.ageWord) - теперь
// вычисляется по стандартным правилам, а не хранится (см. profiles.ts).

export function getAgeWord(age: number): string {
  const lastTwo = age % 100
  const lastOne = age % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'лет'
  if (lastOne === 1) return 'год'
  if (lastOne >= 2 && lastOne <= 4) return 'года'
  return 'лет'
}
