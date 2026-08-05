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

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'invalid token' })
    return
  }
  const userId = userData.user.id

  // Ошибку тут намеренно не считаем поводом остановиться - у человека вполне
  // может не быть загруженного фото вообще, тогда файла и так не существует.
  await supabaseAdmin.storage.from('avatars').remove([`${userId}/avatar.jpg`])

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteError) {
    res.status(500).json({ error: 'delete failed' })
    return
  }

  res.status(200).json({ success: true })
}
