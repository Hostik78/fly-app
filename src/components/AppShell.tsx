import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { GridIcon, MessageIcon, AccountIcon } from './icons'
import { useOnlinePresence } from '../lib/useOnlinePresence'

// currentUserId - id, который должен быть виден любому экрану внутри AppShell.
// onlineUserIds - кто из ВСЕХ пользователей сейчас в сети (см. useOnlinePresence.ts) -
// подключается один раз здесь, а не в каждом экране отдельно, чтобы не открывать
// несколько одинаковых realtime-каналов на одного и того же человека.
export interface AppOutletContext {
  currentUserId: string
  onlineUserIds: Set<string>
}

interface AppShellProps {
  currentUserId: string
}

// AppShell — общая "рамка" вокруг ЛЮБОГО экрана приложения: строка статуса телефона
// сверху и нижняя навигация всегда на месте, а между ними — <Outlet /> (это специальное
// место из React Router, куда подставляется нужный экран в зависимости от того,
// какая вкладка выбрана: Лента / Сообщения / Аккаунт).
export function AppShell({ currentUserId }: AppShellProps) {
  const onlineUserIds = useOnlinePresence(currentUserId)

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      {/* Имитация строки статуса телефона: время и код аэропорта (для атмосферы) */}
      <div className="flex-shrink-0 h-11 flex items-end justify-between px-5 pb-2 text-xs text-fly-gray">
        <span>9:41</span>
        <span>SVO</span>
      </div>

      {/* Сюда React Router подставляет текущий экран (Лента/Сообщения/Аккаунт).
          context передаёт currentUserId вниз, не проходя его через пропсы каждого маршрута.
          Suspense - именно здесь, а не выше по дереву (в App.tsx): AccountScreen грузится
          отдельным кусочком кода (lazy, см. App.tsx) - если бы граница ожидания стояла
          выше, на время его догрузки пропадала бы вообще вся навигация ниже (строка
          статуса и нижние вкладки), а не только сама вкладка. */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="h-full w-full bg-white" />}>
          <Outlet context={{ currentUserId, onlineUserIds } satisfies AppOutletContext} />
        </Suspense>
      </div>

      {/* Нижняя навигация — не скроллится и не сжимается, всегда видна.
          NavLink сам подсвечивает активную вкладку и переключает экран по клику. */}
      <nav className="flex-shrink-0 flex justify-around items-center px-5 pt-4 pb-6 bg-white">
        <NavLink to="/" end className={navLinkClass}>
          <GridIcon />
          Лента
        </NavLink>
        <NavLink to="/messages" className={navLinkClass}>
          <MessageIcon />
          Сообщения
        </NavLink>
        <NavLink to="/account" className={navLinkClass}>
          <AccountIcon />
          Аккаунт
        </NavLink>
      </nav>
    </div>
  )
}

// Общий вид ссылки нижней навигации: активная вкладка тёмная, остальные - серые с hover
function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
    isActive ? 'text-fly-ink' : 'text-fly-gray hover:text-fly-ink'
  }`
}
