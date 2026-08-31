// Одна функция отправки на всё время жизни открытого чата.
export function createSubmissionGuard() {
  // Меняем флаг сразу, не ожидая следующей отрисовки React: два быстрых
  // нажатия Enter могут прийти раньше, чем кнопка станет отключённой.
  let pending = false
  return async (send: () => Promise<void>): Promise<void> => {
    if (pending) return
    pending = true
    try {
      await send()
    } finally {
      // Ошибка не должна навсегда запрещать человеку повторить попытку.
      pending = false
    }
  }
}
