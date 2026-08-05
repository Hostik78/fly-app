// Экран "Заблокированные" (открывается из Аккаунта) - список всех, кого
// пользователь заблокировал (см. useBlockedUsers.ts), с настоящим поиском/
// фильтром сверху (текст + диапазон возраста и роста) - список фильтруется
// прямо на месте, без похода в базу за каждым нажатием (людей в списке у
// одного человека обычно немного, гонять сеть ради этого не нужно).

import { useMemo, useState } from 'react'
import { useBlockedUsers } from '../lib/useBlockedUsers'
import { categories } from '../data/categories'
import { getAgeWord } from '../lib/pluralize'
import { Avatar } from './Avatar'
import { BackArrowIcon } from './icons'

interface BlockedAccountsScreenProps {
  currentUserId: string | undefined
  onBack: () => void
}

export function BlockedAccountsScreen({ currentUserId, onBack }: BlockedAccountsScreenProps) {
  const { blocked, loading, unblock } = useBlockedUsers(currentUserId)
  const [search, setSearch] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [heightMin, setHeightMin] = useState('')
  const [heightMax, setHeightMax] = useState('')
  const [unblockingId, setUnblockingId] = useState<string | null>(null)
  const [unblockError, setUnblockError] = useState<string | null>(null)

  // Пересчитывается только когда реально что-то поменялось (список или любое
  // из полей фильтра), а не на каждой перерисовке экрана.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const minAge = ageMin === '' ? undefined : Number(ageMin)
    const maxAge = ageMax === '' ? undefined : Number(ageMax)
    const minHeight = heightMin === '' ? undefined : Number(heightMin)
    const maxHeight = heightMax === '' ? undefined : Number(heightMax)

    return blocked.filter((profile) => {
      if (query) {
        const categoryLabel = categories.find((item) => item.id === profile.category)?.label ?? ''
        const haystack = `${profile.quote} ${categoryLabel} ${profile.languages ?? ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (minAge !== undefined && (profile.age === undefined || profile.age < minAge)) return false
      if (maxAge !== undefined && (profile.age === undefined || profile.age > maxAge)) return false
      if (minHeight !== undefined && (profile.height === undefined || profile.height < minHeight)) return false
      if (maxHeight !== undefined && (profile.height === undefined || profile.height > maxHeight)) return false
      return true
    })
  }, [blocked, search, ageMin, ageMax, heightMin, heightMax])

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

      {/* Фильтр показываем, только если вообще есть кого фильтровать - на
          пустом списке строка поиска и диапазоны были бы бесполезным мусором. */}
      {blocked.length > 0 && (
        <div className="flex-shrink-0 flex flex-col gap-2 px-5 pb-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по заметке, языкам..."
            className="bg-fly-fog rounded-fly-md px-4 py-2.5 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-accent"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-fly-gray flex-shrink-0 w-14">Возраст</span>
            <input
              type="number"
              inputMode="numeric"
              value={ageMin}
              onChange={(event) => setAgeMin(event.target.value)}
              placeholder="от"
              className="w-full min-w-0 bg-fly-fog rounded-fly-md px-3 py-2 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-accent"
            />
            <input
              type="number"
              inputMode="numeric"
              value={ageMax}
              onChange={(event) => setAgeMax(event.target.value)}
              placeholder="до"
              className="w-full min-w-0 bg-fly-fog rounded-fly-md px-3 py-2 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-fly-gray flex-shrink-0 w-14">Рост</span>
            <input
              type="number"
              inputMode="numeric"
              value={heightMin}
              onChange={(event) => setHeightMin(event.target.value)}
              placeholder="от"
              className="w-full min-w-0 bg-fly-fog rounded-fly-md px-3 py-2 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-accent"
            />
            <input
              type="number"
              inputMode="numeric"
              value={heightMax}
              onChange={(event) => setHeightMax(event.target.value)}
              placeholder="до"
              className="w-full min-w-0 bg-fly-fog rounded-fly-md px-3 py-2 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-accent"
            />
          </div>
        </div>
      )}

      {unblockError && <p className="text-xs text-fly-gray text-center px-6 pb-2">{unblockError}</p>}

      {loading ? (
        <p className="text-center text-sm text-fly-gray py-10">Загружаем…</p>
      ) : blocked.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-10 text-center">
          <p className="text-sm text-fly-gray leading-relaxed">Заблокированных пока нет.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-fly-gray py-10 px-6">Никого не нашлось по этим условиям.</p>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filtered.map((profile) => {
            const categoryLabel = categories.find((item) => item.id === profile.category)?.label ?? ''
            return (
              <div key={profile.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar userId={profile.id} gender={profile.gender} className="w-12 h-12 rounded-full flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-fly-ink">
                    {profile.age !== undefined && `${profile.age} ${getAgeWord(profile.age)}`}
                    {profile.age !== undefined && profile.height !== undefined && ', '}
                    {profile.height !== undefined && `${profile.height} см`}
                  </div>
                  <p className="text-xs text-fly-gray truncate">
                    {categoryLabel}
                    {profile.quote ? ` · ${profile.quote}` : ''}
                  </p>
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
