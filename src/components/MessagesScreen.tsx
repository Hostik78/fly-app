import { useState, lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MessageIcon, TypingDots } from './icons'
import { Avatar } from './Avatar'
import { getAgeWord } from '../lib/pluralize'
import type { AppOutletContext } from './AppShell'
import type { Profile } from '../data/profiles'
import { useMatches } from '../lib/useMatches'
import { useTypingStatus } from '../lib/useTypingStatus'

// ChatScreen открывается не сразу, а только по клику на конкретное совпадение -
// поэтому его код тоже грузим отдельным кусочком (см. подробное объяснение lazy(...) в App.tsx).
const ChatScreen = lazy(() => import('./ChatScreen').then((m) => ({ default: m.ChatScreen })))

// Экран "Сообщения". Показывает список совпадений (взаимный лайк), а по клику
// на любое из них - открывает переписку с этим человеком (см. ChatScreen).
export function MessagesScreen() {
  const { currentUserId, onlineUserIds } = useOutletContext<AppOutletContext>()
  const { matches, loading, blockMatch } = useMatches(currentUserId)

  // Какое совпадение сейчас открыто как переписка. null - показываем список.
  const [openMatch, setOpenMatch] = useState<Profile | null>(null)

  // "Печатает" сразу за всеми совпадениями в списке, не только за одним открытым
  // разговором (см. useTypingStatus.ts) - id пересчитывается на каждый рендер,
  // но сам хук сравнивает их как строку, а не по ссылке, лишних переподключений нет.
  // Открытое сейчас совпадение (если есть) исключаем - за ним уже следит свой канал
  // внутри самого ChatScreen (useTypingChannel), два одинаковых канала на одну и ту
  // же пару людей не нужны, даже если это и не ломает саму функцию.
  const typingIds = useTypingStatus(
    currentUserId,
    matches.filter((match) => match.id !== openMatch?.id).map((match) => match.id),
  )

  // "Заблокировать" из открытого чата (см. ChatScreen.tsx) - сам поход в базу
  // и удаление совпадения из списка живёт в useMatches.ts (blockMatch), тут
  // только передаём его дальше по id профиля.
  async function handleBlock(profile: Profile) {
    await blockMatch(profile.id)
  }

  if (openMatch) {
    return (
      <Suspense fallback={<div className="h-full w-full" />}>
        <ChatScreen match={openMatch} onBack={() => setOpenMatch(null)} onBlock={handleBlock} />
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
        // Пусто, без текста "Загружаем..." - см. тот же приём в FeedScreen.tsx.
        <div className="flex-1" />
      ) : matches.length === 0 ? (
        // Пустое состояние по центру - совпадений пока нет
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-10 text-center">
          <div className="w-14 h-14 rounded-full bg-fly-tint-accent flex items-center justify-center">
            <div className="w-6 h-6 text-fly-accent">
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
            const isOnline = onlineUserIds.has(match.id)
            const isTyping = typingIds.has(match.id)
            return (
              <button
                key={match.id}
                onClick={() => setOpenMatch(match)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-fly-fog"
              >
                <div className="relative flex-shrink-0">
                  <Avatar userId={match.id} gender={match.gender} className="w-12 h-12 rounded-full" />
                  {/* Зелёный "маячок" в углу аватарки - виден, только пока человек в сети.
                      Раньше обводка была сплошным цветом фона экрана (эффект "выреза") -
                      работало, пока фон был одноцветным. Теперь фон - градиент (см.
                      index.css), точного совпадения цвета уже не существует, поэтому
                      обводка - полупрозрачный тон фона (box-shadow, не border): он
                      достаточно близок к любому месту градиента, а не подогнан под
                      один конкретный оттенок. */}
                  {isOnline && (
                    <span className="absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-fly-online shadow-[0_0_0_2.5px_rgba(255,246,241,0.9)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-fly-ink">
                    {match.age !== undefined && `${match.age} ${getAgeWord(match.age)}`}
                    {match.age !== undefined && match.height !== undefined && ', '}
                    {match.height !== undefined && `${match.height} см`}
                  </div>
                  {/* Пока человек печатает - вместо превью заметки показываем это,
                      как только перестал (см. TYPING_CLEAR_MS в typingChannel.ts) -
                      возвращается обычный текст сам собой */}
                  {isTyping ? (
                    <p className="text-xs font-semibold text-fly-accent flex items-center gap-1.5">
                      <TypingDots /> печатает…
                    </p>
                  ) : (
                    <p className="text-xs text-fly-gray truncate">{match.quote}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
