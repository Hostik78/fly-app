// Единственный путь получения новых фото: каждый запрос проверяет живую
// сессию и актуальное разрешение. Браузеру не выдаём Storage URL или подпись.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKET = 'profile-photos'
const MAX_BYTES = 1024 * 1024

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('CDN-Cache-Control', 'no-store')
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  res.setHeader('Vary', 'Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : ''
  if (!token) {
    res.status(401).json({ error: 'authentication required' })
    return
  }
  try {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    // Заголовок пользователя нужен именно для RPC: auth.uid()/auth.jwt()
    // берутся из проверенной сервером Supabase подписи, а не из тела запроса.
    const viewer = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) {
      res.status(401).json({ error: 'authentication required' })
      return
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const owner = req.query.owner
      if (typeof owner !== 'string' || !UUID.test(owner)) {
        res.status(400).json({ error: 'invalid request' })
        return
      }
      const first = await viewer.rpc('photo_path', { owner })
      if (first.error) throw first.error
      if (!first.data) {
        res.status(404).json({ error: 'photo unavailable' })
        return
      }
      res.setHeader('X-Photo-Version', first.data.split('/').at(-1))
      if (req.method === 'HEAD') {
        res.status(200).end()
        return
      }
      const { data, error } = await admin.storage.from(BUCKET).download(first.data)
      if (error || !data) {
        res.status(404).json({ error: 'photo unavailable' })
        return
      }
      const bytes = Buffer.from(await data.arrayBuffer())
      // При смене фото, блокировке или отзыве за время загрузки старые байты
      // не отправляются. Уже завершённый ответ отозвать, конечно, невозможно.
      const second = await viewer.rpc('photo_path', { owner })
      if (second.error) throw second.error
      if (second.data !== first.data) {
        res.status(404).json({ error: 'photo unavailable' })
        return
      }
      res.setHeader('Content-Type', 'image/jpeg')
      res.status(200).send(bytes)
      return
    }
    const encoded = req.body?.image
    if (
      typeof encoded !== 'string' ||
      encoded.length > Math.ceil(MAX_BYTES / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    ) {
      res.status(400).json({ error: 'invalid image' })
      return
    }
    const bytes = Buffer.from(encoded, 'base64')
    if (
      bytes.length < 4 ||
      bytes.length > MAX_BYTES ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[bytes.length - 2] !== 255 ||
      bytes[bytes.length - 1] !== 217
    ) {
      res.status(400).json({ error: 'invalid image' })
      return
    }
    const ready = await viewer.rpc('photo_settings')
    if (ready.error) throw ready.error
    const reservation = await viewer.rpc('photo_upload_start')
    if (reservation.error || !reservation.data) throw new Error('upload unavailable')
    const path = reservation.data
    const uploaded = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', cacheControl: '0', upsert: false })
    if (uploaded.error) throw uploaded.error
    const committed = await viewer.rpc('photo_commit', { path })
    if (committed.error) {
      // Неопубликованный файл никому не доступен даже при сбое уборки.
      const cleanup = await admin.storage.from(BUCKET).remove([path])
      if (!cleanup.error) await admin.rpc('photo_upload_finish', { path })
      throw committed.error
    }
    // Старый файл уже не читается через photo_path. Уборка не меняет результат
    // успешной замены; оставшийся при сбое файл удалится при удалении аккаунта.
    if (committed.data && committed.data !== path)
      await admin.storage.from(BUCKET).remove([committed.data])
    const finished = await admin.rpc('photo_upload_finish', { path })
    if (finished.error) throw finished.error
    res.status(200).json({ success: true })
  } catch {
    res.status(503).json({ error: 'photo service unavailable' })
  }
}
