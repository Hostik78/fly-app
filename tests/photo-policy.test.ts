import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { photoDb, asUser, ids, sessions } from './helpers/photo-db'

let db: PGlite
let file = `${ids[0]}/30000000-0000-4000-8000-000000000001.jpg`
beforeAll(async () => {
  db = await photoDb()
}, 30000)
afterAll(async () => {
  await db?.close()
})
async function path(owner = ids[0]) {
  return (await db.query<{ path: string | null }>('select public.photo_path($1) as path', [owner]))
    .rows[0].path
}

describe.sequential('серверные правила фото', () => {
  it('не включает выдачу до завершения перехода', async () => {
    await asUser(db, 0)
    await expect(path()).rejects.toThrow('photo rollout incomplete')
    await db.exec('reset role; update private.photo_rollout set ready=true')
    await asUser(db, 0)
    file = (await db.query<{ v: string }>('select public.photo_upload_start() v')).rows[0].v
    await db.exec('reset role')
    await db.query("insert into storage.objects(bucket_id,name) values ('profile-photos',$1)", [
      file,
    ])
    await asUser(db, 0)
    await db.query('select public.photo_commit($1)', [file])
    expect(await path()).toBe(file)
  })
  it('приватное фото не видит посторонний и взаимный лайк не открывает его', async () => {
    await db.exec('reset role')
    await db.query('insert into public.likes values ($1,$2),($2,$1)', ids.slice(0, 2))
    await asUser(db, 1)
    expect(await path()).toBeNull()
  })
  it('только явное разрешение открывает фото, отзыв закрывает сразу', async () => {
    await asUser(db, 0)
    await db.query('select public.photo_set_grant($1,true)', [ids[1]])
    await asUser(db, 1)
    expect(await path()).toBe(file)
    await asUser(db, 0)
    await db.query('select public.photo_set_grant($1,false)', [ids[1]])
    await asUser(db, 1)
    expect(await path()).toBeNull()
  })
  it.each([0, 1])(
    'блокировка со стороны %s закрывает фото и не возвращает разрешение после разблокировки',
    async (blocker) => {
      await asUser(db, 0)
      await db.query('select public.photo_set_grant($1,true)', [ids[1]])
      await asUser(db, blocker)
      await db.query('insert into public.blocked_users(blocker_id,blocked_id) values ($1,$2)', [
        ids[blocker],
        ids[1 - blocker],
      ])
      await asUser(db, 1)
      expect(await path()).toBeNull()
      await asUser(db, blocker)
      await db.query('delete from public.blocked_users where blocker_id=$1', [ids[blocker]])
      await asUser(db, 1)
      expect(await path()).toBeNull()
      await asUser(db, 0)
      const settings = (
        await db.query<{ v: { grants: string[] } }>('select public.photo_settings() v')
      ).rows[0].v
      expect(settings.grants).toContain(ids[1])
    },
  )
  it('видимость в ленте всё равно учитывает блокировки', async () => {
    await asUser(db, 0)
    await db.query("select public.photo_set_visibility('visible')")
    await asUser(db, 1)
    expect(await path()).toBe(file)
    await db.query('insert into public.blocked_users(blocker_id,blocked_id) values ($1,$2)', [
      ids[1],
      ids[0],
    ])
    expect(await path()).toBeNull()
  })
  it('список блокировок не раскрывает живую анкету', async () => {
    const { rows } = await db.query<{ age: number | null; quote: string }>(
      'select * from public.get_blocked_profiles()',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].age).toBeNull()
    expect(rows[0].quote).toBe('')
  })
  it('закрывает прямой Storage SELECT, запись, подпись и закрытую схему', async () => {
    expect(
      (await db.query("select * from storage.objects where bucket_id='profile-photos'")).rows,
    ).toEqual([])
    await expect(
      db.query("insert into storage.objects(bucket_id,name) values ('profile-photos','forged')"),
    ).rejects.toThrow()
    await expect(db.query('select * from private.profile_photos')).rejects.toThrow()
    await expect(db.query('select public.photo_commit($1)', [file])).rejects.toThrow()
  })
  it('устаревший JWT после удаления сессии не даёт получить даже своё фото', async () => {
    await db.exec('reset role')
    await db.query('delete from auth.sessions where id=$1', [sessions[0]])
    await asUser(db, 0)
    await expect(path()).rejects.toThrow('active session required')
  })
  it('аноним не может вызывать функции', async () => {
    await db.exec('reset role; set role anon')
    await expect(path()).rejects.toThrow('permission denied')
  })
})
