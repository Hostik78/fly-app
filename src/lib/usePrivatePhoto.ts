import { useEffect, useState } from 'react'
import { photoRequest } from './avatar'
import { supabase } from './supabase'

// URL живёт только в памяти этой вкладки. Никакого localStorage, Cache API,
// сервис-воркера или signed URL. HEAD перепроверяет доступ без скачивания фото.
export function usePrivatePhoto(userId: string, revision = 0) {
  const [photo, setPhoto] = useState<{ owner: string; url: string } | null>(null)
  useEffect(() => {
    let url: string | null = null
    let version: string | null = null
    let generation = 0
    let controller: AbortController | null = null
    let disposed = false
    let busy = false
    function clear() {
      generation++
      controller?.abort()
      if (url) URL.revokeObjectURL(url)
      url = null
      version = null
      setPhoto(null)
    }
    async function refresh() {
      if (disposed || busy || document.visibilityState === 'hidden') return
      busy = true
      const current = generation
      controller = new AbortController()
      try {
        const check = await photoRequest(userId, controller.signal, 'HEAD')
        if (disposed || generation !== current) return
        if (!check?.ok) {
          clear()
          return
        }
        const nextVersion = check.headers.get('X-Photo-Version')
        if (url && nextVersion === version) return
        const response = await photoRequest(userId, controller.signal)
        if (!response?.ok) {
          clear()
          return
        }
        const blob = await response.blob()
        if (disposed || generation !== current) return
        if (url) URL.revokeObjectURL(url)
        url = URL.createObjectURL(blob)
        version = response.headers.get('X-Photo-Version')
        setPhoto({ owner: userId, url })
      } catch {
        if (!disposed && generation === current) clear()
      } finally {
        busy = false
      }
    }
    function invalidate() {
      clear()
      queueMicrotask(() => void refresh())
    }
    function visibility() {
      clear()
      if (document.visibilityState !== 'hidden') void refresh()
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // Не делаем асинхронных auth-вызовов внутри callback Supabase.
      clear()
      setTimeout(() => void refresh(), 0)
    })
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('photo-access-changed', invalidate)
    window.addEventListener('pagehide', clear)
    window.addEventListener('pageshow', invalidate)
    void refresh()
    const timer = setInterval(() => void refresh(), 15000)
    return () => {
      disposed = true
      clear()
      clearInterval(timer)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('photo-access-changed', invalidate)
      window.removeEventListener('pagehide', clear)
      window.removeEventListener('pageshow', invalidate)
    }
  }, [userId, revision])
  return photo?.owner === userId ? photo.url : null
}
