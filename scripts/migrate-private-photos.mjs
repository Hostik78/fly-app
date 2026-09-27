// Операторский перенос. По умолчанию только инвентаризация; значения ключей,
// UUID и содержимое изображений никогда не выводятся. Не запускать до freeze.
import { createClient } from '@supabase/supabase-js'
import { migratePhotos } from './lib/migrate-photos.mjs'
const mode = process.argv[2] ?? '--check'
if (!['--check', '--copy', '--retire'].includes(mode))
  throw new Error('Use --check, --copy or --retire')
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Server environment variables are required')
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
try {
  await migratePhotos(client, mode, console.log)
} catch {
  console.error(
    'Migration stopped. No activation performed. Inspect operator checklist and storage state without printing secrets.',
  )
  process.exitCode = 1
}
