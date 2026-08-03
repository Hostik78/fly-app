import type { Profile } from '../data/profiles'
import { ProfileCard } from './ProfileCard'
import { CloseIcon } from './icons'

interface ProfileDetailSheetProps {
  profile: Profile
  online: boolean
  onClose: () => void
}

// Всплывающая карточка анкеты поверх экрана переписки - открывается кликом по
// аватару/имени в шапке ChatScreen.tsx, чтобы освежить в памяти, с кем идёт
// разговор, не выходя из чата. Переиспользует ту же ProfileCard, что и в
// ленте (см. её комментарий) - без кнопки лайка (onLike не передан): лайк уже
// случился, иначе бы не было самого чата.
export function ProfileDetailSheet({ profile, online, onClose }: ProfileDetailSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Затемнение фона - клик мимо карточки закрывает её же кнопкой onClose */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Обёртка снизу экрана - safe-area-bottom нужен (нижний край реального
          телефона), safe-area-top не нужен (шторка не подходит к самому верху) */}
      <div className="relative w-full max-w-[480px] pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-4 pt-16">
        <ProfileCard profile={profile} online={online} />
        {/* Кнопка закрытия - ПОСЛЕ карточки в разметке (значит, поверх нее при
            наложении), с запасом (-mt на самой карточке нет места под неё,
            поэтому кнопка чуть выше самой карточки, не перекрывает её
            собственную кнопку-меню в углу). */}
        <button
          onClick={onClose}
          className="absolute right-6 top-3 w-10 h-10 rounded-full bg-fly-glass-solid backdrop-blur-fly-glass border border-fly-glass-border flex items-center justify-center text-fly-ink"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
