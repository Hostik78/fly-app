import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Profile, ProfileCategory } from '../data/profiles'
import { categories } from '../data/categories'
import { hobbies, type HobbyId } from '../data/hobbies'
import { ProfileCard } from './ProfileCard'
import { MenuIcon } from './icons'
import type { AppOutletContext } from './AppShell'
import { useFeedProfiles } from '../lib/useFeedProfiles'
import { supabase } from '../lib/supabase'

// Одна запись фильтра: id - для сравнения в коде, label - что видит пользователь.
// 'all' не привязан ни к какой категории анкеты - это режим "показать всё".
interface FilterOption {
  id: ProfileCategory | 'all'
  label: string
}

// Полный список фильтров-таблеток над лентой: "Все" + общий список категорий
// (тот же самый, что используется при создании собственного статуса).
const filters: FilterOption[] = [{ id: 'all', label: 'Все' }, ...categories]

// Второй ряд фильтров - показывается только когда выбрана категория "Увлечения".
// "Все" здесь означает "любое хобби", а не "любая категория".
const hobbyFilters: { id: HobbyId | 'all'; label: string }[] = [{ id: 'all', label: 'Все' }, ...hobbies]

// Главный экран приложения — лента анкет.
// Собирает вместе шапку, фильтры, список карточек анкет и нижнюю навигацию.
//
// Важно про прокрутку: весь экран занимает ровно всю высоту телефона (h-full) и сам
// никогда не скроллится. Скроллится только средняя часть со списком карточек —
// шапка сверху и навигация снизу всегда остаются на месте, как в настоящих приложениях.
export function FeedScreen() {
  // currentUserId пришёл из AppShell через контекст маршрута - нужен, чтобы запросить
  // ленту без своей же собственной публикации.
  const { currentUserId, onlineUserIds } = useOutletContext<AppOutletContext>()
  const { profiles, loading, markLiked } = useFeedProfiles(currentUserId)

  // Сохраняет лайк в базу. ProfileCard сам показывает "лайкнуто" сразу (оптимистично)
  // и откатывает обратно, если это не получилось - здесь сам поход в базу и обновление
  // уже загруженного списка (markLiked), чтобы profile.likedByMe не был устаревшим при
  // пересборке карточек (например, при смене фильтра).
  async function handleLike(profile: Profile) {
    if (!currentUserId) return
    const { error } = await supabase.from('likes').insert({ liker_id: currentUserId, liked_id: profile.id })
    if (error) throw error
    markLiked(profile.id)
  }

  // Запоминаем, какой фильтр сейчас выбран. По умолчанию — "Все".
  const [activeFilter, setActiveFilter] = useState<FilterOption['id']>('all')
  // Хобби внутри категории "Увлечения". Отдельное состояние от activeFilter -
  // просто не используется (и не рендерится), если верхний фильтр не "hobbies".
  const [activeHobby, setActiveHobby] = useState<HobbyId | 'all'>('all')

  // Если выбрано "Все" — показываем все анкеты, иначе — только с нужной категорией.
  const categoryFilteredProfiles =
    activeFilter === 'all' ? profiles : profiles.filter((profile) => profile.category === activeFilter)

  // Дополнительно сужаем по конкретному хобби - но только внутри категории "Увлечения"
  // и только если выбрано конкретное хобби, а не "Все".
  const visibleProfiles =
    activeFilter === 'hobbies' && activeHobby !== 'all'
      ? categoryFilteredProfiles.filter((profile) => profile.hobby === activeHobby)
      : categoryFilteredProfiles

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
            Fl<span className="text-fly-coral">y</span>
          </div>
          <button className="w-[38px] h-[38px] rounded-fly-md bg-fly-fog flex items-center justify-center transition-colors hover:bg-fly-fog-strong">
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
                    : 'px-4 py-2 rounded-full text-xs font-medium bg-fly-fog text-fly-gray whitespace-nowrap flex-shrink-0 transition-colors hover:bg-fly-fog-strong hover:text-fly-ink'
                }
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        {/* Второй ряд - конкретные хобби, виден только внутри категории "Увлечения" */}
        {activeFilter === 'hobbies' && (
          <div className="flex gap-2 px-5 pt-2 overflow-x-auto no-scrollbar">
            {hobbyFilters.map((hobby) => {
              const isActive = hobby.id === activeHobby
              return (
                <button
                  key={hobby.id}
                  onClick={() => setActiveHobby(hobby.id)}
                  className={
                    isActive
                      ? 'px-3 py-1.5 rounded-full text-[11px] font-medium bg-fly-ink text-white whitespace-nowrap flex-shrink-0 transition-colors'
                      : 'px-3 py-1.5 rounded-full text-[11px] font-medium bg-fly-fog text-fly-gray whitespace-nowrap flex-shrink-0 transition-colors hover:bg-fly-fog-strong hover:text-fly-ink'
                  }
                >
                  {hobby.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Средняя часть — список карточек анкет. flex-1 - занимает всё оставшееся место
          между шапкой и навигацией. overflow-y-auto - именно тут работает прокрутка/свайп,
          и только тут. overscroll-contain - долистав до конца списка, страница дальше не
          "проваливается" никуда наружу. */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5">
        {loading ? (
          <p className="text-center text-sm text-fly-gray py-10">Загружаем ленту…</p>
        ) : (
          // key={activeFilter} заставляет React пересобрать этот блок при смене фильтра,
          // а класс fade-in проигрывает плавное появление — вместо того чтобы карточки
          // просто резко "дёргались" на новый список.
          <div key={activeFilter} className="fade-in flex flex-col gap-5 pt-4 pb-4">
            {visibleProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                online={onlineUserIds.has(profile.id)}
                onLike={handleLike}
              />
            ))}

            {/* Пусто из-за фильтра, но вообще люди в ленте есть */}
            {visibleProfiles.length === 0 && profiles.length > 0 && (
              <p className="text-center text-sm text-fly-gray py-10">
                Пока никого нет в категории «{activeFilterLabel}»
              </p>
            )}

            {/* Пусто вообще - ещё никто, кроме тебя, не публиковал заметку */}
            {profiles.length === 0 && (
              <p className="text-center text-sm text-fly-gray py-10">
                Пока никто не опубликовал заметку. Как только кто-то опубликует — увидите здесь.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
