// Кнопка "Нужна идея?" и выезжающая снизу панель с подсказками текста заметки
// для CreateStatusScreen. Сначала мгновенно показывает шаблонные фразы
// (с реальной погодой/временем суток), потом асинхронно дорисовывает
// 1-2 варианта, по-настоящему сочинённых ИИ (помечены искоркой).
//
// Ничего не знает о внутренностях liveContext/suggestionTemplates — только
// вызывает их и рисует результат. Закрывается сама, если человек начинает
// печатать вручную (меняется проп quote не из-за выбора подсказки).

import { useEffect, useRef, useState } from 'react'
import { getLiveContext } from '../lib/liveContext'
import { getSuggestions } from '../data/suggestionTemplates'
import type { ProfileCategory } from '../data/profiles'
import { SparkleIcon } from './icons'

interface SuggestionPanelProps {
  category: ProfileCategory
  quote: string
  onSelect: (text: string) => void
}

export function SuggestionPanel({ category, quote, onSelect }: SuggestionPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [instant, setInstant] = useState<string[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  // Когда true, следующее изменение quote вызвано выбором подсказки, а не
  // ручным вводом — панель не должна закрываться сама по себе от этого
  const skipCloseRef = useRef(false)

  // Панель закрывается сама, если человек продолжил печатать вручную
  useEffect(() => {
    if (skipCloseRef.current) {
      skipCloseRef.current = false
      return
    }
    setIsOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote])

  async function handleToggle() {
    if (isOpen) {
      setIsOpen(false)
      return
    }

    setIsOpen(true)
    setAiSuggestions([])

    const context = await getLiveContext()
    setInstant(getSuggestions(category, context))

    setAiLoading(true)
    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, context }),
      })
      const data = await response.json()
      setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch {
      setAiSuggestions([])
    } finally {
      setAiLoading(false)
    }
  }

  function handlePick(text: string) {
    skipCloseRef.current = true
    onSelect(text)
    setIsOpen(false)
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-fly-violet"
      >
        <SparkleIcon />
        Нужна идея?
      </button>

      {isOpen && (
        <div className="mt-2 flex flex-col gap-2 bg-fly-fog rounded-fly-md p-3">
          {instant.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => handlePick(text)}
              className="text-left text-sm text-fly-ink bg-white rounded-fly-md px-3 py-2"
            >
              {text}
            </button>
          ))}

          {aiSuggestions.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => handlePick(text)}
              className="text-left text-sm text-fly-ink bg-white rounded-fly-md px-3 py-2 flex items-start gap-1.5"
            >
              <span className="mt-0.5 flex-shrink-0">
                <SparkleIcon />
              </span>
              {text}
            </button>
          ))}

          {aiLoading && (
            <p className="text-xs text-fly-gray px-1">Придумываю ещё варианты…</p>
          )}
        </div>
      )}
    </div>
  )
}
