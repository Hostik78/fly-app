import { useState } from 'react'
import { usePrivatePhoto } from '../lib/usePrivatePhoto'
import { getGenderColor } from '../lib/genderColor'

interface AvatarProps {
  userId: string
  gender: 'male' | 'female' | undefined
  // Размер/скругление и т.п. задаёт вызывающий компонент (везде разный -
  // на карточке в ленте меньше, в шапке чата побольше) - тут только логика
  // "что показать", не конкретные размеры.
  className?: string
}

// Единое защищённое фото для ленты, списка и переписки.
export function Avatar({ userId, gender, className = '' }: AvatarProps) {
  const photo = usePrivatePhoto(userId)
  const [broken, setBroken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`${className} relative overflow-hidden`}>
      <div className="absolute inset-0" style={{ backgroundColor: getGenderColor(gender) }} />
      {photo && broken !== photo && (
        <img
          src={photo}
          key={photo}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(photo)}
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
