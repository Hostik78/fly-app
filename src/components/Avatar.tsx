import { useState } from 'react'
import { getAvatarUrl } from '../lib/avatar'
import { getGenderColor } from '../lib/genderColor'

interface AvatarProps {
  userId: string
  gender: 'male' | 'female' | undefined
  // Размер/скругление и т.п. задаёт вызывающий компонент (везде разный -
  // на карточке в ленте меньше, в шапке чата побольше) - тут только логика
  // "что показать", не конкретные размеры.
  className?: string
}

// Общая логика "фото или цветной кружок" - раньше в каждом из трёх мест
// (ProfileCard, MessagesScreen, ChatScreen) был просто цветной кружок по полу
// (см. genderColor.ts), теперь везде одинаково: настоящее фото, если человек
// его загрузил (см. avatar.ts - публичный бакет, путь по user_id), иначе тот
// же цветной кружок, что и был - <img onError>/<img onLoad> сами решают,
// какой вариант показать, отдельно спрашивать базу "есть ли фото" не нужно
// (см. AccountScreen.tsx, тот же приём для своего же фото).
//
// Цветной кружок - нижний слой и виден сразу же, без задержки. Настоящее фото
// (если оно есть) отдельным слоем поверх, невидимое, пока по-настоящему не
// подгрузится - и тогда плавно проявляется. Раньше сначала пытались показать
// только <img>, а цветной кружок появлялся лишь после неудачной попытки - то
// есть на месте кружка какое-то время было просто пусто.
export function Avatar({ userId, gender, className = '' }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`${className} relative overflow-hidden`}>
      <div className="absolute inset-0" style={{ backgroundColor: getGenderColor(gender) }} />
      {!broken && (
        <img
          src={getAvatarUrl(userId)}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          alt=""
          // loading="lazy" - стандартная браузерная подсказка "качай, только когда
          // картинка подъедет к видимой области экрана". В ленте бывает до полусотни
          // карточек сразу (см. лимит в get_feed_posts) - без этого браузер скачивал
          // бы все аватарки сразу при открытии ленты, даже те, что далеко за нижним
          // краем экрана, лишняя нагрузка на мобильный интернет. decoding="async" -
          // тоже стандартный атрибут: декодирование картинки не блокирует отрисовку
          // остального экрана.
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}
