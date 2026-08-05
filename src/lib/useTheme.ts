// Хук для переключателя темы в AccountScreen.tsx - сама логика (localStorage +
// data-theme на <html>) живёт в theme.ts и уже применена максимально рано
// (см. main.tsx), этот хук только даёт экрану знать, какая тема выбрана
// СЕЙЧАС, и функцию, чтобы её поменять по нажатию.

import { useState } from 'react'
import { getStoredTheme, setStoredTheme, type ThemePreference } from './theme'

export function useTheme(): { theme: ThemePreference; setTheme: (theme: ThemePreference) => void } {
  const [theme, setThemeState] = useState<ThemePreference>(getStoredTheme)

  function setTheme(next: ThemePreference) {
    setStoredTheme(next)
    setThemeState(next)
  }

  return { theme, setTheme }
}
