// Серверная функция Vercel: удаляет аккаунт человека навсегда. Секретный
// ключ (service role - полный доступ в обход RLS) живёт только тут, в
// переменных окружения сервера, и никогда не попадает в код браузера -
// иначе кто угодно смог бы этим же ключом удалить чужой аккаунт.
//
// Удаление auth-пользователя автоматически стирает и анкету, и посты, и
// лайки, и переписку, и блокировки - у всех этих таблиц стоит "on delete
// cascade" на ссылку к auth.users (проверено напрямую в базе). Отдельно,
// вручную, тут удаляется только фото профиля - оно лежит в Storage, а не в
// одной из этих таблиц, и каскад его не касается.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ответ об удалении относится только к текущему запросу и не должен
  // сохраняться промежуточными кешами.
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  // Токен из шапки запроса - подтверждает, что человек удаляет СВОЙ СОБСТВЕННЫЙ
  // аккаунт, а не может прислать чужой user_id и стереть кого-то другого.
  // getUser(token) сам проверяет подлинность токена, id из него подделать нельзя.
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'no token' })
    return
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData.user) {
      res.status(401).json({ error: 'invalid token' })
      return
    }
    const userId = userData.user.id

    // Закрываем выдачу и новые загрузки до уборки. Действующий JWT сам по
    // себе недостаточен: RPC проверяет, что сессия ещё есть в auth.sessions.
    const viewer = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const closing = await viewer.rpc('photo_begin_delete')
    if (closing.error) {
      res.status(503).json({ error: 'photo cleanup failed' })
      return
    }
    if (closing.data === false) {
      res.status(409).json({ error: 'photo upload in progress; retry shortly' })
      return
    }

    // Удаляем все версии из обоих хранилищ, включая незавершённые загрузки.
    // После удаления страницы снова читаем offset=0, иначе часть файлов
    // сместилась бы назад и была пропущена. Вложенные папки тоже учитываем.
    async function cleanFolder(bucket: string, prefix: string): Promise<void> {
      const storage = supabaseAdmin.storage.from(bucket)
      while (true) {
        const { data, error } = await storage.list(prefix, { limit: 100, offset: 0 })
        if (error || !data) throw new Error('storage list failed')
        if (!data.length) return
        const files: string[] = []
        for (const item of data) {
          const path = `${prefix}/${item.name}`
          if (item.id) files.push(path)
          else await cleanFolder(bucket, path)
        }
        if (files.length) {
          const removed = await storage.remove(files)
          if (removed.error) throw new Error('storage remove failed')
        }
      }
    }
    try {
      await cleanFolder('avatars', userId)
      await cleanFolder('profile-photos', userId)
    } catch {
      res.status(503).json({ error: 'photo cleanup failed' })
      return
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      res.status(500).json({ error: 'delete failed' })
      return
    }

    res.status(200).json({ success: true })
  } catch {
    // Сетевая ошибка не должна превращаться в успех или раскрывать клиенту
    // внутренний адрес сервиса, содержимое запроса и диагностические данные.
    res.status(503).json({ error: 'delete temporarily unavailable' })
  }
}
