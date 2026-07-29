import { useState } from 'react'
import type { Profile } from '../data/profiles'
import { getAgeWord } from '../lib/pluralize'
import { categories } from '../data/categories'
import { hobbies } from '../data/hobbies'
import { DotsIcon, HeartIcon } from './icons'

// Компонент — это кусочек интерфейса, который можно переиспользовать.
// Этот компонент рисует одну карточку анкеты в ленте.
//
// Дизайн - "бирка на чемодан": цветная полоска слева (вместо фото-плашки с
// буквой пола), крупная жирная фраза как заголовок, данные - отдельными
// "таблетками". Выбран из трёх макетов-вариантов (см. docs/superpowers) как
// самый близкий к тому, что этот проект - "среднее между сайтом знакомств
// и социальной сетью", а не типичный дейтинг-сайт.
interface ProfileCardProps {
  profile: Profile
  // Вызывается при лайке - сохраняет его в базу (см. FeedScreen.tsx). Асинхронная -
  // если не получилось (нет сети), кнопка визуально откатывается обратно (см. ниже).
  // Не передана - кнопки лайка вообще нет (так для карточек в "Сообщениях").
  onLike?: (profile: Profile) => Promise<void>
}

export function ProfileCard({ profile, onLike }: ProfileCardProps) {
  // liked - отметил ли пользователь эту анкету лайком. Берём из уже сохранённого
  // состояния (profile.likedByMe), а не всегда "нет" - иначе при повторном заходе
  // в ленту можно было бы по ошибке попробовать лайкнуть того же человека ещё раз.
  const [liked, setLiked] = useState(profile.likedByMe)

  // Цвет полоски слева зависит от пола. Пол необязательный - если не указан,
  // нейтральный серый вместо тёплого/холодного цвета (не выдумываем).
  const stripeColor = profile.gender === 'female' ? '#FF6B57' : profile.gender === 'male' ? '#2E7BC4' : '#A3ACBA'

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
    <div
      className="relative bg-white rounded-fly-lg shadow-[0_8px_30px_rgba(30,40,70,0.10)] pl-5 pr-4 py-4"
      style={{ borderLeft: `6px solid ${stripeColor}` }}
    >
      {/* "Дырка" от бирки - декоративный кружок на полоске, как на настоящей бирке чемодана */}
      <span
        className="absolute top-4 -left-[9px] w-4 h-4 rounded-full bg-white"
        style={{ border: `2px solid ${stripeColor}` }}
      />

      {/* Верхняя строка: категория (+хобби, если есть) слева, кнопка-меню справа */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span
          className="text-[10.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ backgroundColor: `${stripeColor}1A`, color: stripeColor }}
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
            <span className="text-xs font-semibold text-fly-ink bg-[#F4F5F8] px-2.5 py-1 rounded-full">
              {profile.age} {getAgeWord(profile.age)}
            </span>
          )}
          {profile.height !== undefined && (
            <span className="text-xs font-semibold text-fly-ink bg-[#F4F5F8] px-2.5 py-1 rounded-full">
              {profile.height} см
            </span>
          )}
          {profile.languages !== undefined && (
            <span className="text-xs font-semibold text-fly-ink bg-[#F4F5F8] px-2.5 py-1 rounded-full">
              {profile.languages}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center mt-3.5">
        {profile.online && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-fly-gray">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3CCB7F]" />
            Онлайн
          </span>
        )}

        {/* Кнопка "лайк" — только если onLike передан (см. комментарий у пропса выше).
            ml-auto прижимает её вправо независимо от того, есть ли значок "Онлайн" слева. */}
        {onLike && (
          <button
            onClick={handleLikeClick}
            className={`ml-auto w-10 h-10 rounded-fly-md flex items-center justify-center transition-transform duration-200 active:scale-90 hover:scale-105 ${
              liked ? 'bg-fly-coral scale-110' : 'bg-fly-tint-coral scale-100'
            }`}
          >
            <HeartIcon filled={liked} />
          </button>
        )}
      </div>
    </div>
  )
}
