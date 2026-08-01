// Service worker — программа, которая работает в фоне даже когда вкладка с
// приложением закрыта. Обычный код React такого не умеет: push-уведомление может
// прийти, когда человек вообще не открывал приложение, и показать его должен
// именно service worker, а не сама страница.
//
// strategies: 'injectManifest' (см. vite.config.ts) - этот файл пишется вручную
// (а не собирается автоматически), поэтому сюда можно добавить свои обработчики
// событий 'push'/'notificationclick'. precacheAndRoute ниже - то немногое, что
// всё равно нужно оставить для офлайн-режима (кеш файлов приложения), это
// подставляет сам плагин при сборке.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Новая версия service worker начинает работать сразу, не дожидаясь закрытия
// всех вкладок со старой версией - иначе PWA с уже открытым приложением никогда
// не получила бы обновлённый обработчик push.
self.skipWaiting()
clientsClaim()

// Форма данных, которую отправляет наша же Edge Function (см.
// supabase/functions/send-push/index.ts) - title и body для самого уведомления,
// url - куда переходить по клику (см. notificationclick ниже).
interface PushPayload {
  title: string
  body: string
  url: string
}

self.addEventListener('push', (event) => {
  // payload может не быть (например, тестовый пуш без данных) - тогда просто
  // не показываем уведомление, а не падаем с ошибкой.
  if (!event.data) return
  const payload = event.data.json() as PushPayload

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: payload.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'

  event.waitUntil(
    (async () => {
      // Если приложение уже открыто в какой-то вкладке - переходим в неё и
      // фокусируем, вместо того чтобы открывать ещё одну поверх уже открытой.
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = allClients[0]
      if (existing) {
        // type: 'window' выше гарантирует, что existing - настоящий WindowClient,
        // у которого navigate() есть всегда (не экспериментальный метод, фичедетект не нужен).
        existing.focus()
        await existing.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
