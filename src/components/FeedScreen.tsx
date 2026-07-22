import { useState } from 'react'
import { profiles as defaultProfiles, type Profile, type ProfileCategory } from '../data/profiles'
import { categories } from '../data/categories'
import { ProfileCard } from './ProfileCard'
import { MenuIcon } from './icons'

// Одна запись фильтра: id - для сравнения в коде, label - что видит пользователь.
// 'all' не привязан ни к какой категории анкеты - это режим "показать всё".
interface FilterOption {
  id: ProfileCategory | 'all'
  label: string
}

// Полный список фильтров-таблеток над лентой: "Все" + общий список категорий
// (тот же самый, что используется при создании собственного статуса).
const filters: FilterOption[] = [{ id: 'all', label: 'Все' }, ...categories]

interface FeedScreenProps {
  // Список анкет необязателен: если не передать - используются встроенные тестовые данные.
  // Это позволяет DevicePreview подменять анкеты "на лету" (панель экспериментов),
  // а при обычном использовании (<FeedScreen /> без пропсов) всё работает как раньше.
  profiles?: Profile[]
}

// Главный экран приложения — лента анкет.
// Собирает вместе шапку, фильтры, список карточек анкет и нижнюю навигацию.
//
// Важно про прокрутку: весь экран занимает ровно всю высоту телефона (h-full) и сам
// никогда не скроллится. Скроллится только средняя часть со списком карточек —
// шапка сверху и навигация снизу всегда остаются на месте, как в настоящих приложениях.
export function FeedScreen({ profiles = defaultProfiles }: FeedScreenProps) {
  // Запоминаем, какой фильтр сейчас выбран. По умолчанию — "Все".
  const [activeFilter, setActiveFilter] = useState<FilterOption['id']>('all')

  // Если выбрано "Все" — показываем все анкеты, иначе — только с нужной категорией.
  const visibleProfiles =
    activeFilter === 'all' ? profiles : profiles.filter((profile) => profile.category === activeFilter)

  // Название выбранного фильтра — нужно для текста в пустом состоянии.
  const activeFilterLabel = filters.find((filter) => filter.id === activeFilter)?.label ?? ''

  return (
    // h-full - занимает всю высоту области экрана, которую выделяет AppShell под контент.
    // overflow-hidden - ничего не должно вылезать наружу.
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">

      {/* Верхний блок (шапка, фильтры) не скроллится и не сжимается - flex-shrink-0 */}
      <div className="flex-shrink-0">
        {/* Шапка: название приложения слева, кнопка меню справа */}
        <div className="flex items-center justify-between px-5 pt-3">
          <div className="text-xl font-semibold">
            Fl<span className="text-fly-blue-deep">y</span>
          </div>
          <button className="w-[38px] h-[38px] rounded-fly-md bg-fly-tint-blue flex items-center justify-center transition-colors hover:bg-[#DEEEFB]">
            <MenuIcon />
          </button>
        </div>

        {/* Фильтры ленты в виде круглых "таблеток". Фильтров много, поэтому строка
            прокручивается вбок (overflow-x-auto), а не переносится на новую строку. */}
        <div className="flex gap-2 px-5 pt-4 overflow-x-auto no-scrollbar">
          {filters.map((filter) => {
            const isActive = filter.id === activeFilter
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={
                  isActive
                    ? 'px-4 py-2 rounded-full text-xs font-medium bg-fly-ink text-white whitespace-nowrap flex-shrink-0 transition-colors'
                    : 'px-4 py-2 rounded-full text-xs font-medium bg-[#F4F5F8] text-fly-gray whitespace-nowrap flex-shrink-0 transition-colors hover:bg-[#E9EBF1] hover:text-fly-ink'
                }
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Средняя часть — список карточек анкет. flex-1 - занимает всё оставшееся место
          между шапкой и навигацией. overflow-y-auto - именно тут работает прокрутка/свайп,
          и только тут. overscroll-contain - долистав до конца списка, страница дальше не
          "проваливается" никуда наружу. */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5">
        {/* key={activeFilter} заставляет React пересобрать этот блок при смене фильтра,
            а класс fade-in проигрывает плавное появление — вместо того чтобы карточки
            просто резко "дёргались" на новый список. */}
        <div key={activeFilter} className="fade-in flex flex-col gap-5 pt-4 pb-4">
          {visibleProfiles.map((profile) => (
            <ProfileCard key={profile.quote} profile={profile} />
          ))}

          {/* Если анкет в выбранной категории нет — показываем понятное сообщение вместо пустоты */}
          {visibleProfiles.length === 0 && (
            <p className="text-center text-sm text-fly-gray py-10">
              Пока никого нет в категории «{activeFilterLabel}»
            </p>
          )}

          {/* Карточка-превью следующей анкеты показывается только в общем списке,
              потому что у неё нет своей категории для фильтрации */}
          {activeFilter === 'all' && (
            <div className="bg-white rounded-fly-lg shadow-[0_8px_30px_rgba(30,40,70,0.10)] h-14 flex items-center gap-3 px-4 text-[12.5px] font-medium text-fly-gray">
              <div className="w-9 h-9 rounded-fly-md flex-shrink-0 bg-gradient-to-br from-[#FFEDE8] to-[#FFCFC1]" />
              <span>29 лет · 165 см — читать дальше →</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
