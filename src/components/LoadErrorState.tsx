interface LoadErrorStateProps {
  onRetry: () => void
  compact?: boolean
  title?: string
  message?: string
}

// Единое состояние для неудачной загрузки во всём приложении. Оно специально
// отличается от пустого списка: человек понимает, что данные существуют, но
// сейчас не дошли, и может повторить запрос без перезагрузки приложения.
export function LoadErrorState({
  onRetry,
  compact = false,
  title = 'Не удалось загрузить',
  message = 'Проверьте соединение и попробуйте ещё раз.',
}: LoadErrorStateProps) {
  return (
    <div
      data-compact={compact}
      role="alert"
      className={`w-full flex flex-col items-center justify-center text-center ${
        compact ? 'gap-2 px-5 py-6' : 'h-full gap-3 px-8'
      }`}
    >
      <div className="text-base font-semibold text-fly-ink">{title}</div>
      <p className="max-w-xs text-sm leading-relaxed text-fly-gray">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-fly-md bg-fly-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-75"
      >
        Проверить снова
      </button>
    </div>
  )
}
