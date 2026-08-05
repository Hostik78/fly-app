// Тема оформления - три положения, как в iOS: "Как в телефоне" (следует за
// системной настройкой браузера/ОС через prefers-color-scheme в index.css,
// без единой строчки JS для самого переключения), "Светлая", "Тёмная" -
// последние два явно перебивают системную настройку (см. подробный
// комментарий в index.css про то, почему атрибутный селектор побеждает
// media-блок сам по себе, через специфичность CSS, а не порядок строк).
//
// Не React-хук специально - applyTheme() нужно вызвать МАКСИМАЛЬНО рано, ещё
// до того, как React вообще начнёт рендерить приложение (см. main.tsx) - это
// тот же приём, что и с предзагрузкой видео заставки (main.tsx), только
// здесь ради другого: без этого при выбранной вручную теме на долю секунды
// мелькнул бы неправильный вариант (системный), пока React не размонтировался
// и не применил бы нужный - "вспышка неправильной темы", известная проблема
// любого переключения темы на сайтах.

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'fly-theme'

export function getStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

// Ставит (или убирает) data-theme на <html> - CSS в index.css сам решает,
// что показать, эта функция ничего не знает про конкретные цвета.
export function applyTheme(theme: ThemePreference): void {
  if (theme === 'system') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }
}

export function setStoredTheme(theme: ThemePreference): void {
  if (theme === 'system') {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, theme)
  }
  applyTheme(theme)
}
