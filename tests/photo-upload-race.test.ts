import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { photoDb, asUser, ids } from './helpers/photo-db'
let db: PGlite
beforeAll(async () => {
  db = await photoDb()
  await db.exec('update private.photo_rollout set ready=true')
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('удаление закрывает публикацию и ждёт уже начатую загрузку', async () => {
  await asUser(db, 0)
  const path = (await db.query<{ v: string }>('select public.photo_upload_start() v')).rows[0].v
  expect(path.startsWith(ids[0] + '/')).toBe(true)
  expect((await db.query<{ v: boolean }>('select public.photo_begin_delete() v')).rows[0].v).toBe(
    false,
  )
  await expect(db.query('select public.photo_upload_start()')).rejects.toThrow(
    'account deletion in progress',
  )
  await expect(db.query('select public.photo_upload_finish($1)', [path])).rejects.toThrow(
    'permission denied',
  )
  await db.exec('reset role')
  await db.query("insert into storage.objects(bucket_id,name) values('profile-photos',$1)", [path])
  await asUser(db, 0)
  await expect(db.query('select public.photo_commit($1)', [path])).rejects.toThrow(
    'account deletion in progress',
  )
  await db.exec('reset role; set role service_role')
  await db.query('select public.photo_upload_finish($1)', [path])
  await asUser(db, 0)
  expect((await db.query<{ v: boolean }>('select public.photo_begin_delete() v')).rows[0].v).toBe(
    true,
  )
})
