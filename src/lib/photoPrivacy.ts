import { supabase } from './supabase'
export type PhotoSettings = { visibility: 'private' | 'visible'; grants: string[] }

// Данные настройки принадлежат только владельцу. Ошибка не превращается
// в «приватно»: пока сервер не подтвердил состояние, переключатель недоступен.
export async function readPhotoSettings(): Promise<PhotoSettings> {
  const { data, error } = await supabase.rpc('photo_settings')
  if (error || !data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Настройка недоступна')
  const value = data as Record<string, unknown>
  if (
    !['private', 'visible'].includes(String(value.visibility)) ||
    !Array.isArray(value.grants) ||
    !value.grants.every((id) => typeof id === 'string')
  )
    throw new Error('Настройка недоступна')
  return value as PhotoSettings
}
export async function setPhotoVisibility(mode: PhotoSettings['visibility']) {
  const { error } = await supabase.rpc('photo_set_visibility', { mode })
  if (error) throw error
  window.dispatchEvent(new Event('photo-access-changed'))
}
export async function setPhotoGrant(viewer: string, allowed: boolean) {
  const { error } = await supabase.rpc('photo_set_grant', { viewer, allowed })
  if (error) throw error
  window.dispatchEvent(new Event('photo-access-changed'))
}
