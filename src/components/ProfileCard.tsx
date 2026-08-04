import { useEffect, useRef, useState } from 'react'
import type { Profile } from '../data/profiles'
import { getAgeWord } from '../lib/pluralize'
import { categories } from '../data/categories'
import { hobbies } from '../data/hobbies'
import { getGenderColor } from '../lib/genderColor'
import { DotsIcon, HeartIcon } from './icons'
import { Avatar } from './Avatar'

// Компонент — это кусочек интерфейса, который можно переиспользовать.
// Этот компонент рисует одну карточку анкеты в ленте.
//
// Дизайн "Стекло" (см. docs/superpowers/specs/2026-08-02-glass-redesign-design.md):
// полупрозрачный фон с размытием вместо плоского белого, ровный радиус углов
// (см. rounded-fly-glass) вместо асимметричного "стикера" прошлого направления
// "Живой". Цвет по полу (см. getGenderColor) - заливка целого "ярлычка" сверху
// карточки, эта часть между направлениями не менялась.
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
  // "Скрыть анкету" - меню "⋯" в углу карточки. Не передана - "⋯" рисуется как
  // раньше, просто иконкой без действия (так в ProfileDetailSheet.tsx: скрывать
  // из ленты уже совпавшего с тобой человека не имеет смысла).
  onHide?: (profile: Profile) => Promise<void>
  // "Заблокировать" - более серьёзное действие, чем "Скрыть анкету": прячет
  // человека взаимно (ни я его, ни он меня) и запрещает переписку на уровне
  // базы (см. useFeedProfiles.ts/useMatches.ts). В отличие от onHide, эта
  // кнопка нужна и в ProfileDetailSheet.tsx (в чате) - заблокировать того,
  // с кем уже есть совпадение, самый частый настоящий случай использования.
  onBlock?: (profile: Profile) => Promise<void>
}

export function ProfileCard({ profile, online = false, onLike, onHide, onBlock }: ProfileCardProps) {
  // liked - отметил ли пользователь эту анкету лайком. Берём из уже сохранённого
  // состояния (profile.likedByMe), а не всегда "нет" - иначе при повторном заходе
  // в ленту можно было бы по ошибке попробовать лайкнуть того же человека ещё раз.
  const [liked, setLiked] = useState(profile.likedByMe)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Закрыть меню "⋯" кликом мимо него - стандартное поведение выпадающих
  // меню, слушатель висит только пока меню реально открыто.
  useEffect(() => {
    if (!menuOpen) return
    // pointerdown, не mousedown - на телефоне (основная платформа приложения)
    // это то же самое событие что для мыши, что для касания, без задержки/
    // квирков синтетических mouse-событий после тапа.
    function handleClickOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [menuOpen])

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

  async function handleHideClick() {
    if (!onHide || hiding) return
    setHiding(true)
    try {
      await onHide(profile)
      // Успех - карточка обычно тут же исчезает из списка у родителя
      // (см. hideProfile в useFeedProfiles.ts), сам компонент размонтируется -
      // закрывать меню/сбрасывать hiding отдельно не нужно.
    } catch {
      setHiding(false)
      setMenuOpen(false)
    }
  }

  async function handleBlockClick() {
    if (!onBlock || blocking) return
    setBlocking(true)
    try {
      await onBlock(profile)
      // Успех - так же, как и с onHide выше, родитель убирает карточку/закрывает
      // экран сам (см. blockProfile в useFeedProfiles.ts, blockMatch в useMatches.ts).
    } catch {
      setBlocking(false)
      setMenuOpen(false)
    }
  }

  return (
    <div className="relative bg-fly-glass backdrop-blur-fly-glass border border-fly-glass-border rounded-fly-glass shadow-[0_8px_24px_rgba(60,80,120,0.12)] pl-5 pr-4 py-4">
      {/* Верхняя строка: маленький кружок-фото (см. Avatar.tsx - настоящее фото,
          если человек его загрузил в Аккаунте, иначе тот же цветной кружок по
          полу, что был и раньше) + категория (+хобби, если есть) слева, кнопка-меню
          справа. Заливка ярлычка - сплошной цвет по полу (не светлый оттенок с
          цветным текстом, как было раньше) - общая деталь, не привязанная к
          конкретному направлению дизайна (см. более общий комментарий выше у
          самого компонента). */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar userId={profile.id} gender={profile.gender} className="w-8 h-8 rounded-full flex-shrink-0" />
          <span
            className="text-[10.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap text-white"
            style={{ backgroundColor: stripeColor }}
          >
            {profile.isNew && 'New · '}
            {categoryLabel}
            {hobbyLabel ? ` · ${hobbyLabel}` : ''}
          </span>
        </div>
        {/* "⋯" - раньше была просто нарисованной иконкой без действия по клику
            (мёртвая кнопка). Теперь, если передан onHide и/или onBlock (см. пропсы
            выше) - настоящая кнопка с меню из соответствующих пунктов. "Заблокировать"
            отдельным цветом (fly-danger) - это необратимее и серьёзнее, чем "Скрыть". */}
        {onHide || onBlock ? (
          <div ref={menuRef} className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="w-8 h-8 -mr-1 flex items-center justify-center text-fly-gray"
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-10 bg-fly-glass-solid backdrop-blur-fly-glass border border-fly-glass-border rounded-fly-md shadow-[0_8px_24px_rgba(60,80,120,0.18)] overflow-hidden">
                {onHide && (
                  <button
                    onClick={handleHideClick}
                    disabled={hiding}
                    className="text-left text-sm text-fly-ink px-4 py-2.5 whitespace-nowrap hover:bg-fly-fog transition-colors disabled:opacity-50"
                  >
                    {hiding ? 'Скрываем…' : 'Скрыть анкету'}
                  </button>
                )}
                {onBlock && (
                  <button
                    onClick={handleBlockClick}
                    disabled={blocking}
                    className="text-left text-sm text-fly-danger px-4 py-2.5 whitespace-nowrap hover:bg-fly-tint-danger transition-colors disabled:opacity-50"
                  >
                    {blocking ? 'Блокируем…' : 'Заблокировать'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="w-6 h-6 flex items-center justify-center text-fly-gray flex-shrink-0">
            <DotsIcon />
          </div>
        )}
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
