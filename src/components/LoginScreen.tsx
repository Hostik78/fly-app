// Экран входа - показывается, когда человек ещё не вошёл в аккаунт.
// Вход по ссылке на почту (без пароля): человек вводит адрес почты, мы просим
// Supabase прислать письмо со ссылкой. Переход по ссылке возвращает человека
// в приложение с готовым входом - это делает сама библиотека supabase-js,
// дополнительного кода на нашей стороне не нужно.

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSendLink() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return

    setSending(true)
    await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div
        className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center"
        style={{
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="text-2xl font-semibold">
          Fl<span className="text-fly-accent">y</span>
        </div>
        <p className="text-sm text-fly-gray leading-relaxed">
          Мы отправили ссылку для входа на {email}. Откройте письмо и перейдите по ссылке.
        </p>
      </div>
    )
  }

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center gap-6 px-8"
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="text-2xl font-semibold">
        Fl<span className="text-fly-accent">y</span>
      </div>
      <p className="text-sm text-fly-gray text-center leading-relaxed">
        Чтобы продолжить, введите почту — пришлём ссылку для входа
      </p>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="w-full max-w-xs bg-fly-fog rounded-fly-md px-4 py-3 text-sm text-fly-ink outline-none border border-transparent focus:border-fly-accent"
      />
      <button
        type="button"
        disabled={!email.trim() || sending}
        onClick={handleSendLink}
        className="w-full max-w-xs py-3.5 rounded-fly-md bg-fly-ink text-white font-semibold text-sm transition-opacity disabled:opacity-30"
      >
        {sending ? 'Отправляем…' : 'Прислать ссылку для входа'}
      </button>
    </div>
  )
}
