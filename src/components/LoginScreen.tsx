// Экран входа - показывается, когда человек ещё не вошёл в аккаунт.
// Вход по ссылке на почту (без пароля): человек вводит адрес почты, мы просим
// Supabase прислать письмо со ссылкой. Переход по ссылке возвращает человека
// в приложение с готовым входом - это делает сама библиотека supabase-js,
// дополнительного кода на нашей стороне не нужно.

import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const sendingRef = useRef(false)

  async function handleSendLink() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || sendingRef.current) return

    sendingRef.current = true
    setSending(true)
    setSendError(null)
    // Раньше ошибка тут не проверялась вообще - экран "мы отправили письмо"
    // показывался, даже если Supabase на самом деле отказал (например,
    // встроенное ограничение "не чаще одного письма в минуту", неверный
    // формат почты или просто нет сети). Человек ждал бы письмо, которое
    // никогда не придёт, и не понимал бы, почему.
    try {
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setSendError('Не получилось отправить письмо. Проверьте адрес и попробуйте ещё раз.')
      return
    }
    setSent(true)
    } catch {
      setSendError('Не получилось отправить письмо. Проверьте соединение и попробуйте ещё раз.')
    } finally {
      // Даже при сетевом исключении форма снова доступна для повторной попытки.
      sendingRef.current = false
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div
        className="fly-entry-screen h-full w-full flex flex-col items-center gap-4 px-8 text-center"
        style={{
          paddingTop: 'calc(1rem + var(--fly-safe-top))',
          paddingBottom: 'calc(1rem + var(--fly-safe-bottom))',
        }}
      >
        <div className="text-2xl font-semibold">
          Fl<span className="text-fly-accent">y</span>
        </div>
        <p role="status" className="text-sm text-fly-gray leading-relaxed break-all">
          Мы отправили ссылку для входа на {email}. Откройте письмо и перейдите по ссылке.
        </p>
        <button type="button" className="min-h-11 text-sm underline" onClick={() => setSent(false)}>
          Изменить адрес почты
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); void handleSendLink() }}
      className="fly-entry-screen h-full w-full flex flex-col items-center gap-6 px-8"
      style={{
        paddingTop: 'calc(1rem + var(--fly-safe-top))',
        paddingBottom: 'calc(1rem + var(--fly-safe-bottom))',
      }}
    >
      <div className="text-2xl font-semibold">
        Fl<span className="text-fly-accent">y</span>
      </div>
      <p className="text-sm text-fly-gray text-center leading-relaxed">
        Общайтесь с людьми рядом в Шереметьево.
        {' '}
        Чтобы продолжить, введите почту — пришлём ссылку для входа
      </p>
      <input
        type="email"
        aria-label="Электронная почта"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        enterKeyHint="send"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="w-full max-w-xs bg-fly-fog rounded-fly-md px-4 py-3 text-base text-fly-ink outline-none border border-transparent focus:border-fly-accent"
      />
      <button
        type="submit"
        disabled={!email.trim() || sending}
        className="w-full max-w-xs py-3.5 rounded-fly-md bg-fly-solid text-fly-solid-text font-semibold text-sm transition-opacity disabled:opacity-30"
      >
        {sending ? 'Отправляем…' : 'Прислать ссылку для входа'}
      </button>
      {sendError && <p role="alert" className="text-xs text-fly-gray text-center px-6">{sendError}</p>}
    </form>
  )
}
