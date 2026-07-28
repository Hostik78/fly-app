import { useState } from 'react'
import type { Profile } from '../data/profiles'
import { getIcebreakers } from '../data/icebreakers'
import { getAgeWord } from '../lib/pluralize'
import { BackArrowIcon, SendIcon } from './icons'

// Одно сообщение в переписке. from: 'them' - от собеседника, 'me' - от вас.
// Настоящих ответов от собеседника пока нет (нет ни бэкенда, ни второго живого
// человека) - "them" используется только для стартового сообщения-заглушки.
export interface ChatMessage {
  id: string
  text: string
  from: 'me' | 'them'
}

interface ChatScreenProps {
  match: Profile
  messages: ChatMessage[]
  onSend: (text: string) => void
  onBack: () => void
}

// Экран переписки с одним конкретным совпадением. Это не отдельный маршрут,
// а вид, который MessagesScreen показывает вместо списка, когда выбрано совпадение -
// так проще, чем заводить новый URL-путь ради одного экрана.
export function ChatScreen({ match, messages, onSend, onBack }: ChatScreenProps) {
  const [draft, setDraft] = useState('')
  const genderLetter = match.gender === 'female' ? 'Ж' : match.gender === 'male' ? 'М' : '?'
  const avatarColor = match.gender === 'female' ? 'bg-fly-coral' : 'bg-fly-blue-deep'

  // Подсказки для начала разговора - только для категории "Увлечения" с известным
  // хобби, и только пока человек ещё не написал в этот чат ни одного сообщения сам.
  const hasSentMessage = messages.some((message) => message.from === 'me')
  const icebreakers =
    !hasSentMessage && match.category === 'hobbies' && match.hobby ? getIcebreakers(match.hobby) : []

  function handleSend() {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Шапка переписки: кнопка назад к списку + кто это */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-3 pb-3 border-b border-[#F0F1F4]">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center text-fly-ink flex-shrink-0">
          <BackArrowIcon />
        </button>
        <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${avatarColor}`}>
          {genderLetter}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fly-ink truncate">
            {match.age !== undefined && `${match.age} ${getAgeWord(match.age)}`}
            {match.age !== undefined && match.height !== undefined && ', '}
            {match.height !== undefined && `${match.height} см`}
          </div>
          <div className="text-xs text-fly-gray">{match.online ? 'В сети' : 'Не в сети'}</div>
        </div>
      </div>

      {/* Лента сообщений: прокручивается независимо от шапки и поля ввода */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-2.5">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[75%] px-3.5 py-2.5 rounded-fly-md text-sm leading-relaxed ${
              message.from === 'me'
                ? 'self-end bg-fly-ink text-white'
                : 'self-start bg-[#F4F5F8] text-fly-ink'
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

      {/* Подсказки для начала разговора - показываются только пока не написали сами */}
      {icebreakers.length > 0 && (
        <div className="flex-shrink-0 flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
          {icebreakers.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setDraft(text)}
              className="text-left text-xs text-fly-ink bg-[#F4F5F8] rounded-fly-md px-3 py-2 whitespace-nowrap flex-shrink-0"
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {/* Поле ввода нового сообщения - всегда внизу, не скроллится вместе с лентой */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-[#F0F1F4]">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSend()
          }}
          placeholder="Написать сообщение..."
          className="flex-1 bg-[#F4F5F8] rounded-fly-md px-4 py-2.5 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-blue"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim()}
          className="w-10 h-10 rounded-fly-md bg-fly-coral flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
