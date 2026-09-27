import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

// Настоящий PostgreSQL в памяти. Только платформенные таблицы Auth/Storage
// сокращены до используемых колонок; RLS, роли и функции исполняет сама база.
export const ids = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
]
export const sessions = ids.map((id) => id.replace('10000000', '20000000'))
export async function photoDb() {
  const db = new PGlite()
  await db.exec(
    `
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema private;
    create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users on delete cascade, not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' $$;
  `.replace(
      "select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'",
      "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid",
    ),
  )
  await db.exec(`
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth, public, storage to authenticated, anon, service_role;
    create table public.profiles(user_id uuid primary key references auth.users on delete cascade, gender text, age integer, height integer, languages text, last_seen_at timestamptz);
    create table public.posts(user_id uuid primary key references auth.users on delete cascade, category text, hobby text, quote text, created_at timestamptz default now());
    create table public.likes(liker_id uuid references auth.users on delete cascade, liked_id uuid references auth.users on delete cascade, primary key(liker_id,liked_id));
    create table public.hidden_profiles(hider_id uuid, hidden_id uuid);
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, primary key(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    insert into storage.buckets values ('avatars','avatars',true,null,null);
  `)
  for (const name of [
    '20260804150702_create_blocked_users_table.sql',
    '20260915181314_add_scoped_profile_read_functions.sql',
  ]) {
    await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'))
  }
  for (let i = 0; i < 3; i++) {
    await db.query('insert into auth.users values ($1)', [ids[i]])
    await db.query('insert into auth.sessions values ($1,$2,null)', [sessions[i], ids[i]])
    await db.query('insert into public.profiles(user_id,age) values ($1,30)', [ids[i]])
    await db.query(
      "insert into public.posts(user_id,category,quote) values ($1,'communication','fixture')",
      [ids[i]],
    )
  }
  const migration = readdirSync('supabase/migrations').find((name) =>
    name.endsWith('_prepare_private_photos.sql'),
  )!
  await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
  return db
}
export async function asUser(db: PGlite, index: number) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: ids[index], session_id: sessions[index] }),
  ])
  await db.exec('set role authenticated')
}
