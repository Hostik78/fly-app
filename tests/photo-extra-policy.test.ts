import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { photoDb, asUser, ids, sessions } from './helpers/photo-db'
let db: PGlite
beforeAll(async () => {
  db = await photoDb()
  await db.exec('update private.photo_rollout set ready=true')
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('замена публикует только новый путь, а выход одной сессии не отзывает другую', async () => {
  const paths: string[] = []
  for (let i = 0; i < 2; i++) {
    await asUser(db, 0)
    const path = (await db.query<{ v: string }>('select public.photo_upload_start() v')).rows[0].v
    await db.exec('reset role')
    await db.query("insert into storage.objects(bucket_id,name) values('profile-photos',$1)", [
      path,
    ])
    await asUser(db, 0)
    const old = (await db.query<{ v: string | null }>('select public.photo_commit($1) v', [path]))
      .rows[0].v
    expect(old).toBe(paths.at(-1) ?? null)
    paths.push(path)
  }
  expect(
    (await db.query<{ v: string }>('select public.photo_path($1) v', [ids[0]])).rows[0].v,
  ).toBe(paths[1])
  await db.exec('reset role')
  // Отдельная новая сессия того же владельца, UUID тестового третьего участника не переиспользуем.
  const second = '20000000-0000-4000-8000-000000000004'
  await db.query('insert into auth.sessions values($1,$2,null)', [second, ids[0]])
  await db.query('delete from auth.sessions where id=$1', [sessions[0]])
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: ids[0], session_id: second }),
  ])
  await db.exec('set role authenticated')
  expect(
    (await db.query<{ v: string }>('select public.photo_path($1) v', [ids[0]])).rows[0].v,
  ).toBe(paths[1])
  await db.exec('reset role')
  await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1", [
    second,
  ])
  await expect(db.query('select public.photo_path($1)', [ids[0]])).rejects.toThrow(
    'active session required',
  )
})
it('restrictive-политика перекрывает даже постороннее широкое разрешение Storage', async () => {
  await db.exec(
    'reset role; create policy accidental_wide_read on storage.objects for select to authenticated using(true)',
  )
  await asUser(db, 1)
  expect(
    (await db.query("select * from storage.objects where bucket_id='profile-photos'")).rows,
  ).toEqual([])
  await expect(
    db.query("update storage.objects set name='stolen' returning name"),
  ).resolves.toMatchObject({ rows: [] })
})
it('удаление владельца каскадно удаляет разрешения и метаданные, старый JWT закрыт', async () => {
  await db.exec('reset role')
  await db.query('delete from auth.users where id=$1', [ids[0]])
  expect((await db.query('select * from private.profile_photos')).rows).toEqual([])
  expect((await db.query('select * from private.photo_uploads')).rows).toEqual([])
  await asUser(db, 0)
  await expect(db.query('select public.photo_settings()')).rejects.toThrow(
    'active session required',
  )
})
