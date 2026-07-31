import { useState } from 'react'
import { categories } from '../data/categories'
import { hobbies, type HobbyId } from '../data/hobbies'
import type { ProfileCategory } from '../data/profiles'
import { SuggestionPanel } from './SuggestionPanel'

// Для повторного использования этого же экрана в режиме редактирования уже
// опубликованной заметки (см. AccountScreen.tsx).
interface StatusInitialValues {
  quote: string
  category: ProfileCategory
  hobby: HobbyId | null
}

interface CreateStatusScreenProps {
  initialValues?: StatusInitialValues
  // Текст на кнопке отправки - по умолчанию "Опубликовать" (для самой первой
  // заметки). При редактировании передаётся "Сохранить".
  submitLabel?: string
  // Кнопка "Отмена" - только при редактировании. Первую заметку отменить нельзя -
  // без неё нет доступа в остальное приложение (см. RequireStatus в App.tsx).
  onCancel?: () => void
  // Вызывается при публикации: передаёт наружу текст, категорию и хобби (если категория
  // "Увлечения"; иначе null), которые ввёл человек. Асинхронная - публикация сохраняется
  // в базу данных; если не получилось (например, нет сети), нужно выбросить ошибку -
  // её поймает этот же экран и покажет сообщение.
  onSubmit: (quote: string, category: ProfileCategory, hobby: HobbyId | null) => Promise<void>
}

// Экран "Что вы ищете сейчас?" — главная идея Pure: чтобы увидеть чужие анкеты,
// нужно сначала опубликовать свою короткую заметку. Пока не нажали "Опубликовать",
// в остальную часть приложения попасть нельзя (см. RequireStatus в App.tsx).
//
// Это отдельный, самостоятельный экран (не часть AppShell) - у него нет ни строки
// статуса, ни нижней навигации, потому что до публикации остального приложения как бы
// ещё не существует для человека. При редактировании (initialValues заполнены) он всё
// равно рендерится тем же способом - переиспользуется как отдельный полноэкранный вид
// внутри AccountScreen, не как часть AppShell.
export function CreateStatusScreen({ initialValues, submitLabel, onCancel, onSubmit }: CreateStatusScreenProps) {
  const [quote, setQuote] = useState(initialValues?.quote ?? '')
  const [category, setCategory] = useState<ProfileCategory>(initialValues?.category ?? categories[0].id)
  const [hobby, setHobby] = useState<HobbyId | null>(initialValues?.hobby ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(quote.trim(), category, hobby)
    } catch {
      setError('Не получилось опубликовать. Проверьте интернет и попробуйте ещё раз.')
    } finally {
      setSubmitting(false)
    }
  }

  // Публиковать можно только если человек хоть что-то написал (без пустых заметок),
  // а для категории "Увлечения" - ещё и выбрал конкретное хобби
  const canSubmit = quote.trim().length > 0 && (category !== 'hobbies' || hobby !== null)

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-12 pb-6 flex flex-col">
        <div className="text-xl font-semibold mb-1">
          Fl<span className="text-fly-coral">y</span>
        </div>
        <h1 className="text-2xl font-semibold text-fly-ink mt-6">
          {initialValues ? 'Изменить заметку' : 'Что вы ищете сейчас?'}
        </h1>
        <p className="text-sm text-fly-gray mt-2 leading-relaxed">
          Короткая заметка о том, чем вы заняты в аэропорту прямо сейчас. Её увидят только
          пока вы онлайн — как объявление, а не постоянная анкета.
        </p>

        <textarea
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          placeholder="Например: жду посадку у 14 гейта, есть час свободного времени..."
          rows={4}
          className="mt-6 w-full bg-fly-fog rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-coral resize-none"
        />

        <SuggestionPanel category={category} quote={quote} onSelect={setQuote} />

        <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">
          Категория
        </p>
        <div className="flex gap-2 flex-wrap">
          {categories.map((item) => {
            const isActive = item.id === category
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={
                  isActive
                    ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white transition-colors'
                    : 'px-4 py-2 rounded-full text-xs font-medium bg-fly-fog text-fly-gray transition-colors hover:bg-fly-fog-strong hover:text-fly-ink'
                }
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {category === 'hobbies' && (
          <>
            <p className="text-xs font-medium text-fly-gray uppercase tracking-wide mt-6 mb-2">Хобби</p>
            <div className="flex gap-2 flex-wrap">
              {hobbies.map((item) => {
                const isActive = item.id === hobby
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setHobby(item.id)}
                    className={
                      isActive
                        ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white transition-colors'
                        : 'px-4 py-2 rounded-full text-xs font-medium bg-fly-fog text-fly-gray transition-colors hover:bg-fly-fog-strong hover:text-fly-ink'
                    }
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="flex-1" />

        {error && <p className="mt-4 text-xs text-fly-gray text-center">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          {submitting ? 'Публикуем…' : (submitLabel ?? 'Опубликовать')}
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
