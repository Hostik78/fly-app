import { afterAll, beforeAll, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { photoDb, asUser, ids, sessions } from './helpers/photo-db'
let db: PGlite
beforeAll(async () => {
  db = await photoDb()
  const name = readdirSync('supabase/migrations').find((x) =>
    x.endsWith('_private_activity_status.sql'),
  )!
  await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'))
  await db.query('insert into public.likes values ($1,$2),($2,$1)', ids.slice(0, 2))
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('статусы видны только незаблокированному совпадению и проверяются заново', async () => {
  await asUser(db, 0)
  await db.query('select public.activity_write($1)', [ids[1]])
  await asUser(db, 2)
  expect((await db.query<{ v: unknown[] }>('select public.activity_read() v')).rows[0].v).toEqual(
    [],
  )
  await asUser(db, 1)
  let r = (
    await db.query<{ v: { user_id: string; online: boolean; typing: boolean }[] }>(
      'select public.activity_read() v',
    )
  ).rows[0].v
  expect(r).toEqual([{ user_id: ids[0], online: true, typing: true }])
  await db.query('insert into public.blocked_users(blocker_id,blocked_id) values($1,$2)', [
    ids[1],
    ids[0],
  ])
  expect((await db.query<{ v: unknown[] }>('select public.activity_read() v')).rows[0].v).toEqual(
    [],
  )
  await asUser(db, 0)
  await expect(db.query('select public.activity_write($1)', [ids[1]])).rejects.toThrow(
    'recipient unavailable',
  )
  await db.exec('reset role')
  await db.query('delete from auth.sessions where id=$1', [sessions[0]])
  await asUser(db, 0)
  await expect(db.query('select public.activity_write(null)')).rejects.toThrow(
    'active session required',
  )
})
