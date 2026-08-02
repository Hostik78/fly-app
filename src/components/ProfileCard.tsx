import { useState } from 'react'
import type { Profile } from '../data/profiles'
import { getAgeWord } from '../lib/pluralize'
import { categories } from '../data/categories'
import { hobbies } from '../data/hobbies'
import { getGenderColor } from '../lib/genderColor'
import { DotsIcon, HeartIcon } from './icons'

// Компонент — это кусочек интерфейса, который можно переиспользовать.
// Этот компонент рисует одну карточку анкеты в ленте.
//
// Дизайн "Живой" (выбран из трёх показанных вариантов, вдохновлён редизайном
// приложения Pure): один угол карточки заметно круглее остальных - эффект
// стикера, а не строгой геометрической фигуры. Цвет по полу (см. getGenderColor)
// сохранён с прошлой версии дизайна ("бирка на чемодан") - только раньше он был
// тонкой полоской слева, теперь это заливка целого "ярлычка" сверху карточки.
interface ProfileCardProps {
  profile: Profile
  // Человек сейчас в сети - НЕ часть profile, потому что это не свойство самой
  // анкеты (та грузится один раз и не меняется поминутно), а постоянно живое
  // состояние "прямо сейчас" (см. useOnlinePresence.ts). Не передано - считаем,
  // что не в сети (не отправлять лишний запрос ради того, чего экран не показывает).
  online?: boolean
  // Вызывается при лайке - сохраняет его в базу (см. FeedScreen.tsx). Асинхронная -
  // если не получилось (нет сети), кнопка визуально откатывается обратно (см. ниже).
  // Не передана - кнопки лайка вообще нет (так для карточек в "Сообщениях").
  onLike?: (profile: Profile) => Promise<void>
}

export function ProfileCard({ profile, online = false, onLike }: ProfileCardProps) {
  // liked - отметил ли пользователь эту анкету лайком. Берём из уже сохранённого
  // состояния (profile.likedByMe), а не всегда "нет" - иначе при повторном заходе
  // в ленту можно было бы по ошибке попробовать лайкнуть того же человека ещё раз.
  const [liked, setLiked] = useState(profile.likedByMe)

  // Цвет полоски слева зависит от пола. Пол необязательный - если не указан,
  // нейтральный серый вместо тёплого/холодного цвета (не выдумываем).
  const stripeColor = getGenderColor(profile.gender)

  const categoryLabel = categories.find((item) => item.id === profile.category)?.label ?? ''
  const hobbyLabel = profile.hobby ? hobbies.find((item) => item.id === profile.hobby)?.label : undefined

  // Строка с данными рисуется целиком, только если есть хоть что-то - иначе
  // получился бы пустой ряд с отступами и без содержимого.
  const hasInfoLine = profile.age !== undefined || profile.height !== undefined || profile.languages !== undefined

  async function handleLikeClick() {
    // Уже лайкнули раньше - повторно ничего не отправляем.
    if (liked || !onLike) return
    setLiked(true)
    try {
      await onLike(profile)
    } catch {
      // Не сохранилось (например, нет сети) - откатываем обратно, без
      // отдельного текста ошибки (кнопка в списке карточек - не форма).
      setLiked(false)
    }
  }

  return (
    <div className="relative bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border rounded-fly-glass shadow-[0_8px_24px_rgba(60,80,120,0.12)] pl-5 pr-4 py-4">
      {/* Верхняя строка: категория (+хобби, если есть) слева, кнопка-меню справа.
          Заливка ярлычка - сплошной цвет по полу (не светлый оттенок с цветным текстом,
          как было раньше) - это и есть "живой", более смелый язык этого направления. */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span
          className="text-[10.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap text-white"
          style={{ backgroundColor: stripeColor }}
        >
          {profile.isNew && 'New · '}
          {categoryLabel}
          {hobbyLabel ? ` · ${hobbyLabel}` : ''}
        </span>
        <div className="w-6 h-6 flex items-center justify-center text-fly-gray flex-shrink-0">
          <DotsIcon />
        </div>
      </div>

      {/* Фраза анкеты - крупный жирный заголовок, а не мелкий обычный текст */}
      <p className="text-lg font-extrabold leading-snug text-fly-ink tracking-tight">{profile.quote}</p>

      {hasInfoLine && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.age !== undefined && (
            <span className="text-xs font-semibold text-fly-ink bg-fly-fog px-2.5 py-1 rounded-full">
              {profile.age} {getAgeWord(profile.age)}
            </span>
          )}
          {profile.height !== undefined && (
            <span className="text-xs font-semibold text-fly-ink bg-fly-fog px-2.5 py-1 rounded-full">
              {profile.height} см
            </span>
          )}
          {profile.languages !== undefined && (
            <span className="text-xs font-semibold text-fly-ink bg-fly-fog px-2.5 py-1 rounded-full">
              {profile.languages}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center mt-3.5">
        {online && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-fly-gray">
            <span className="w-1.5 h-1.5 rounded-full bg-fly-online" />
            Онлайн
          </span>
        )}

        {/* Кнопка "лайк" — только если onLike передан (см. комментарий у пропса выше).
            ml-auto прижимает её вправо независимо от того, есть ли значок "Онлайн" слева.
            w-11 h-11 (44px) - минимальный удобный размер под палец (было 40px).
            Обычный плавный отклик (ease-out, без "перелёта") - в "Стекле" (в отличие
            от прошлого "Живого") движение спокойное, без пружинного отскока -
            это часть самого направления, не только цвета/прозрачность. */}
        {onLike && (
          <button
            onClick={handleLikeClick}
            className={`ml-auto w-11 h-11 rounded-fly-md flex items-center justify-center transition-transform duration-300 ease-out active:scale-90 hover:scale-105 ${
              liked ? 'bg-fly-accent scale-110' : 'bg-fly-tint-accent scale-100'
            }`}
          >
            <HeartIcon filled={liked} />
          </button>
        )}
      </div>
    </div>
  )
}
