// Фото никогда не получает публичный или подписанный URL. Только серверный
// запрос с действующим токеном, без дискового кеша и запасного открытого пути.
import { supabase } from './supabase'
const MAX_SIZE_PX = 640
const JPEG_QUALITY = 0.85

export async function photoRequest(
  userId: string,
  signal?: AbortSignal,
  method = 'GET',
): Promise<Response | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null
  return fetch(`/api/photo?owner=${encodeURIComponent(userId)}`, {
    method,
    signal,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}
export async function fetchAvatar(userId: string, signal?: AbortSignal): Promise<Blob | null> {
  const response = await photoRequest(userId, signal)
  return response?.ok ? response.blob() : null
}

// Уменьшает картинку до MAX_SIZE_PX по длинной стороне и пережимает в JPEG -
// стандартный Canvas API браузера, отдельной библиотеки не нужно. Если файл
// и так меньше MAX_SIZE_PX - масштаб не увеличиваем (только уменьшаем).
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIZE_PX / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D недоступен')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не получилось подготовить изображение'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

export async function uploadAvatar(_userId: string, file: File): Promise<void> {
  const resized = await resizeImage(file)
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Войдите снова')
  // Размер после уменьшения ограничен также сервером. Токен не попадает в URL.
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Не удалось прочитать фото'))
    reader.readAsDataURL(resized)
  })
  const response = await fetch('/api/photo', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image }),
  })
  if (!response.ok) throw new Error('Не удалось сохранить фото')
  window.dispatchEvent(new Event('photo-access-changed'))
}
