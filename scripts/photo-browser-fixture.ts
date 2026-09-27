// Стенд слушает только loopback и никогда не подключается к production.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { photoDb, asUser, ids } from '../tests/helpers/photo-db.ts'
const db = await photoDb()
await db.exec('update private.photo_rollout set ready=true')
await db.query('insert into public.likes values($1,$2),($2,$1)', ids.slice(0, 2))
await asUser(db, 0)
const photo = (await db.query<{ p: string }>('select public.photo_upload_start() p')).rows[0].p
await db.exec('reset role')
await db.query("insert into storage.objects(bucket_id,name) values('profile-photos',$1)", [photo])
await asUser(db, 0)
await db.query('select public.photo_commit($1)', [photo])
// Один канал PGlite: запросы разных тестовых участников строго последовательно.
let queue = Promise.resolve()
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 5179, strictPort: true },
  plugins: [
    {
      name: 'fixture-only-supabase',
      enforce: 'pre',
      resolveId(source) {
        if (source === './supabase' || source === '../lib/supabase')
          return resolve('tests/browser-supabase.ts')
      },
    },
    react(),
    tailwind(),
    {
      name: 'fixture-http',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/fixture/') && !req.url?.startsWith('/api/photo')) {
            next()
            return
          }
          const run = async () => {
            res.setHeader('Cache-Control', 'no-store')
            try {
              if (req.url!.startsWith('/api/photo')) {
                const actor = Number(req.headers.authorization?.replace('Bearer fixture-', ''))
                if (!Number.isInteger(actor) || actor < 0 || actor > 1) {
                  res.statusCode = 401
                  res.end()
                  return
                }
                await asUser(db, actor)
                const owner = new URL(req.url!, 'http://localhost').searchParams.get('owner')
                const p = (
                  await db.query<{ p: string | null }>('select public.photo_path($1) p', [owner])
                ).rows[0].p
                if (!p) {
                  res.statusCode = 404
                  res.end()
                  return
                }
                res.setHeader('X-Photo-Version', p)
                res.setHeader('Content-Type', 'image/jpeg')
                res.end(
                  req.method === 'HEAD'
                    ? undefined
                    : readFileSync('src/assets/loading-screen-poster.jpg'),
                )
                return
              }
              let raw = ''
              for await (const chunk of req) raw += chunk
              const { actor, name, args } = JSON.parse(raw)
              if (![0, 1].includes(actor)) throw new Error('fixture session required')
              await asUser(db, actor)
              const calls: Record<string, [string, unknown[]]> = {
                photo_settings: ['select public.photo_settings() value', []],
                photo_set_visibility: [
                  'select public.photo_set_visibility($1) value',
                  [args?.mode],
                ],
                photo_set_grant: [
                  'select public.photo_set_grant($1,$2) value',
                  [args?.viewer, args?.allowed],
                ],
              }
              if (!calls[name]) throw new Error('unsupported fixture operation')
              const result = await db.query<{ value: unknown }>(...calls[name])
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ data: result.rows[0].value, error: null }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ data: null, error: { message: 'fixture request failed' } }))
            }
          }
          queue = queue.then(run, run)
        })
      },
    },
  ],
})
await server.listen()
console.log('Isolated photo fixture: http://127.0.0.1:5179/tests/browser/index.html')
