// Эта отметка хранится в app_metadata пользователя. В отличие от обычных
// настроек анкеты, app_metadata меняется только сервером с секретным ключом,
// поэтому человек не может самостоятельно открыть себе тестовый режим.
const REMOTE_TEST_UNTIL_KEY = 'fly_remote_test_until'

export function hasActiveRemoteTestAccess(
  appMetadata: Record<string, unknown> | undefined,
  serverNow: number,
): boolean {
  const value = appMetadata?.[REMOTE_TEST_UNTIL_KEY]
  if (typeof value !== 'string') return false
  // Принимаем только точный стандартный формат, который создаёт Date.toISOString().
  // Date.parse сам исправляет невозможные даты вроде 31 февраля — нам это нельзя.
  const expiresAt = Date.parse(value)
  if (!Number.isFinite(expiresAt) || new Date(expiresAt).toISOString() !== value) return false
  return expiresAt > serverNow
}
