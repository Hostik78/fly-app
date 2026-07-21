import { useState } from 'react'
import type { Profile, ProfileCategory } from '../data/profiles'

// Подписи категорий для выпадающего списка — те же самые, что и в фильтрах на экране.
const categoryLabels: Record<ProfileCategory, string> = {
  communication: 'Общение',
  romance: 'Романтика',
  hobbies: 'Увлечения',
  'fellow-travelers': 'Попутчики',
  networking: 'Нетворкинг',
  friendship: 'Дружба',
}

interface ContentControlsProps {
  profiles: Profile[]
  onChange: (next: Profile[]) => void
  onReset: () => void
}

// Общее поле ввода в панели — просто чтобы не повторять одни и те же классы
// для каждого input/textarea/select по отдельности.
const fieldClass =
  'w-full bg-[#F4F5F8] rounded-lg px-2.5 py-1.5 text-[13px] text-fly-ink outline-none border border-transparent focus:border-fly-blue'

// ContentControls — панель "экспериментов": позволяет менять текст и данные любой анкеты
// прямо во время разработки и сразу видеть результат на экране телефона, без правки кода.
// Похоже на панель Controls в Storybook. Изменения тут временные (только в памяти браузера) -
// когда решишь, что вариант хорош, нужно вручную перенести значения в src/data/profiles.ts.
export function ContentControls({ profiles, onChange, onReset }: ContentControlsProps) {
  // Индекс анкеты, которую сейчас редактируем в панели
  const [selectedIndex, setSelectedIndex] = useState(0)
  const profile = profiles[selectedIndex]

  // Обновляет одно поле у выбранной анкеты, не трогая остальные анкеты в списке
  function updateField<K extends keyof Profile>(field: K, value: Profile[K]) {
    const next = profiles.map((item, index) => (index === selectedIndex ? { ...item, [field]: value } : item))
    onChange(next)
  }

  if (!profile) return null

  return (
    <div className="w-[280px] flex-shrink-0 bg-white border border-black/[0.06] rounded-xl shadow-[0_4px_16px_rgba(30,40,70,0.10)] p-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-fly-ink">Экспериментальная панель</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[12px] font-medium text-fly-blue-deep hover:underline"
        >
          Сбросить
        </button>
      </div>

      {/* Выбор анкеты для редактирования */}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-fly-gray uppercase tracking-wide">Анкета</span>
        <select
          value={selectedIndex}
          onChange={(event) => setSelectedIndex(Number(event.target.value))}
          className={fieldClass}
        >
          {profiles.map((item, index) => (
            <option key={index} value={index}>
              {index + 1}. {item.quote.slice(0, 24)}…
            </option>
          ))}
        </select>
      </label>

      {/* Текст анкеты */}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-fly-gray uppercase tracking-wide">Текст</span>
        <textarea
          value={profile.quote}
          onChange={(event) => updateField('quote', event.target.value)}
          rows={3}
          className={fieldClass}
        />
      </label>

      {/* Пол и категория рядом в одной строке */}
      <div className="flex gap-2">
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-[11px] font-medium text-fly-gray uppercase tracking-wide">Пол</span>
          <select
            value={profile.gender}
            onChange={(event) => updateField('gender', event.target.value as Profile['gender'])}
            className={fieldClass}
          >
            <option value="female">Женский</option>
            <option value="male">Мужской</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-[11px] font-medium text-fly-gray uppercase tracking-wide">Категория</span>
          <select
            value={profile.category}
            onChange={(event) => updateField('category', event.target.value as ProfileCategory)}
            className={fieldClass}
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Возраст и слово после числа */}
      <div className="flex gap-2">
        <label className="flex flex-col gap-1 w-[70px]">
          <span className="text-[11px] font-medium text-fly-gray uppercase tracking-wide">Возраст</span>
          <input
            type="number"
            value={profile.age}
            onChange={(event) => updateField('age', Number(event.target.value))}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-[11px] font-medium text-fly-gray uppercase tracking-wide">Слово (год/года/лет)</span>
          <input
            type="text"
            value={profile.ageWord}
            onChange={(event) => updateField('ageWord', event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {/* Рост и языки */}
      <div className="flex gap-2">
        <label className="flex flex-col gap-1 w-[70px]">
          <span className="text-[11px] font-medium text-fly-gray uppercase tracking-wide">Рост, см</span>
          <input
            type="number"
            value={profile.height}
            onChange={(event) => updateField('height', Number(event.target.value))}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-[11px] font-medium text-fly-gray uppercase tracking-wide">Языки</span>
          <input
            type="text"
            value={profile.languages}
            onChange={(event) => updateField('languages', event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {/* Онлайн / Новая анкета — простые переключатели */}
      <div className="flex gap-4 pt-1">
        <label className="flex items-center gap-2 text-[13px] text-fly-ink cursor-pointer">
          <input
            type="checkbox"
            checked={profile.online}
            onChange={(event) => updateField('online', event.target.checked)}
          />
          Онлайн
        </label>
        <label className="flex items-center gap-2 text-[13px] text-fly-ink cursor-pointer">
          <input
            type="checkbox"
            checked={profile.isNew ?? false}
            onChange={(event) => updateField('isNew', event.target.checked)}
          />
          Значок "New"
        </label>
      </div>
    </div>
  )
}
