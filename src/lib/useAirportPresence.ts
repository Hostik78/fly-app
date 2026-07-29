// Хук, который проверяет, находится ли человек рядом с аэропортом (см.
// src/data/airport.ts) - через встроенный в браузер geolocation API (тот же,
// которым пользуются карты и погодные сайты, писать свой не нужно). Проверка
// одноразовая при каждом вызове retry() - не следит за местоположением
// постоянно, пока экран открыт (тот же принцип "проверяем при открытии", что
// уже выбран для ленты/совпадений в этом проекте).

import { useEffect, useState } from 'react'
import { getDistanceKm } from './geo'
import { AIRPORT } from '../data/airport'

export type AirportPresenceStatus =
  | 'checking'
  | 'at-airport'
  | 'not-at-airport'
  | 'permission-denied'
  | 'unsupported'
  | 'error'

export function useAirportPresence(): {
  status: AirportPresenceStatus
  distanceKm: number | null
  retry: () => void
} {
  const [status, setStatus] = useState<AirportPresenceStatus>('checking')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus('checking')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = getDistanceKm(
          position.coords.latitude,
          position.coords.longitude,
          AIRPORT.latitude,
          AIRPORT.longitude,
        )
        setDistanceKm(distance)
        setStatus(distance <= AIRPORT.radiusKm ? 'at-airport' : 'not-at-airport')
      },
      (positionError) => {
        setStatus(positionError.code === positionError.PERMISSION_DENIED ? 'permission-denied' : 'error')
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }, [attempt])

  return { status, distanceKm, retry: () => setAttempt((current) => current + 1) }
}
