import { useState } from 'react'
import type { Profile } from '../data/profiles'
import { DotsIcon, PersonIcon, RulerIcon, HeartIcon } from './icons'

// Компонент — это кусочек интерфейса, который можно переиспользовать.
// Этот компонент рисует одну карточку анкеты в ленте.
// Данные анкеты (текст, возраст и т.д.) приходят снаружи через "profile",
// а вот отметку "лайкнул/не лайкнул" карточка запоминает сама — это её личное состояние.
interface ProfileCardProps {
  profile: Profile
  // Вызывается только когда карточку ЛАЙКНУЛИ (не при снятии лайка) - нужно,
  // чтобы наверху (в App.tsx) можно было проверить, не совпадение ли это.
  onLike?: (profile: Profile) => void
}

export function ProfileCard({ profile, onLike }: ProfileCardProps) {
  // liked - отметил ли пользователь эту анкету лайком. По умолчанию - нет.
  const [liked, setLiked] = useState(false)
  // Выбираем цвет "фото"-плашки в зависимости от пола анкеты
  // (пока вместо настоящих фото — просто цветной градиент-заглушка)
  const artBackground =
    profile.gender === 'female'
      ? 'bg-gradient-to-br from-[#FFEDE8] to-[#FFCFC1]' // тёплый градиент для женской анкеты
      : 'bg-gradient-to-br from-[#E4F2FD] to-[#BFE0F9]' // холодный градиент для мужской анкеты

  // Буква на цветном значке пола: Ж — женский, М — мужской
  const genderLetter = profile.gender === 'female' ? 'Ж' : 'М'
  const genderBadgeColor = profile.gender === 'female' ? 'bg-fly-coral' : 'bg-fly-blue-deep'

  return (
    // Сама карточка: белый фон, скруглённые углы, тень вместо рамки-линии
    <div className="bg-white rounded-fly-lg shadow-[0_8px_30px_rgba(30,40,70,0.10)] overflow-hidden">

      {/* Верхняя строка карточки: значки "Онлайн"/"New" слева, кнопка-меню справа */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex gap-1.5">
          {profile.online && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-full bg-fly-tint-blue text-fly-blue-deep">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3CCB7F]" />
              Онлайн
            </span>
          )}
          {profile.isNew && (
            <span className="text-[10px] font-semibold px-2.5 py-1.5 rounded-full bg-[#EEF9F1] text-[#2FAE5E]">
              New
            </span>
          )}
        </div>
        <div className="w-7 h-7 flex items-center justify-center">
          <DotsIcon />
        </div>
      </div>

      {/* Цветной блок вместо фото — заглушка с буквой пола в углу */}
      <div className={`relative mx-4 mt-4 h-[200px] rounded-fly-md overflow-hidden ${artBackground}`}>
        <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1.5 rounded-full text-white ${genderBadgeColor}`}>
          {genderLetter}
        </span>
      </div>

      {/* Текстовая часть карточки: фраза анкеты и короткая информация о человеке */}
      <div className="px-4 pb-4">
        <p className="text-base leading-relaxed text-fly-ink mt-4">{profile.quote}</p>

        {/* Строка с возрастом, ростом и языками */}
        <div className="flex items-center gap-4 mt-4 pt-4 text-xs font-medium text-fly-gray">
          <span className="flex items-center gap-1">
            <PersonIcon />
            <b className="text-fly-ink font-semibold">{profile.age}</b> {profile.ageWord}
          </span>
          <span className="flex items-center gap-1">
            <RulerIcon />
            <b className="text-fly-ink font-semibold">{profile.height}</b> см
          </span>
          <span>{profile.languages}</span>
        </div>

        {/* Кнопка "лайк" в правом нижнем углу карточки.
            При клике переключаем liked туда-обратно и слегка увеличиваем кнопку - для приятной отдачи.
            onLike вызываем только когда лайк ПОЯВЛЯЕТСЯ (не при снятии) - иначе "совпадение"
            срабатывало бы повторно при каждом случайном клике туда-обратно. */}
        <div className="flex justify-end mt-3">
          <button
            onClick={() =>
              setLiked((wasLiked) => {
                const nowLiked = !wasLiked
                if (nowLiked) onLike?.(profile)
                return nowLiked
              })
            }
            className={`w-11 h-11 rounded-fly-md flex items-center justify-center transition-transform duration-200 active:scale-90 hover:scale-105 ${
              liked ? 'bg-fly-coral scale-110' : 'bg-fly-tint-coral scale-100'
            }`}
          >
            <HeartIcon filled={liked} />
          </button>
        </div>
      </div>
    </div>
  )
}
