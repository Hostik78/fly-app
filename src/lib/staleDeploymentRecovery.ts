const LAST_STALE_ASSET_KEY = 'fly-last-stale-asset'
const HISTORY_STALE_ASSET_KEY = '__flyLastStaleAsset'
const UPDATE_WAIT_MS = 1500

interface RecoveryActions {
  readFailures: () => readonly string[]
  saveLastFailure: (failure: string) => boolean
  updateApplication: () => Promise<void>
  reload: () => void
}

// Разные браузеры по-разному формулируют одну и ту же ошибку загрузки куска
// JavaScript. Важно отличать её от обычного временного сбоя запроса: из-за
// простого "Failed to fetch" нельзя внезапно перезагружать экран с анкетой.
function staleModuleFailure(reason: unknown): string | null {
  const message = reason instanceof Error ? reason.message : String(reason ?? '')
  const dynamicModuleError =
    /Failed to fetch dynamically imported module:\s*(\S+)/i.exec(message)
  if (dynamicModuleError) return dynamicModuleError[1]

  if (/Importing a module script failed/i.test(message)) return message
  if (/error loading dynamically imported module/i.test(message)) return message
  return null
}

// Возвращает true, только если ошибка действительно относится к устаревшей
// сборке и восстановление было запущено. Отдельные действия передаются снаружи,
// чтобы один и тот же порядок можно было честно проверить без настоящей
// перезагрузки страницы в тестах.
export async function recoverFromStaleDeployment(
  reason: unknown,
  buildVersion: string,
  actions: RecoveryActions,
): Promise<boolean> {
  const failure = staleModuleFailure(reason)
  if (!failure) return false

  // Safari не сообщает адрес исчезнувшего файла, поэтому один только текст
  // ошибки у него одинаковый после каждого деплоя. Адрес главного модуля
  // содержит хеш текущей сборки и отличает одно обновление от следующего.
  const failureForThisBuild = `${buildVersion}|${failure}`
  if (actions.readFailures().includes(failureForThisBuild)) return false

  // Перезагружаем страницу только когда смогли надёжно запомнить попытку.
  // Иначе недоступный storage вместе с постоянно отсутствующим файлом мог бы
  // создать бесконечный цикл перезагрузок.
  if (!actions.saveLastFailure(failureForThisBuild)) return false
  try {
    await actions.updateApplication()
  } finally {
    // Даже если проверка обновления service worker не удалась из-за сети,
    // обычная перезагрузка всё равно может получить целую текущую сборку.
    actions.reload()
  }
  return true
}

function readFailures(): string[] {
  const failures: string[] = []
  try {
    const stored = sessionStorage.getItem(LAST_STALE_ASSET_KEY)
    if (stored) failures.push(stored)
  } catch {
    // Ниже пробуем history.state — он обычно доступен даже в строгом режиме.
  }
  try {
    const storedInHistory = (history.state as Record<string, unknown> | null)?.[HISTORY_STALE_ASSET_KEY]
    if (typeof storedInHistory === 'string' && !failures.includes(storedInHistory)) {
      failures.push(storedInHistory)
    }
  } catch {
    // Если оба хранилища недоступны, вернётся пустой список и save ниже
    // самостоятельно запретит небезопасную перезагрузку.
  }
  return failures
}

function saveLastFailure(failure: string): boolean {
  try {
    // Имя файла сборки содержит уникальный хеш. Запомнив именно его, мы не
    // зациклим перезагрузку на одном сбое, но сможем восстановиться после
    // следующего обновления, где имя файла уже будет другим.
    sessionStorage.setItem(LAST_STALE_ASSET_KEY, failure)
    return true
  } catch {
    // В приватном режиме sessionStorage иногда запрещён. Сохраняем ту же
    // одноразовую защиту в записи текущей страницы, не стирая служебные поля
    // React Router и других частей браузера.
    try {
      const current = history.state && typeof history.state === 'object' ? history.state : {}
      history.replaceState({ ...current, [HISTORY_STALE_ASSET_KEY]: failure }, '')
      return true
    } catch {
      return false
    }
  }
}

async function updateApplication(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  const update = async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.update()
  }
  // Проверка обновления не должна сама превратиться в новое зависание. Через
  // короткий срок продолжим перезагрузку с тем, что уже успел получить браузер.
  await Promise.race([
    update().catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, UPDATE_WAIT_MS)),
  ])
}

// Устанавливается один раз до первого кадра React. Ошибка динамического импорта
// приходит как unhandledrejection; window.error оставлен для браузеров, которые
// сообщают тот же сбой обычным событием ошибки скрипта.
export function installStaleDeploymentRecovery(onReload: () => void): void {
  const actions: RecoveryActions = {
    readFailures,
    saveLastFailure,
    updateApplication,
    reload: onReload,
  }
  window.addEventListener('unhandledrejection', (event) => {
    void recoverFromStaleDeployment(event.reason, import.meta.url, actions)
  })
  window.addEventListener('error', (event) => {
    void recoverFromStaleDeployment(event.error ?? event.message, import.meta.url, actions)
  })
}
