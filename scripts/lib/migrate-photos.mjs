// Проверяемый перенос через Storage API. Никаких прямых DELETE storage.objects.
import { randomUUID, createHash } from 'node:crypto'
export async function migratePhotos(client, mode, report = () => {}) {
  const old = client.storage.from('avatars')
  const target = client.storage.from('profile-photos')
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
  async function bytes(storage, path) {
    const { data, error } = await storage.download(path)
    if (error || !data) throw new Error('Storage read failed')
    return Buffer.from(await data.arrayBuffer())
  }
  async function inventory(prefix = '') {
    const result = []
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await old.list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error || !data) throw new Error('Inventory failed')
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.id) result.push(path)
        else result.push(...(await inventory(path)))
      }
      if (data.length < 100) return result
    }
  }

  const originals = await inventory()
  if (originals.some((path) => !/^[0-9a-f-]{36}\/avatar\.jpg$/.test(path)))
    throw new Error('Nonstandard legacy objects require manual review; nothing changed')
  report(`Legacy photo count: ${originals.length}`)
  if (mode !== '--check') {
    const bucket = await client.storage.getBucket('avatars')
    if (bucket.error || bucket.data.public) throw new Error('Freeze legacy bucket first')
    const verified = []
    for (const source of originals) {
      const owner = source.split('/')[0]
      const content = await bytes(old, source)
      const candidate = `${owner}/${randomUUID()}.jpg`
      const upload = await target.upload(candidate, content, {
        upsert: false,
        contentType: 'image/jpeg',
        cacheControl: '0',
      })
      if (upload.error) throw new Error('Copy failed')
      if (digest(await bytes(target, candidate)) !== digest(content))
        throw new Error('Copy verification failed')
      const imported = await client.rpc('photo_import', { owner, path: candidate })
      if (imported.error || !imported.data)
        throw new Error('Metadata import failed; keep legacy files')
      if (digest(await bytes(target, imported.data)) !== digest(content))
        throw new Error('Existing copy differs; keep legacy files')
      if (imported.data !== candidate) {
        const cleanup = await target.remove([candidate])
        if (cleanup.error) throw new Error('Duplicate cleanup failed')
      }
      verified.push({ source, hash: digest(content), target: imported.data })
    }
    report(`Verified private copies: ${verified.length}`)
    if (mode === '--retire') {
      // Повторно проверяем оба файла непосредственно перед удалением оригинала.
      // При любой ошибке остановка: не маскируем частично выполненный переход.
      for (const file of verified) {
        if (
          digest(await bytes(old, file.source)) !== file.hash ||
          digest(await bytes(target, file.target)) !== file.hash
        )
          throw new Error('Content changed; retirement stopped')
        const removed = await old.remove([file.source])
        if (removed.error) throw new Error('Legacy retirement failed')
      }
      if ((await inventory()).length) throw new Error('Legacy objects remain')
      report(
        'Legacy bucket empty. CDN and old signed/transformed URLs still require external verification. NOT activated.',
      )
    }
  }
}
