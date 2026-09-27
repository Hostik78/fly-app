// Генерируем добавочные RPC-типы из каталога изолированного PostgreSQL после
// применения новых миграций. Production-типы после выкладки нужно сверить CLI.
import { writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { photoDb } from '../tests/helpers/photo-db.ts'
const db = await photoDb()
const activity = readdirSync('supabase/migrations').find((n) =>
  n.endsWith('_private_activity_status.sql'),
)!
await db.exec(readFileSync(`supabase/migrations/${activity}`, 'utf8'))
const { rows } = await db.query<{ name: string; args: string; result: string }>(`
 select p.proname name, pg_get_function_arguments(p.oid) args, pg_get_function_result(p.oid) result
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'photo_%' or p.proname like 'activity_%') order by p.proname
`)
const type = (name: string) =>
  ({ uuid: 'string', text: 'string', boolean: 'boolean', jsonb: 'Json', void: 'undefined' })[
    name
  ] ??
  (() => {
    throw new Error(`Unknown type: ${name}`)
  })()
const functions = rows
  .map((row) => {
    const args = row.args
      ? '{ ' +
        row.args
          .split(', ')
          .map((arg) => {
            const [name, t] = arg.split(' ')
            return `${name}: ${type(t)}${arg.includes('DEFAULT NULL') ? ' | null' : ''}`
          })
          .join('; ') +
        ' }'
      : 'Record<PropertyKey, never>'
    return `  ${row.name}: { Args: ${args}; Returns: ${type(row.result)}${row.name === 'photo_path' || row.name === 'photo_commit' ? ' | null' : ''} }`
  })
  .join('\n')
writeFileSync(
  'src/lib/photo.database.types.ts',
  `// Сгенерировано scripts/generate-photo-types.ts из локальных миграций.\nimport type { Database as Base, Json } from './database.types'\nexport type PhotoFunctions = {\n${functions}\n}\nexport type Database = Omit<Base, 'public'> & { public: Omit<Base['public'], 'Functions'> & { Functions: Base['public']['Functions'] & PhotoFunctions } }\n`,
)
await db.close()
