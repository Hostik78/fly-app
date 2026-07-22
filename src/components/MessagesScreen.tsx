import { useOutletContext } from 'react-router-dom'
import { MessageIcon } from './icons'
import type { AppOutletContext } from './AppShell'

// Экран "Сообщения". Пока без настоящей переписки внутри - просто список тех,
// с кем случилось совпадение (взаимный лайк). Если совпадений ещё нет - пустое состояние.
export function MessagesScreen() {
  const { matches } = useOutletContext<AppOutletContext>()

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Заголовок экрана - просто название раздела, без логотипа (он только на Ленте) */}
      <div className="flex-shrink-0 px-5 pt-3 pb-1">
        <h1 className="text-xl font-semibold text-fly-ink">Сообщения</h1>
      </div>

      {matches.length === 0 ? (
        // Пустое состояние по центру - совпадений пока нет
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-10 text-center">
          <div className="w-14 h-14 rounded-full bg-fly-tint-blue flex items-center justify-center">
            <div className="w-6 h-6 text-fly-blue-deep">
              <MessageIcon />
            </div>
          </div>
          <p className="text-sm text-fly-gray leading-relaxed">
            Совпадений пока нет. Поставьте лайк в ленте — если он окажется взаимным, переписка появится здесь.
          </p>
        </div>
      ) : (
        // Список совпадений - каждое пока просто ведёт себя как строка предпросмотра,
        // без открытия отдельного чата (сама переписка появится позже).
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {matches.map((match) => {
            const genderLetter = match.gender === 'female' ? 'Ж' : 'М'
            const avatarColor = match.gender === 'female' ? 'bg-fly-coral' : 'bg-fly-blue-deep'
            return (
              <div key={match.quote} className="flex items-center gap-3 px-5 py-3">
                <div
                  className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold ${avatarColor}`}
                >
                  {genderLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-fly-ink">Новое совпадение 🎉</div>
                  <p className="text-xs text-fly-gray truncate">{match.quote}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
