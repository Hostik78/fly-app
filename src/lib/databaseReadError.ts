// Supabase не бросает исключение для большинства ошибок чтения: он возвращает
// объект вида { data: null, error: ... }. Поэтому проверять только data нельзя —
// иначе сбой сети выглядит ровно так же, как честный пустой результат.
interface DatabaseReadResult {
  error: unknown | null
}

export function firstDatabaseReadError(...results: DatabaseReadResult[]): unknown | null {
  return results.find((result) => result.error !== null)?.error ?? null
}

// Полная техническая причина нужна разработчику в консоли, но не человеку в
// интерфейсе: сообщения Postgres могут быть непонятными и иногда раскрывать
// детали устройства базы. На экране везде используется спокойный общий текст.
export function reportDatabaseReadError(context: string, error: unknown): void {
  console.error(`[Fly] ${context}:`, error)
}
