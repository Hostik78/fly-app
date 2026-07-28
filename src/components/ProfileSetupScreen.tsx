// Экран "Расскажите о себе" - разовая короткая анкета (пол/возраст/рост/языки),
// показывается один раз после входа, до экрана заметки "Что вы ищете сейчас?".
// Структура и стиль - по образцу CreateStatusScreen.tsx.
//
// Список выбора языков сделан разворачивающимся прямо на странице (а не всплывающим
// окном) специально: всплывающее окно рисуется поверх ВСЕЙ страницы браузера, а не
// только внутри рамки телефона из DevicePreview.tsx - в режиме предпросмотра оно бы
// оказалось не на месте. Разворачивающийся список этой проблемы не создаёт.

import { useState } from 'react'
import { getLanguageName, languageOptions } from '../data/languages'

const MIN_AGE = 18
const MAX_AGE = 99
const MIN_HEIGHT = 120
const MAX_HEIGHT = 230

const ageOptions = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, index) => MIN_AGE + index)
const heightOptions = Array.from({ length: MAX_HEIGHT - MIN_HEIGHT + 1 }, (_, index) => MIN_HEIGHT + index)

interface ProfileSetupScreenProps {
  // Вызывается при отправке анкеты. Все поля необязательные - человек может нажать
  // "Продолжить", ничего не заполнив, поэтому null - такое же нормальное значение,
  // как и заполненное. Асинхронная - сохраняется в базу данных; если не получилось
  // (например, нет сети), нужно выбросить ошибку - её поймает этот же экран и покажет
  // сообщение (тот же паттерн, что в CreateStatusScreen).
  onSubmit: (
    gender: 'male' | 'female' | null,
    age: number | null,
    height: number | null,
    languages: string | null,
  ) => Promise<void>
}

export function ProfileSetupScreen({ onSubmit }: ProfileSetupScreenProps) {
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [ageInput, setAgeInput] = useState('')
  const [heightInput, setHeightInput] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [languageSearch, setLanguageSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredLanguages = languageSearch.trim()
    ? languageOptions.filter((option) => option.name.toLowerCase().includes(languageSearch.trim().toLowerCase()))
    : languageOptions

  function toggleLanguage(code: string) {
    setSelectedLanguages((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    )
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(
        gender,
        ageInput === '' ? null : Number(ageInput),
        heightInput === '' ? null : Number(heightInput),
        selectedLanguages.length > 0 ? selectedLanguages.map(getLanguageName).join(', ') : null,
      )
    } catch {
      setError('Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-12 pb-6 flex flex-col">
        <div className="text-xl font-semibold mb-1">
          Fl<span className="text-fly-blue-deep">y</span>
        </div>
        <h1 className="text-2xl font-semibold text-fly-ink mt-6">Расскажите о себе</h1>
        <p className="text-sm text-fly-gray mt-2 leading-relaxed">
          Коротко — эти данные будет видно в вашей карточке в ленте. Всё необязательно,
          можно пропустить и заполнить позже.
        </p>

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Пол</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGender('male')}
            className={
              gender === 'male'
                ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white transition-colors'
                : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
            }
          >
            Мужской
          </button>
          <button
            type="button"
            onClick={() => setGender('female')}
            className={
              gender === 'female'
                ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white transition-colors'
                : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
            }
          >
            Женский
          </button>
        </div>

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Возраст</p>
        <select
          value={ageInput}
          onChange={(event) => setAgeInput(event.target.value)}
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        >
          <option value="" disabled>
            Выберите возраст
          </option>
          {ageOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Рост, см</p>
        <select
          value={heightInput}
          onChange={(event) => setHeightInput(event.target.value)}
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        >
          <option value="" disabled>
            Выберите рост
          </option>
          {heightOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Языки</p>
        <button
          type="button"
          onClick={() => setLanguagePickerOpen((open) => !open)}
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-left outline-none border border-transparent focus:border-fly-blue"
        >
          {selectedLanguages.length > 0 ? (
            <span className="text-fly-ink">{selectedLanguages.map(getLanguageName).join(', ')}</span>
          ) : (
            <span className="text-fly-gray">Выбрать языки</span>
          )}
        </button>

        {languagePickerOpen && (
          <div className="mt-2 rounded-fly-md border border-[#E9EBF1] overflow-hidden">
            <input
              type="text"
              value={languageSearch}
              onChange={(event) => setLanguageSearch(event.target.value)}
              placeholder="Поиск..."
              className="w-full px-4 py-2.5 text-sm text-fly-ink outline-none border-b border-[#E9EBF1]"
            />
            <div className="max-h-48 overflow-y-auto overscroll-contain">
              {filteredLanguages.map(({ code, name }) => (
                <label
                  key={code}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-fly-ink hover:bg-[#F4F5F8] cursor-pointer"
                >
                  <input type="checkbox" checked={selectedLanguages.includes(code)} onChange={() => toggleLanguage(code)} />
                  {name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {error && <p className="mt-4 text-xs text-fly-gray text-center">{error}</p>}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          {submitting ? 'Сохраняем…' : 'Продолжить'}
        </button>
      </div>
    </div>
  )
}
