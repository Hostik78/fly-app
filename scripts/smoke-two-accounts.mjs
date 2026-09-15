import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Этот сценарий создаёт и удаляет данные в подключённом Supabase-проекте. Явный
// флаг не даёт случайно запустить его обычной командой npm test или по ошибке
// против production во время локальной разработки.
if (process.env.FLY_ALLOW_REMOTE_SMOKE !== '1') {
  throw new Error('Для удалённого smoke-теста нужен FLY_ALLOW_REMOTE_SMOKE=1')
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Не найдены SUPABASE_URL, SUPABASE_ANON_KEY или SUPABASE_SERVICE_ROLE_KEY')
}

// Административный клиент нужен только для создания и гарантированной очистки
// временных Auth-пользователей. Все продуктовые запросы ниже выполняются через
// два обычных клиента с anon key и реальными пользовательскими сессиями — именно
// так мы проверяем RLS, а не обходим его service role.
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const makeUserClient = () =>
  createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const testRunId = randomUUID()
const password = `${randomBytes(24).toString('base64url')}aA1!`
const users = []

function requireNoError(label, result) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'неизвестная ошибка'}`)
  return result.data
}

async function createTemporaryUser(label) {
  const email = `fly-smoke-${label}-${testRunId}@example.com`
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fly_automated_smoke_test: true },
  })
  const data = requireNoError(`Создание пользователя ${label}`, result)
  assert.ok(data.user, `Supabase не вернул пользователя ${label}`)
  users.push(data.user.id)
  return { email, id: data.user.id }
}

async function signIn(user) {
  const client = makeUserClient()
  requireNoError(
    `Вход пользователя ${user.id}`,
    await client.auth.signInWithPassword({ email: user.email, password }),
  )
  return client
}

async function cleanup() {
  // Удаление Auth-пользователя каскадно очищает созданные анкеты, заметки,
  // лайки, сообщения, совпадения и блокировки. Идём в обратном порядке и
  // пытаемся удалить каждого пользователя, даже если первая очистка не удалась.
  const failures = []
  for (const userId of [...users].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) failures.push(error.message)
  }
  if (failures.length > 0) {
    throw new Error(`Не удалось очистить временных пользователей: ${failures.join('; ')}`)
  }
}

try {
  console.log('1/8 Создаю две временные учётные записи')
  const userA = await createTemporaryUser('a')
  const userB = await createTemporaryUser('b')
  const clientA = await signIn(userA)
  const clientB = await signIn(userB)

  console.log('2/8 Создаю раздельные анкеты и заметки')
  requireNoError(
    'Анкета A',
    await clientA.from('profiles').insert({ user_id: userA.id, age: 31, languages: 'Русский' }),
  )
  requireNoError(
    'Анкета B',
    await clientB.from('profiles').insert({ user_id: userB.id, age: 32, languages: 'English' }),
  )
  requireNoError(
    'Заметка A',
    await clientA.from('posts').insert({
      user_id: userA.id,
      quote: `Smoke A ${testRunId}`,
      category: 'communication',
    }),
  )
  requireNoError(
    'Заметка B',
    await clientB.from('posts').insert({
      user_id: userB.id,
      quote: `Smoke B ${testRunId}`,
      category: 'communication',
    }),
  )

  console.log('3/8 Проверяю взаимную видимость в ленте')
  const feedA = requireNoError('Лента A', await clientA.rpc('get_feed_posts'))
  const feedB = requireNoError('Лента B', await clientB.rpc('get_feed_posts'))
  assert.ok(feedA.some((post) => post.user_id === userB.id), 'A не видит заметку B')
  assert.ok(feedB.some((post) => post.user_id === userA.id), 'B не видит заметку A')

  console.log('4/8 Проверяю приватность одностороннего лайка')
  requireNoError(
    'Лайк A → B',
    await clientA.from('likes').insert({ liker_id: userA.id, liked_id: userB.id }),
  )
  const likesA = requireNoError('Исходящие лайки A', await clientA.from('likes').select('*'))
  const likesB = requireNoError('Скрытые входящие лайки B', await clientB.from('likes').select('*'))
  assert.equal(likesA.length, 1, 'A должен видеть свой исходящий лайк')
  assert.equal(likesB.length, 0, 'B не должен видеть односторонний входящий лайк')

  const earlyMessage = await clientA.from('messages').insert({
    sender_id: userA.id,
    recipient_id: userB.id,
    text: 'Сообщение до совпадения',
  })
  assert.ok(earlyMessage.error, 'Сообщение до взаимного лайка должно быть запрещено')

  console.log('5/8 Создаю взаимный лайк и проверяю совпадение')
  requireNoError(
    'Лайк B → A',
    await clientB.from('likes').insert({ liker_id: userB.id, liked_id: userA.id }),
  )
  const matchesA = requireNoError('Совпадения A', await clientA.rpc('get_match_user_ids'))
  const matchesB = requireNoError('Совпадения B', await clientB.rpc('get_match_user_ids'))
  assert.deepEqual(matchesA.map(({ user_id }) => user_id), [userB.id])
  assert.deepEqual(matchesB.map(({ user_id }) => user_id), [userA.id])

  console.log('6/8 Отправляю и читаю сообщение')
  requireNoError(
    'Сообщение A → B',
    await clientA.from('messages').insert({
      sender_id: userA.id,
      recipient_id: userB.id,
      text: `Smoke message ${testRunId}`,
    }),
  )
  const messagesB = requireNoError(
    'История сообщений B',
    await clientB.from('messages').select('sender_id, recipient_id, text'),
  )
  assert.equal(messagesB.length, 1)
  assert.equal(messagesB[0].sender_id, userA.id)

  console.log('7/8 Блокирую пару и проверяю немедленную остановку общения')
  requireNoError(
    'Блокировка B → A',
    await clientB.from('blocked_users').insert({ blocker_id: userB.id, blocked_id: userA.id }),
  )
  const matchesAfterBlock = requireNoError(
    'Совпадения A после блокировки',
    await clientA.rpc('get_match_user_ids'),
  )
  assert.equal(matchesAfterBlock.length, 0, 'Заблокированная пара не должна оставаться в совпадениях')
  const blockedMessage = await clientA.from('messages').insert({
    sender_id: userA.id,
    recipient_id: userB.id,
    text: 'Сообщение после блокировки',
  })
  assert.ok(blockedMessage.error, 'Новое сообщение после блокировки должно быть запрещено')

  console.log('8/8 Все проверки пройдены')
} finally {
  await cleanup()
  console.log('Временные пользователи и связанные данные удалены')
}
