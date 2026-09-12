// Единственное исключение из правила «новый документ показывает заставку» —
// служебная перезагрузка, которую Fly сам запускает в фоне после обновления
// service worker (см. main.tsx). Человек в этот момент мог лишь на секунду
// переключиться в другое приложение, поэтому при возвращении волны выглядели
// бы как повторный запуск без его действия.
const SKIP_LOADING_AFTER_AUTO_UPDATE_KEY = 'fly-skip-loading-after-auto-update'

export function markLoadingSkipAfterAutoUpdate(): void {
  try {
    sessionStorage.setItem(SKIP_LOADING_AFTER_AUTO_UPDATE_KEY, '1')
  } catch {
    // В приватном режиме хранилище иногда недоступно. Обновление всё равно
    // должно продолжиться; максимум после него ещё раз покажется заставка.
  }
}

export function consumeLoadingSkipAfterAutoUpdate(): boolean {
  try {
    if (sessionStorage.getItem(SKIP_LOADING_AFTER_AUTO_UPDATE_KEY) !== '1') return false
    // Метка одноразовая: следующий ручной Command+R снова обязан показать
    // волны, даже если он случился в той же вкладке браузера.
    sessionStorage.removeItem(SKIP_LOADING_AFTER_AUTO_UPDATE_KEY)
    return true
  } catch {
    return false
  }
}
