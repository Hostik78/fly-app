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

      <div
        className="relative w-full max-w-[480px] pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-4"
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
      >
        <button
          onClick={onClose}
          className="absolute right-6 w-9 h-9 rounded-full bg-fly-glass-solid flex items-center justify-center text-fly-ink"
          style={{ top: 'calc(1.5rem + env(safe-area-inset-top) - 2px)' }}
        >
          <CloseIcon />
        </button>
        <ProfileCard profile={profile} online={online} />
      </div>
    </div>
  )
}
