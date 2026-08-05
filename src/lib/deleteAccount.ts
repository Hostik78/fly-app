// Запрос на удаление аккаунта - сама работа (стирание из базы, удаление
// фото) происходит на сервере (см. api/delete-account.ts, там же объяснение
// почему это не может происходить прямо в браузере). Тут только поход по
// сети с токеном текущего входа, чтобы сервер точно знал, чей аккаунт удалять.

import { supabase } from './supabase'

export async function deleteAccount(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('not signed in')

  const response = await fetch('/api/delete-account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('delete failed')
}
