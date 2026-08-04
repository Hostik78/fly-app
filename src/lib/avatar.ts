// Загрузка настоящего фото в анкету - хранилище файлов Supabase Storage
// (бакет avatars, см. миграцию create_avatars_storage_bucket.sql), не своя
// файловая система.
//
// Путь к файлу у каждого человека один и тот же - "<user_id>/avatar.jpg" -
// повторная загрузка перезаписывает старую фотографию (upsert), не копит
// старые версии. Формат всегда JPEG, картинка всегда уменьшена перед
// отправкой (см. resizeImage ниже) - не зависит от того, что именно выбрал
// человек (может быть огромное фото прямо с камеры телефона, 10+ МБ).

import { supabase } from './supabase'

const AVATAR_BUCKET = 'avatars'
// Больше человеку на маленьком кружке/карточке всё равно не нужно - экономит
// и место в хранилище, и трафик при каждом показе анкеты.
const MAX_SIZE_PX = 640
const JPEG_QUALITY = 0.85

export function avatarPath(userId: string): string {
  return `${userId}/avatar.jpg`
}

// getPublicUrl - просто склеивает строку по известному адресу бакета, без
// сетевого запроса (бакет публичный, см. миграцию) - "?v=" на конце нужен
// только чтобы браузер не показал старую картинку из своего кеша по тому же
// самому адресу сразу после того, как файл только что перезаписан.
//
// Сравнение именно с '' (а не просто "если cacheBustKey задан") - число 0
// само по себе "ложное" значение в JS, и 0 - совершенно законная версия
// (самый первый рендер), а не "версии нет". Проверка через обычное if(cacheBustKey)
// в этом месте однажды уже пропускала "?v=" ровно на нулевой версии - см. LESSONS.md.
export function getAvatarUrl(userId: string, cacheBustKey: string | number = ''): string {
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath(userId))
  return cacheBustKey === '' ? data.publicUrl : `${data.publicUrl}?v=${cacheBustKey}`
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

export async function uploadAvatar(userId: string, file: File): Promise<void> {
  const resized = await resizeImage(file)
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(avatarPath(userId), resized, {
    upsert: true,
    contentType: 'image/jpeg',
  })
  if (error) throw error
}
