// Небольшие SVG-иконки для экрана ленты.
// SVG — это картинка, нарисованная линиями и фигурами прямо в коде, а не файл на диске.
// Так проще менять цвет иконки через Tailwind-классы (stroke-.../fill-...).

export function MenuIcon() {
  // Иконка "три горизонтальные линии" — кнопка меню в шапке
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-4 h-4 stroke-fly-ink">
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

// Иконка "сердце" — кнопка "лайк" на карточке анкеты.
// filled === true (анкета отмечена лайком) — сердце залито белым, как на кнопке акцентного цвета.
// filled === false — сердце нарисовано только контуром акцентного цвета, без заливки.
export function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
        <path d="M12 21s-7-4.35-10-9.28C0.5 8.5 2 4 6.5 4c2.2 0 3.7 1.3 5.5 3.3C13.8 5.3 15.3 4 17.5 4 22 4 23.5 8.5 22 11.72 19 16.65 12 21 12 21z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-5 h-5 stroke-fly-accent">
      <path d="M12 21s-7-4.35-10-9.28C0.5 8.5 2 4 6.5 4c2.2 0 3.7 1.3 5.5 3.3C13.8 5.3 15.3 4 17.5 4 22 4 23.5 8.5 22 11.72 19 16.65 12 21 12 21z" />
    </svg>
  )
}

export function BackArrowIcon() {
  // Иконка "стрелка влево" — кнопка "назад" на экране переписки
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-5 h-5 stroke-current">
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SendIcon() {
  // Иконка "бумажный самолётик" — кнопка отправки сообщения в переписке
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-4 h-4 stroke-white">
      <path d="M4 12l16-8-6 16-3-6-7-2z" strokeLinecap="round" strokeLinejoin="round" />
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

// Три подпрыгивающие точки — индикатор "печатает…" (список "Сообщения" и переписка).
// Анимация задана в index.css (.typing-dots) - тут только сама разметка.
export function TypingDots() {
  return (
    <span className="typing-dots inline-flex items-center gap-[3px]">
      <span className="w-[5px] h-[5px] rounded-full bg-current" />
      <span className="w-[5px] h-[5px] rounded-full bg-current" />
      <span className="w-[5px] h-[5px] rounded-full bg-current" />
    </span>
  )
}

// Иконка "искорка" — помечает варианты подсказок, по-настоящему сочинённые ИИ
// (в отличие от заготовленных шаблонов). Фиолетовый - отдельный, второй акцент
// приложения, зарезервированный именно за ИИ-функциями (см. index.css), чтобы
// такие места были узнаваемы с первого взгляда и не путались с обычными кнопками.
export function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="w-3.5 h-3.5 stroke-fly-violet">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
