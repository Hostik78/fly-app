import { afterAll, beforeAll, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { photoDb, asUser, ids } from './helpers/photo-db'
let db: PGlite
const path = `${ids[0]}/30000000-0000-4000-8000-000000000009.jpg`
beforeAll(async () => {
  db = await photoDb()
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('импорт разрешён только служебной роли после заморозки старых загрузок', async () => {
  await asUser(db, 0)
  await expect(db.query('select public.photo_import($1,$2)', [ids[0], path])).rejects.toThrow(
    'permission denied',
  )
  await db.exec('reset role;set role service_role')
  await expect(db.query('select public.photo_import($1,$2)', [ids[0], path])).rejects.toThrow(
    'legacy writes must be frozen',
  )
  await db.exec('reset role')
  await db.exec(readFileSync('supabase/operations/freeze-legacy-photos.sql', 'utf8'))
  await db.query(
    "insert into storage.objects(bucket_id,name) values('profile-photos',$1),('avatars',$2)",
    [path, `${ids[0]}/avatar.jpg`],
  )
  await db.exec('set role service_role')
  expect(
    (await db.query<{ v: string }>('select public.photo_import($1,$2) v', [ids[0], path])).rows[0]
      .v,
  ).toBe(path)
  await db.exec('reset role')
  expect(
    (await db.query<{ visibility: string }>('select visibility from private.profile_photos'))
      .rows[0].visibility,
  ).toBe('private')
})
it('активация отказывается оставлять старые файлы и после очистки закрывает импорт', async () => {
  const activation = readFileSync('supabase/operations/activate-private-photos.sql', 'utf8')
  await expect(db.exec(activation)).rejects.toThrow('legacy objects remain')
  await db.exec("rollback; delete from storage.objects where bucket_id='avatars'")
  await db.exec(activation)
  await asUser(db, 0)
  expect(
    (await db.query<{ p: string }>('select public.photo_path($1) p', [ids[0]])).rows[0].p,
  ).toBe(path)
  await asUser(db, 1)
  expect(
    (await db.query<{ p: string | null }>('select public.photo_path($1) p', [ids[0]])).rows[0].p,
  ).toBeNull()
  await db.exec('reset role; set role service_role')
  await expect(db.query('select public.photo_import($1,$2)', [ids[0], path])).rejects.toThrow(
    'migration already finished',
  )
})
