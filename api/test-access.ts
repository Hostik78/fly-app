// Серверная проверка временного доступа из дома. Секрет Supabase остаётся на
// Vercel; браузер присылает только свой обычный токен входа. Сервер проверяет
// токен через getUser и сравнивает срок со СВОИМИ часами, а не часами телефона.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { hasActiveRemoteTestAccess } from '../src/lib/remoteTestAccess.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.status(405).json({ allowed: false })
    return
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    res.status(401).json({ allowed: false })
    return
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ allowed: false })
    return
  }

  res.status(200).json({
    allowed: hasActiveRemoteTestAccess(data.user.app_metadata, Date.now()),
  })
}
