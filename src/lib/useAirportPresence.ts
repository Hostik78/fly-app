// Хук, который проверяет, находится ли человек рядом с аэропортом (см.
// src/data/airport.ts) - через встроенный в браузер geolocation API (тот же,
// которым пользуются карты и погодные сайты, писать свой не нужно). Проверка
// одноразовая при каждом вызове retry() - не следит за местоположением
// постоянно, пока экран открыт (тот же принцип "проверяем при открытии", что
// уже выбран для ленты/совпадений в этом проекте).

import { useEffect, useState } from 'react'
import { getDistanceKm } from './geo'
import { AIRPORT } from '../data/airport'
import { supabase } from './supabase'

export type AirportPresenceStatus =
  | 'checking'
  | 'at-airport'
  | 'test-access'
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
    let cancelled = false
    setStatus('checking')
    setDistanceKm(null)

    async function checkAccessThenLocation() {
      // Проверку срока выполняет наш сервер своими часами. При любой сетевой
      // ошибке не открываем тестовый режим, а переходим к обычной геолокации.
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      let testAccess = false
      if (token) {
        try {
          const response = await fetch('/api/test-access', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (response.ok) {
            const result = await response.json() as { allowed?: unknown }
            testAccess = result.allowed === true
          }
        } catch {
          // Недоступность проверки не должна ломать стандартную геолокацию.
        }
      }
      if (cancelled) return
      if (testAccess) {
        setStatus('test-access')
        return
      }

      // Для всех обычных пользователей остаётся прежняя настоящая геолокация.
      if (!('geolocation' in navigator)) {
        setStatus('unsupported')
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return
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
          if (cancelled) return
          setStatus(positionError.code === positionError.PERMISSION_DENIED ? 'permission-denied' : 'error')
        },
        { enableHighAccuracy: true, timeout: 15000 },
      )
    }

    void checkAccessThenLocation()
    return () => {
      cancelled = true
    }
  }, [attempt])

  return { status, distanceKm, retry: () => setAttempt((current) => current + 1) }
}
