// Экран входа - показывается, когда человек ещё не вошёл в аккаунт.
// Единственное действие - кнопка "Войти через Google". Дальше весь процесс
// (переход на страницу Google, подтверждение, возврат в приложение с готовым
// входом) делает сама библиотека supabase-js - дополнительного кода не нужно.

import { supabase } from '../lib/supabase'

export function LoginScreen() {
  function handleGoogleSignIn() {
    void supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="h-full w-full bg-white flex flex-col items-center justify-center gap-6 px-8">
      <div className="text-2xl font-semibold">
        Fl<span className="text-fly-blue-deep">y</span>
      </div>
      <p className="text-sm text-fly-gray text-center leading-relaxed">
        Чтобы продолжить, войдите через свой Google-аккаунт
      </p>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full max-w-xs py-3.5 rounded-fly-md bg-fly-ink text-white font-semibold text-sm"
      >
        Войти через Google
      </button>
    </div>
  )
}
