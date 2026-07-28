// Экран "Расскажите о себе" - разовая короткая анкета (пол/возраст/рост/языки),
// показывается один раз после входа, до экрана заметки "Что вы ищете сейчас?".
// Структура и стиль - по образцу CreateStatusScreen.tsx.

import { useState } from 'react'

const MIN_AGE = 18
const MAX_AGE = 99
const MIN_HEIGHT = 120
const MAX_HEIGHT = 230

interface ProfileSetupScreenProps {
  // Вызывается при отправке анкеты. Асинхронная - сохраняется в базу данных;
  // если не получилось (например, нет сети), нужно выбросить ошибку - её поймает
  // этот же экран и покажет сообщение (тот же паттерн, что в CreateStatusScreen).
  onSubmit: (gender: 'male' | 'female', age: number, height: number, languages: string) => Promise<void>
}

export function ProfileSetupScreen({ onSubmit }: ProfileSetupScreenProps) {
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [ageInput, setAgeInput] = useState('')
  const [heightInput, setHeightInput] = useState('')
  const [languages, setLanguages] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const age = Number(ageInput)
  const height = Number(heightInput)
  const canSubmit =
    gender !== null &&
    Number.isInteger(age) &&
    age >= MIN_AGE &&
    age <= MAX_AGE &&
    Number.isInteger(height) &&
    height >= MIN_HEIGHT &&
    height <= MAX_HEIGHT &&
    languages.trim().length > 0

  async function handleSubmit() {
    if (!canSubmit || gender === null) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(gender, age, height, languages.trim())
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
          Коротко — эти данные будет видно в вашей карточке в ленте.
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
        <input
          type="number"
          value={ageInput}
          onChange={(event) => setAgeInput(event.target.value)}
          placeholder="Например: 27"
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        />

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Рост, см</p>
        <input
          type="number"
          value={heightInput}
          onChange={(event) => setHeightInput(event.target.value)}
          placeholder="Например: 175"
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        />

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Языки</p>
        <input
          type="text"
          value={languages}
          onChange={(event) => setLanguages(event.target.value)}
          placeholder="Русский, английский"
          className="w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        />

        <div className="flex-1" />

        {error && <p className="mt-4 text-xs text-fly-gray text-center">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          {submitting ? 'Сохраняем…' : 'Продолжить'}
        </button>
      </div>
    </div>
  )
}
