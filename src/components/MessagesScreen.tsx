import { MessageIcon } from './icons'

// Экран "Сообщения" — пока это просто заглушка с пустым состоянием.
// Настоящие переписки появятся здесь позже, когда будет с кем совпадать (лайк на лайк).
export function MessagesScreen() {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Заголовок экрана - просто название раздела, без логотипа (он только на Ленте) */}
      <div className="flex-shrink-0 px-5 pt-3 pb-1">
        <h1 className="text-xl font-semibold text-fly-ink">Сообщения</h1>
      </div>

      {/* Пустое состояние по центру - совпадений пока нет */}
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
    </div>
  )
}
