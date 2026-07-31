import { useState, lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MessageIcon } from './icons'
import { getAgeWord } from '../lib/pluralize'
import type { AppOutletContext } from './AppShell'
import type { Profile } from '../data/profiles'
import { useMatches } from '../lib/useMatches'
import { getGenderColor } from '../lib/genderColor'

// ChatScreen открывается не сразу, а только по клику на конкретное совпадение -
// поэтому его код тоже грузим отдельным кусочком (см. подробное объяснение lazy(...) в App.tsx).
const ChatScreen = lazy(() => import('./ChatScreen').then((m) => ({ default: m.ChatScreen })))

// Экран "Сообщения". Показывает список совпадений (взаимный лайк), а по клику
// на любое из них - открывает переписку с этим человеком (см. ChatScreen).
export function MessagesScreen() {
  const { currentUserId } = useOutletContext<AppOutletContext>()
  const { matches, loading } = useMatches(currentUserId)

  // Какое совпадение сейчас открыто как переписка. null - показываем список.
  const [openMatch, setOpenMatch] = useState<Profile | null>(null)

  if (openMatch) {
    return (
      <Suspense fallback={<div className="h-full w-full bg-white" />}>
        <ChatScreen match={openMatch} onBack={() => setOpenMatch(null)} />
      </Suspense>
    )
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Заголовок экрана - просто название раздела, без логотипа (он только на Ленте) */}
      <div className="flex-shrink-0 px-5 pt-3 pb-1">
        <h1 className="text-xl font-semibold text-fly-ink">Сообщения</h1>
      </div>

      {loading ? (
        <p className="text-center text-sm text-fly-gray py-10">Загружаем совпадения…</p>
      ) : matches.length === 0 ? (
        // Пустое состояние по центру - совпадений пока нет
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-10 text-center">
          <div className="w-14 h-14 rounded-full bg-fly-tint-coral flex items-center justify-center">
            <div className="w-6 h-6 text-fly-coral">
              <MessageIcon />
            </div>
          </div>
          <p className="text-sm text-fly-gray leading-relaxed">
            Совпадений пока нет. Поставьте лайк в ленте — если он окажется взаимным, переписка появится здесь.
          </p>
        </div>
      ) : (
        // Список совпадений - клик по любому открывает переписку (ChatScreen)
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {matches.map((match) => {
            const avatarColor = getGenderColor(match.gender)
            return (
              <button
                key={match.id}
                onClick={() => setOpenMatch(match)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-fly-fog"
              >
                <div className="w-12 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: avatarColor }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-fly-ink">
                    {match.age !== undefined && `${match.age} ${getAgeWord(match.age)}`}
                    {match.age !== undefined && match.height !== undefined && ', '}
                    {match.height !== undefined && `${match.height} см`}
                  </div>
                  <p className="text-xs text-fly-gray truncate">{match.quote}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
