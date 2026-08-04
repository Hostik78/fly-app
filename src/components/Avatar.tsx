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
// же цветной кружок, что и был - <img onError> сам решает, какой вариант
// показать, отдельно спрашивать базу "есть ли фото" не нужно (см. AccountScreen.tsx,
// тот же приём для своего же фото).
export function Avatar({ userId, gender, className = '' }: AvatarProps) {
  const [broken, setBroken] = useState(false)

  if (broken) {
    return <div className={className} style={{ backgroundColor: getGenderColor(gender) }} />
  }

  return (
    <img
      src={getAvatarUrl(userId)}
      onError={() => setBroken(true)}
      alt=""
      className={`${className} object-cover`}
    />
  )
}
