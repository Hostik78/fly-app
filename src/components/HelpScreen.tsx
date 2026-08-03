import { BackArrowIcon } from './icons'

interface HelpScreenProps {
  onBack: () => void
}

// "Как это работает" - открывается из Аккаунта (пункт "Помощь"). Своей службы
// поддержки/почты у проекта пока нет, поэтому вместо ссылки на неё - простое
// объяснение правил самого приложения (то, что реально может быть непонятно
// новому человеку), написанное прямо здесь, а не в отдельной системе.
export function HelpScreen({ onBack }: HelpScreenProps) {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-3 pb-3 bg-fly-glass backdrop-blur-fly-glass border-b border-fly-glass-border">
        <button
          onClick={onBack}
          className="w-11 h-11 -ml-1.5 flex items-center justify-center text-fly-ink flex-shrink-0"
        >
          <BackArrowIcon />
        </button>
        <h1 className="text-sm font-semibold text-fly-ink">Как это работает</h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 flex flex-col gap-6">
        <section>
          <h2 className="text-base font-bold text-fly-ink mb-1.5">Что это за приложение</h2>
          <p className="text-sm text-fly-ink leading-relaxed">
            Fly — для общения с людьми рядом с вами прямо в аэропорту: кто-то тоже ждёт
            задержанный рейс, кто-то ищет компанию для кофе, кто-то летит по работе и не прочь
            обсудить дела за час до посадки. Это не классический сайт знакомств — здесь нет
            цели искать романтику, хотя никто и не запрещает.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-fly-ink mb-1.5">Почему нужно быть в аэропорту</h2>
          <p className="text-sm text-fly-ink leading-relaxed">
            Приложение специально показывает ленту и разрешает публиковать заметку, только пока
            вы физически рядом с Шереметьево — в этом весь смысл: общаться с людьми, которые
            реально сейчас здесь, а не где угодно в мире.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-fly-ink mb-1.5">Заметка "Что вы ищете сейчас"</h2>
          <p className="text-sm text-fly-ink leading-relaxed">
            Короткая фраза о том, чем вы заняты прямо сейчас — не постоянная анкета, а что-то
            вроде объявления на один раз. Изменить её можно в любой момент через Аккаунт →
            «Изменить заметку».
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-fly-ink mb-1.5">Лайки и совпадения</h2>
          <p className="text-sm text-fly-ink leading-relaxed">
            Лайк — сердечко на карточке в ленте. Пока лайк не взаимный, собеседник не узнает,
            что вы его лайкнули (это видно только вам в Аккаунте → «Кто меня лайкнул», и только
            числом, без имён). Как только лайк становится взаимным — открывается настоящая
            переписка в разделе «Сообщения».
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-fly-ink mb-1.5">Скрыть анкету</h2>
          <p className="text-sm text-fly-ink leading-relaxed">
            Кнопка «⋯» на карточке в ленте — «Скрыть анкету»: человек больше не будет попадаться
            вам в ленте. Он об этом не узнает.
          </p>
        </section>
      </div>
    </div>
  )
}
