// Небольшие SVG-иконки для экрана ленты.
// SVG — это картинка, нарисованная линиями и фигурами прямо в коде, а не файл на диске.
// Так проще менять цвет иконки через Tailwind-классы (stroke-.../fill-...).

export function MenuIcon() {
  // Иконка "три горизонтальные линии" — кнопка меню в шапке
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-4 h-4 stroke-fly-blue-deep">
      <path d="M4 6h16M8 12h12M12 18h8" strokeLinecap="round" />
    </svg>
  )
}

export function DotsIcon() {
  // Иконка "три точки" — кнопка дополнительных действий на карточке анкеты
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} className="w-full h-full stroke-fly-gray">
      <circle cx="12" cy="5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
    </svg>
  )
}

export function PersonIcon() {
  // Иконка "человечек" — стоит рядом с возрастом анкеты
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-[13px] h-[13px] stroke-fly-gray">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

export function RulerIcon() {
  // Иконка "стрелки вверх-вниз" — стоит рядом с ростом анкеты
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-[13px] h-[13px] stroke-fly-gray">
      <path d="M12 2v20M8 6l4-4 4 4M8 18l4 4 4-4" />
    </svg>
  )
}

// Иконка "сердце" — кнопка "лайк" на карточке анкеты.
// filled === true (анкета отмечена лайком) — сердце залито белым, как на кнопке кораллового цвета.
// filled === false — сердце нарисовано только контуром кораллового цвета, без заливки.
export function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
        <path d="M12 21s-7-4.35-10-9.28C0.5 8.5 2 4 6.5 4c2.2 0 3.7 1.3 5.5 3.3C13.8 5.3 15.3 4 17.5 4 22 4 23.5 8.5 22 11.72 19 16.65 12 21 12 21z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-5 h-5 stroke-fly-coral">
      <path d="M12 21s-7-4.35-10-9.28C0.5 8.5 2 4 6.5 4c2.2 0 3.7 1.3 5.5 3.3C13.8 5.3 15.3 4 17.5 4 22 4 23.5 8.5 22 11.72 19 16.65 12 21 12 21z" />
    </svg>
  )
}

export function GridIcon() {
  // Иконка "4 квадрата" — вкладка "Лента" в нижней навигации
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-5 h-5 stroke-current">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  )
}

export function MessageIcon() {
  // Иконка "конверт" — вкладка "Сообщения" в нижней навигации
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-5 h-5 stroke-current">
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  )
}

export function AccountIcon() {
  // Иконка "человечек" покрупнее — вкладка "Аккаунт" в нижней навигации
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-5 h-5 stroke-current">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

// Иконка "телефон" — стоит рядом с выбором модели устройства в панели предпросмотра
export function DeviceGlyphIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="w-4 h-4 stroke-fly-gray flex-shrink-0">
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M10.5 18.5h3" strokeLinecap="round" />
    </svg>
  )
}

// Иконка "лупа с минусом" — кнопка уменьшения масштаба в панели предпросмотра
export function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-4 h-4 stroke-current">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M8 10.5h5M20.5 20.5l-4.3-4.3" strokeLinecap="round" />
    </svg>
  )
}

// Иконка "лупа с плюсом" — кнопка увеличения масштаба в панели предпросмотра
export function ZoomInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-4 h-4 stroke-current">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M10.5 8v5M8 10.5h5M20.5 20.5l-4.3-4.3" strokeLinecap="round" />
    </svg>
  )
}

// Иконка "боковая панель" — кнопка показать/скрыть панель экспериментов с контентом
export function SidePanelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-4 h-4 stroke-current">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M15 4v16" />
    </svg>
  )
}
