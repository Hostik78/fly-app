import { useEffect, useRef, useState } from 'react'
import {
  readPhotoSettings,
  setPhotoGrant,
  setPhotoVisibility,
  type PhotoSettings,
} from '../lib/photoPrivacy'

// Один компонент используется в аккаунте и в переписке. Состояние обновляется
// только после ответа базы; ошибки видны человеку, ложного «сохранено» нет.
export function PhotoPrivacySettings({ recipient }: { recipient?: string }) {
  const requestId = useRef(0)
  const changing = useRef(false)
  const [settings, setSettings] = useState<PhotoSettings | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (changing.current) return
      const id = ++requestId.current
      try {
        const next = await readPhotoSettings()
        if (!cancelled && requestId.current === id) {
          setSettings(next)
          setError(false)
        }
      } catch {
        if (!cancelled && requestId.current === id) {
          setSettings(null)
          setError(true)
        }
      }
    }
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 15000)
    window.addEventListener('focus', load)
    window.addEventListener('photo-access-changed', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', load)
      window.removeEventListener('photo-access-changed', load)
    }
  }, [attempt, recipient])
  async function change(action: () => Promise<void>) {
    if (changing.current) return
    changing.current = true
    const id = ++requestId.current
    setBusy(true)
    setError(false)
    try {
      await action()
      const next = await readPhotoSettings()
      if (id === requestId.current) setSettings(next)
    } catch {
      setError(true)
    } finally {
      changing.current = false
      setBusy(false)
    }
  }
  const granted = !!recipient && !!settings?.grants.includes(recipient)
  return (
    <section
      aria-label="Доступ к моему фото"
      className="px-4 py-3 mb-3 rounded-fly-md bg-fly-glass border border-fly-glass-border text-sm text-fly-ink"
    >
      <p className="font-semibold mb-2">Доступ к моему фото</p>
      {settings && !recipient && (
        <>
          <label className="flex flex-col gap-2">
            Кто видит фото
            <select
              aria-label="Кто видит фото"
              disabled={busy}
              value={settings.visibility}
              onChange={(e) =>
                void change(() => setPhotoVisibility(e.target.value as PhotoSettings['visibility']))
              }
              className="bg-fly-fog rounded-fly-sm p-2 text-fly-ink"
            >
              <option value="private">Только я и выбранные люди</option>
              <option value="visible">Люди, которым видна моя анкета</option>
            </select>
          </label>
          <p className="text-xs text-fly-gray mt-2">
            Здесь ваш выбор получателей. Он не показывает действия собеседника. Разрешить доступ
            можно в анкете собеседника из переписки; совпадение само по себе фото не открывает.
          </p>
          {settings.grants.map((id) => (
            <div key={id} className="flex justify-between items-center gap-2 mt-2">
              <span className="text-xs">Вы выбрали · {id.slice(-8)}</span>
              <button
                disabled={busy}
                className="text-fly-accent text-xs p-2"
                onClick={() => void change(() => setPhotoGrant(id, false))}
              >
                Отозвать
              </button>
            </div>
          ))}
        </>
      )}
      {settings && recipient && (
        <>
          <button
            disabled={busy}
            className="text-fly-accent py-2 disabled:opacity-50"
            onClick={() => void change(() => setPhotoGrant(recipient, !granted))}
          >
            {busy
              ? 'Сохраняем…'
              : granted
                ? 'Отозвать доступ собеседника'
                : 'Разрешить собеседнику видеть моё фото'}
          </button>
          {settings.visibility === 'visible' && (
            <p className="text-xs text-fly-gray">
              Фото сейчас видно вместе с анкетой. Чтобы ограничить его выбранными людьми, включите
              приватность в аккаунте.
            </p>
          )}
        </>
      )}
      {!settings && !error && <p className="text-xs text-fly-gray">Проверяем настройку…</p>}
      {error && (
        <p role="alert" className="text-xs text-fly-gray">
          Не удалось подтвердить настройку.{' '}
          <button
            disabled={busy}
            onClick={() => setAttempt((n) => n + 1)}
            className="text-fly-accent p-2"
          >
            Повторить
          </button>
        </p>
      )}
      <p className="text-xs text-fly-gray mt-2">
        Блокировка закрывает доступ. Уже сохранённую другим человеком копию удалить нельзя.
      </p>
    </section>
  )
}
