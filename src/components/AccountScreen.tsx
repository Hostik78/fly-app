// Экран "Аккаунт" — пока черновая заглушка. Здесь позже появится редактирование
// своей анкеты, настройки и т.д. Визуальный стиль всего приложения ещё будет меняться
// (см. notes.md), поэтому сейчас это самый простой вариант, без лишних деталей.
export function AccountScreen() {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-5 pt-3 pb-1">
        <h1 className="text-xl font-semibold text-fly-ink">Аккаунт</h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-4">
        {/* Заглушка вместо фото профиля */}
        <div className="flex flex-col items-center gap-3 pb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E4F2FD] to-[#BFE0F9]" />
          <p className="text-sm text-fly-gray">Здесь будет ваша анкета</p>
        </div>

        {/* Простой список пунктов настроек - пока без действия по клику */}
        <div className="flex flex-col gap-2">
          {['Редактировать анкету', 'Кто меня лайкнул', 'Настройки уведомлений', 'Помощь'].map((item) => (
            <div
              key={item}
              className="px-4 py-3 rounded-fly-md bg-[#F4F5F8] text-sm text-fly-ink"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
