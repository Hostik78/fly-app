// PostgreSQL 23505 означает, что строка с таким уникальным ключом уже есть.
// При первом создании анкеты это безопасный ответ на повтор после потерянного
// сетевого ответа: данные уже в базе, перезаписывать их не требуется.
export function isExistingProfileConflict(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}
