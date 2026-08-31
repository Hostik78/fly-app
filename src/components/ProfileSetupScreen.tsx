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
import { createSubmissionGuard } from '../lib/submissionGuard'

const MIN_AGE = 18
const MAX_AGE = 99
const MIN_HEIGHT = 120
const MAX_HEIGHT = 230

const ageOptions = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, index) => MIN_AGE + index)
const heightOptions = Array.from({ length: MAX_HEIGHT - MIN_HEIGHT + 1 }, (_, index) => MIN_HEIGHT + index)

// Для повторного использования этого же экрана в режиме редактирования (см.
// AccountScreen.tsx) - если передано, поля заполняются текущими значениями вместо
// пустых, а не только для первого разового заполнения после входа.
interface ProfileInitialValues {
  gender: 'male' | 'female' | null
  age: number | null
  height: number | null
  languageCodes: string[]
}

interface ProfileSetupScreenProps {
  initialValues?: ProfileInitialValues
  // Текст на кнопке отправки, пока не идёт сохранение - по умолчанию "Продолжить"
  // (для первого разового заполнения). При редактировании передаётся "Сохранить".
  submitLabel?: string
  // Кнопка "Отмена" - только при редактировании, где есть куда вернуться, ничего
  // не сохранив. При первом разовом заполнении анкета обязательна, отменить нельзя.
  onCancel?: () => void
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

export function ProfileSetupScreen({ initialValues, submitLabel, onCancel, onSubmit }: ProfileSetupScreenProps) {
  const [gender, setGender] = useState<'male' | 'female' | null>(initialValues?.gender ?? null)
  const [ageInput, setAgeInput] = useState(initialValues?.age != null ? String(initialValues.age) : '')
  const [heightInput, setHeightInput] = useState(initialValues?.height != null ? String(initialValues.height) : '')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(initialValues?.languageCodes ?? [])
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [languageSearch, setLanguageSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // disabled у кнопки обновляется только на следующей отрисовке React. Этот
  // отдельный синхронный флаг не пропустит второй быстрый клик до неё.
  const [submitOnce] = useState(createSubmissionGuard)

  const filteredLanguages = languageSearch.trim()
    ? languageOptions.filter((option) => option.name.toLowerCase().includes(languageSearch.trim().toLowerCase()))
    : languageOptions

  function toggleLanguage(code: string) {
    setSelectedLanguages((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    )
  }

  async function handleSubmit() {
    await submitOnce(async () => {
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
        setError('Не получилось сохранить. Данные остались на месте — попробуйте ещё раз.')
      } finally {
        setSubmitting(false)
      }
    })
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Экран во весь экран, без общей рамки AppShell - safe-area отступы нужны
          здесь сами по себе (см. подробное объяснение в AppShell.tsx). */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-6 flex flex-col"
        style={{
          paddingTop: 'calc(3rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="text-xl font-semibold mb-1">
          Fl<span className="text-fly-accent">y</span>
        </div>
        <h1 className="text-2xl font-semibold text-fly-ink mt-6">
          {initialValues ? 'Редактировать анкету' : 'Расскажите о себе'}
        </h1>
        <p className="text-sm text-fly-gray mt-2 leading-relaxed">
          {initialValues
            ? 'Измените, что нужно, и сохраните.'
            : 'Коротко — эти данные будет видно в вашей карточке в ленте. Всё необязательно, можно пропустить и заполнить позже.'}
        </p>

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Пол</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGender('male')}
            className={
              gender === 'male'
                ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-solid text-fly-solid-text transition-colors'
                : 'px-4 py-2 rounded-full text-xs font-medium bg-fly-fog text-fly-gray transition-colors hover:bg-fly-fog-strong hover:text-fly-ink'
            }
          >
            Мужской
          </button>
          <button
            type="button"
            onClick={() => setGender('female')}
            className={
              gender === 'female'
                ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-solid text-fly-solid-text transition-colors'
                : 'px-4 py-2 rounded-full text-xs font-medium bg-fly-fog text-fly-gray transition-colors hover:bg-fly-fog-strong hover:text-fly-ink'
            }
          >
            Женский
          </button>
        </div>

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Возраст</p>
        <select
          value={ageInput}
          onChange={(event) => setAgeInput(event.target.value)}
          className="w-full bg-fly-fog rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-accent"
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
          className="w-full bg-fly-fog rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-accent"
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
          className="w-full bg-fly-fog rounded-fly-md px-4 py-3 text-sm text-left outline-none border border-transparent focus:border-fly-accent"
        >
          {selectedLanguages.length > 0 ? (
            <span className="text-fly-ink">{selectedLanguages.map(getLanguageName).join(', ')}</span>
          ) : (
            <span className="text-fly-gray">Выбрать языки</span>
          )}
        </button>

        {languagePickerOpen && (
          <div className="mt-2 rounded-fly-md bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border overflow-hidden">
            <input
              type="text"
              value={languageSearch}
              onChange={(event) => setLanguageSearch(event.target.value)}
              placeholder="Поиск..."
              className="w-full px-4 py-2.5 text-sm text-fly-ink outline-none border-b border-fly-glass-border"
            />
            <div className="max-h-48 overflow-y-auto overscroll-contain">
              {filteredLanguages.map(({ code, name }) => (
                <label
                  key={code}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-fly-ink hover:bg-fly-fog cursor-pointer"
                >
                  <input type="checkbox" checked={selectedLanguages.includes(code)} onChange={() => toggleLanguage(code)} />
                  {name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Место под ошибку существует всегда: при повторной попытке текст может
            исчезнуть, но кнопка больше не прыгает вверх-вниз. */}
        <div className="mt-4 h-10 flex-shrink-0 flex items-center justify-center">
          {error && <p className="text-xs text-fly-gray text-center">{error}</p>}
        </div>

        <button
          type="button"
          disabled={submitting}
          aria-busy={submitting}
          onClick={() => void handleSubmit()}
          className="mt-4 w-full py-3.5 rounded-fly-md bg-fly-accent text-white font-semibold text-sm disabled:cursor-wait"
        >
          {submitting ? 'Сохраняем…' : (submitLabel ?? 'Продолжить')}
        </button>

        {onCancel && (
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="mt-3 w-full py-3 rounded-fly-md bg-fly-fog text-fly-ink font-semibold text-sm transition-opacity disabled:opacity-30"
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}
