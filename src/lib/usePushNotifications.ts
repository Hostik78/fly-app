// Подписка на push-уведомления (Web Push - стандартный платформенный API браузера,
// см. CLAUDE.md - "используй стандартные платформенные API", а не рисуй уведомления
// сами). Как это выглядит и когда именно показывается - решает сама операционная
// система/браузер, не наше приложение - мы только просим разрешение и говорим,
// куда пересылать уведомления (это и есть endpoint в подписке).

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { reportDatabaseReadError } from './databaseReadError'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export type PushSupportStatus = 'unsupported' | 'default' | 'granted' | 'denied'

export function usePushNotifications(currentUserId: string | undefined): {
  status: PushSupportStatus
  // granted - разрешение браузера дано, но подписки в этом смысле недостаточно:
  // subscribed - именно то, что мы сами оформили доставку через subscribe() ниже
  // (permission мог быть выдан раньше и по другой причине, без реальной подписки).
  subscribed: boolean
  loading: boolean
  // Не null, если subscribe()/unsubscribe() не получились - раньше ошибка просто
  // улетала необработанным отказом промиса, и кнопка молча возвращалась в исходное
  // состояние без единой подсказки, что вообще произошло.
  error: string | null
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
} {
  const [status, setStatus] = useState<PushSupportStatus>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

  useEffect(() => {
    if (!supported) {
      setStatus('unsupported')
      return
    }
    setStatus(Notification.permission)
    setError(null)

    let cancelled = false
    async function restoreSubscription() {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (cancelled) return
        setSubscribed(subscription !== null)

        // Браузер иногда сам, в фоне, обновляет endpoint подписки (например, из
        // соображений безопасности) - без специального обработчика
        // (pushsubscriptionchange) в самом service worker это осталось бы
        // незамеченным до следующего ручного нажатия "Включить". Проще и надёжнее -
        // молча сверять и досылать актуальный endpoint при каждом открытии
        // приложения, раз оно и так уже открыто и вошло в аккаунт.
        if (subscription && currentUserId) {
          const json = subscription.toJSON()
          const { error: syncError } = await supabase
            .from('push_subscriptions')
            .upsert(
            { user_id: currentUserId, endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth },
            { onConflict: 'endpoint' },
          )
          if (syncError) throw syncError
        }
      } catch (caughtError) {
        if (cancelled) return
        reportDatabaseReadError('не удалось восстановить push-подписку', caughtError)
        setSubscribed(false)
        setError('Не удалось проверить уведомления. Попробуйте включить их ещё раз.')
      }
    }
    void restoreSubscription()
    return () => {
      cancelled = true
    }
  }, [supported, currentUserId])

  async function subscribe() {
    if (!supported || !currentUserId) return
    setLoading(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      setStatus(permission)
      if (permission !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = subscription.toJSON()

      const { error: upsertError } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: currentUserId,
            endpoint: json.endpoint!,
            p256dh: json.keys!.p256dh,
            auth: json.keys!.auth,
          },
          { onConflict: 'endpoint' },
        )
      if (upsertError) throw upsertError
      setSubscribed(true)
    } catch (caughtError) {
      console.error('push subscribe failed:', caughtError)
      setError('Не получилось включить уведомления. Проверьте интернет и попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    if (!supported) return
    setLoading(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setSubscribed(false)
        return
      }

      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      // Браузер уже отписан — интерфейс обязан сразу отражать именно это,
      // даже если последующая очистка устаревшей строки в базе не удалась.
      setSubscribed(false)
      const { error: deleteError } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
      if (deleteError) throw deleteError
    } catch (caughtError) {
      console.error('push unsubscribe failed:', caughtError)
      setError('Не получилось выключить уведомления. Проверьте интернет и попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return { status, subscribed, loading, error, subscribe, unsubscribe }
}

// PushManager.subscribe() принимает applicationServerKey только как Uint8Array,
// а сам VAPID-ключ представлен строкой в формате base64url - это обычное,
// повсеместно используемое преобразование одного в другое (не своя придумка).
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  // new Uint8Array(length) - гарантированно с обычным ArrayBuffer внутри (не
  // SharedArrayBuffer) - именно этого требует тип applicationServerKey у
  // PushManager.subscribe(), в отличие от Uint8Array.from(...), у которого
  // TypeScript не сужает тип буфера настолько же точно.
  const bytes = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i)
  return bytes
}
