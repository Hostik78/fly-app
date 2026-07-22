import { createClient } from '@supabase/supabase-js'

// Подключение к Supabase - готовому "бэкенду в коробке" (база данных + вход/регистрация +
// хранение файлов + переписка в реальном времени), вместо того чтобы писать всё это самим.
//
// VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY берутся из .env.local (см. README проекта).
// anon key - специально "публичный" ключ, его можно использовать прямо в коде браузера
// (в отличие от service role key, который остаётся только на сервере и никогда не должен
// попасть в код, который выполняется у пользователя).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Проверь файл .env.local ' +
      '(его можно обновить командой `vercel env pull .env.local`).',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
