// Экран "не в аэропорту" - показывается вместо ленты/первой публикации, если
// проверка геолокации (см. useAirportPresence.ts) не подтвердила, что человек
// сейчас в Шереметьево. Полноэкранный вид, по образцу LoginScreen.tsx - без
// строки статуса и нижней навигации.

import { AIRPORT } from '../data/airport'
import type { AirportPresenceStatus } from '../lib/useAirportPresence'

interface NotAtAirportScreenProps {
  status: AirportPresenceStatus
  distanceKm: number | null
  onRetry: () => void
}

export function NotAtAirportScreen({ status, distanceKm, onRetry }: NotAtAirportScreenProps) {
  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center"
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="text-2xl font-semibold">
        Fl<span className="text-fly-accent">y</span>
      </div>
      <p className="text-sm text-fly-gray leading-relaxed">{getText(status, distanceKm)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="w-full max-w-xs py-3.5 rounded-fly-md bg-fly-solid text-fly-solid-text font-semibold text-sm"
      >
        Проверить снова
      </button>
    </div>
  )
}

function getText(status: AirportPresenceStatus, distanceKm: number | null): string {
  if (status === 'permission-denied') {
    return 'Нужен доступ к местоположению, чтобы проверить, что вы в аэропорту. Разрешите его в настройках сайта в браузере и попробуйте снова.'
  }
  if (status === 'unsupported') {
    return 'Ваш браузер не поддерживает определение местоположения, а без него нельзя проверить, что вы в аэропорту.'
  }
  if (status === 'not-at-airport') {
    const distanceText =
      distanceKm !== null ? ` Судя по всему, вы примерно в ${Math.round(distanceKm)} км от него.` : ''
    return `Это приложение работает только в аэропорту ${AIRPORT.name} (${AIRPORT.code}).${distanceText}`
  }
  return 'Не получилось определить местоположение. Проверьте подключение к интернету и попробуйте снова.'
}
