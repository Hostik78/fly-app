// Список показывает только собственные записи о блокировках. Мы намеренно
// не загружаем фото, заметку, возраст или другие живые данные этих людей.
import { useState } from 'react'
import { useBlockedUsers } from '../lib/useBlockedUsers'
import { BackArrowIcon } from './icons'
import { LoadErrorState } from './LoadErrorState'
interface BlockedAccountsScreenProps { currentUserId: string | undefined; onBack: () => void }
export function BlockedAccountsScreen({ currentUserId, onBack }: BlockedAccountsScreenProps) {
  const { blocked, loading, error, retry, unblock } = useBlockedUsers(currentUserId)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)
  const [unblockError, setUnblockError] = useState<string | null>(null)

  async function handleUnblock(userId: string) {
    setUnblockingId(userId)
    setUnblockError(null)
    try {
      await unblock(userId)
    } catch {
      // Раньше ошибка тут никак не показывалась - кнопка на миг мигала "…" и
      // возвращалась в исходное состояние, человек не понимал бы, сработало
      // разблокирование или нет.
      setUnblockError('Не получилось разблокировать. Попробуйте ещё раз.')
    } finally {
      setUnblockingId(null)
    }
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onBack}
          className="w-11 h-11 -ml-1.5 flex items-center justify-center text-fly-ink flex-shrink-0"
        >
          <BackArrowIcon />
        </button>
        <h1 className="text-xl font-semibold text-fly-ink">Заблокированные</h1>
      </div>

      {unblockError && <p className="text-xs text-fly-gray text-center px-6 pb-2">{unblockError}</p>}

      {loading ? (
        // Пусто, без текста "Загружаем..." - см. тот же приём в FeedScreen.tsx.
        <div className="flex-1" />
      ) : error ? (
        <div className="flex-1">
          <LoadErrorState onRetry={retry} />
        </div>
      ) : blocked.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-10 text-center">
          <p className="text-sm text-fly-gray leading-relaxed">Заблокированных пока нет.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {blocked.map((profile) => {
            return (
              <div key={profile.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fly-ink">Заблокированный аккаунт · {profile.id.slice(-8)}</p>
                  <p className="text-xs text-fly-gray">Анкета и фото скрыты</p>
                </div>
                <button
                  type="button"
                  disabled={unblockingId === profile.id}
                  onClick={() => handleUnblock(profile.id)}
                  className="flex-shrink-0 text-xs font-semibold text-fly-accent px-3 py-2 rounded-fly-md bg-fly-tint-accent transition-opacity disabled:opacity-50"
                >
                  {unblockingId === profile.id ? '…' : 'Разблокировать'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
