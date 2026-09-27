// Сгенерировано scripts/generate-photo-types.ts из локальных миграций.
import type { Database as Base, Json } from './database.types'
export type PhotoFunctions = {
  activity_read: { Args: Record<PropertyKey, never>; Returns: Json }
  activity_write: { Args: { recipient: string | null }; Returns: undefined }
  photo_begin_delete: { Args: Record<PropertyKey, never>; Returns: boolean }
  photo_commit: { Args: { path: string }; Returns: string | null }
  photo_import: { Args: { owner: string; path: string }; Returns: string }
  photo_path: { Args: { owner: string }; Returns: string | null }
  photo_set_grant: { Args: { viewer: string; allowed: boolean }; Returns: undefined }
  photo_set_visibility: { Args: { mode: string }; Returns: undefined }
  photo_settings: { Args: Record<PropertyKey, never>; Returns: Json }
  photo_upload_finish: { Args: { path: string }; Returns: undefined }
  photo_upload_start: { Args: Record<PropertyKey, never>; Returns: string }
}
export type Database = Omit<Base, 'public'> & { public: Omit<Base['public'], 'Functions'> & { Functions: Base['public']['Functions'] & PhotoFunctions } }
