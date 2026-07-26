import { useState } from 'react'
import { categories } from '../data/categories'
import type { ProfileCategory } from '../data/profiles'
import { SuggestionPanel } from './SuggestionPanel'

interface CreateStatusScreenProps {
  // Вызывается при публикации: передаёт наружу текст и категорию, которые ввёл человек
  onSubmit: (quote: string, category: ProfileCategory) => void
}

// Экран "Что вы ищете сейчас?" — главная идея Pure: чтобы увидеть чужие анкеты,
// нужно сначала опубликовать свою короткую заметку. Пока не нажали "Опубликовать",
// в остальную часть приложения попасть нельзя (см. RequireStatus в App.tsx).
//
// Это отдельный, самостоятельный экран (не часть AppShell) - у него нет ни строки
// статуса, ни нижней навигации, потому что до публикации остального приложения как бы
// ещё не существует для человека.
export function CreateStatusScreen({ onSubmit }: CreateStatusScreenProps) {
  const [quote, setQuote] = useState('')
  const [category, setCategory] = useState<ProfileCategory>(categories[0].id)

  // Публиковать можно только если человек хоть что-то написал (без пустых заметок)
  const canSubmit = quote.trim().length > 0

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-12 pb-6 flex flex-col">
        <div className="text-xl font-semibold mb-1">
          Fl<span className="text-fly-blue-deep">y</span>
        </div>
        <h1 className="text-2xl font-semibold text-fly-ink mt-6">Что вы ищете сейчас?</h1>
        <p className="text-sm text-fly-gray mt-2 leading-relaxed">
          Короткая заметка о том, чем вы заняты в аэропорту прямо сейчас. Её увидят только
          пока вы онлайн — как объявление, а не постоянная анкета.
        </p>

        <textarea
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          placeholder="Например: жду посадку у 14 гейта, есть час свободного времени..."
          rows={4}
          className="mt-6 w-full bg-[#F4F5F8] rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue resize-none"
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
                    : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
                }
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(quote.trim(), category)}
          className="mt-8 w-full py-3.5 rounded-fly-md bg-fly-coral text-white font-semibold text-sm transition-opacity disabled:opacity-30"
        >
          Опубликовать
        </button>
      </div>
    </div>
  )
}
