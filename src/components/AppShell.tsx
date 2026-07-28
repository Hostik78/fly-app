import { NavLink, Outlet } from 'react-router-dom'
import { GridIcon, MessageIcon, AccountIcon } from './icons'
import type { Profile } from '../data/profiles'

// Общие данные и функции, которые должны быть видны и Ленте, и Сообщениям одновременно
// (иначе лайк на Ленте никак не мог бы "долететь" до списка переписок).
// React Router передаёт это вниз через <Outlet context={...} />, а каждый экран
// достаёт нужное через хук useOutletContext<AppOutletContext>().
export interface AppOutletContext {
  matches: Profile[] // с кем уже "совпали" (взаимный лайк)
  onLike: (profile: Profile) => void // вызывается, когда поставили лайк на Ленте
  currentUserId: string // свой user_id - нужен ленте, чтобы не показывать свою же публикацию
}

interface AppShellProps {
  matches: Profile[]
  onLike: (profile: Profile) => void
  currentUserId: string
}

// AppShell — общая "рамка" вокруг ЛЮБОГО экрана приложения: строка статуса телефона
// сверху и нижняя навигация всегда на месте, а между ними — <Outlet /> (это специальное
// место из React Router, куда подставляется нужный экран в зависимости от того,
// какая вкладка выбрана: Лента / Сообщения / Аккаунт).
export function AppShell({ matches, onLike, currentUserId }: AppShellProps) {
  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      {/* Имитация строки статуса телефона: время и код аэропорта (для атмосферы) */}
      <div className="flex-shrink-0 h-11 flex items-end justify-between px-5 pb-2 text-xs text-fly-gray">
        <span>9:41</span>
        <span>SVO</span>
      </div>

      {/* Сюда React Router подставляет текущий экран (Лента/Сообщения/Аккаунт).
          context передаёт matches/onLike вниз, не проходя их через пропсы каждого маршрута. */}
      <div className="flex-1 overflow-hidden">
        <Outlet context={{ matches, onLike, currentUserId } satisfies AppOutletContext} />
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
