import { expect, it } from 'vitest'
import { migratePhotos } from '../scripts/lib/migrate-photos.mjs'

// Содержимое и удаления наблюдаем на файловой модели Storage API: тесты не
// имеют ключей/сети и никогда не затрагивают настоящие фотографии.
function fixture() {
  const owner = '10000000-0000-4000-8000-000000000001'
  const legacy = new Map([[`${owner}/avatar.jpg`, Buffer.from('original')]])
  const photos = new Map<string, Buffer>()
  const imported = new Map<string, string>()
  let failCopy = false
  const client = {
    storage: {
      getBucket: async () => ({ data: { public: false }, error: null }),
      from: (bucket: string) => {
        const files = bucket === 'avatars' ? legacy : photos
        return {
          list: async (prefix: string, { offset, limit }: { offset: number; limit: number }) => {
            const entries = new Map<string, { name: string; id: string | null }>()
            for (const path of files.keys()) {
              if (prefix && !path.startsWith(prefix + '/')) continue
              const rest = prefix ? path.slice(prefix.length + 1) : path
              const [name, ...nested] = rest.split('/')
              entries.set(name, { name, id: nested.length ? null : 'file' })
            }
            return { data: [...entries.values()].slice(offset, offset + limit), error: null }
          },
          download: async (path: string) => ({
            data: files.has(path) ? new Blob([files.get(path)!]) : null,
            error: null,
          }),
          upload: async (path: string, value: Buffer) => {
            files.set(path, failCopy ? Buffer.from('corrupted') : value)
            return { error: null }
          },
          remove: async (paths: string[]) => {
            paths.forEach((p) => files.delete(p))
            return { error: null }
          },
        }
      },
    },
    rpc: async (_name: string, { owner, path }: { owner: string; path: string }) => {
      if (!imported.has(owner)) imported.set(owner, path)
      return { data: imported.get(owner), error: null }
    },
  }
  return {
    client,
    legacy,
    photos,
    imported,
    corrupt: () => {
      failCopy = true
    },
  }
}
it('по умолчанию проверка ничего не меняет', async () => {
  const f = fixture()
  await migratePhotos(f.client, '--check')
  expect(f.legacy.size).toBe(1)
  expect(f.photos.size).toBe(0)
})
it('повторная копия сохраняет ровно один путь, оригинал остаётся до retire', async () => {
  const f = fixture()
  await migratePhotos(f.client, '--copy')
  await migratePhotos(f.client, '--copy')
  expect(f.legacy.size).toBe(1)
  expect(f.photos.size).toBe(1)
  await migratePhotos(f.client, '--retire')
  expect(f.legacy.size).toBe(0)
  expect(f.photos.size).toBe(1)
})
it('испорченная копия никогда не приводит к удалению оригинала', async () => {
  const f = fixture()
  f.corrupt()
  await expect(migratePhotos(f.client, '--retire')).rejects.toThrow('Copy verification failed')
  expect(f.legacy.size).toBe(1)
})
it('неожиданные файлы останавливают перенос до первой записи', async () => {
  const f = fixture()
  f.legacy.set('unexpected.jpg', Buffer.from('keep'))
  await expect(migratePhotos(f.client, '--retire')).rejects.toThrow('Nonstandard')
  expect(f.legacy.size).toBe(2)
  expect(f.photos.size).toBe(0)
})
