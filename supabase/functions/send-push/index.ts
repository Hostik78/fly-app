// Edge Function (серверный код, который выполняет сам Supabase, не браузер) -
// отправляет push-уведомления через стандартный Web Push (VAPID), когда приходит
// новое сообщение или образуется взаимный лайк (совпадение). Вызывается не из
// приложения напрямую, а триггером базы данных (см. миграцию
// push_notification_webhook_trigger.sql / fix_push_webhook_auth_header.sql) сразу
// после того, как в messages/likes появилась новая строка.
//
// auth: 'secret' - принимает только вызовы с настоящим secret-ключом проекта в
// заголовке apikey (его для триггера кладёт Vault, см. ту же миграцию) - обычный
// пользователь приложения вызвать эту функцию не может.

import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase, type SupabaseContext } from '@supabase/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

interface MessageRecord {
  id: string
  sender_id: string
  recipient_id: string
  text: string
}

interface LikeRecord {
  liker_id: string
  liked_id: string
}

interface WebhookBody {
  table: 'messages' | 'likes'
  record: MessageRecord | LikeRecord
}

interface NotifyTarget {
  userId: string
  title: string
  body: string
  url: string
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    const payload = (await req.json()) as WebhookBody
    const targets = await resolveTargets(payload, ctx)
    await Promise.all(targets.map((target) => sendToUser(target, ctx)))
    return Response.json({ sent: targets.length })
  }),
}

// Решает, кому и что написать. Для messages - всегда получателю. Для likes -
// ТОЛЬКО если этот лайк оказался взаимным (уже есть лайк в обратную сторону) -
// про односторонний лайк никого не уведомляем вообще: приложение специально
// устроено так, что о лайке в свой адрес узнаёшь, только когда сам(а) лайкнул(а)
// в ответ (см. миграцию tighten_likes_select_to_hide_one_sided.sql) - уведомление
// про каждый входящий лайк раскрывало бы ровно то, что там намеренно скрыто.
async function resolveTargets(payload: WebhookBody, ctx: SupabaseContext): Promise<NotifyTarget[]> {
  if (payload.table === 'messages') {
    const record = payload.record as MessageRecord
    const preview = record.text.length > 80 ? record.text.slice(0, 80) + '…' : record.text
    return [{ userId: record.recipient_id, title: 'Новое сообщение', body: preview, url: '/#/messages' }]
  }

  const record = payload.record as LikeRecord
  const { data: reverseLike } = await ctx.supabaseAdmin
    .from('likes')
    .select('liker_id')
    .eq('liker_id', record.liked_id)
    .eq('liked_id', record.liker_id)
    .maybeSingle()

  if (!reverseLike) return []

  // Взаимный лайк вызывает ЭТУ функцию дважды - отдельно для своей строки likes и
  // отдельно для уже существующей обратной (у каждой свой триггер INSERT). Без
  // защиты ниже оба вызова видели бы "уже взаимно" и оба отправили бы уведомления -
  // человек получил бы одно и то же "Новое совпадение!" дважды. Поэтому сначала
  // пытаемся "застолбить" эту пару в отдельной таблице (см. миграцию
  // create_match_notifications.sql) - у кого вставка прошла, тот и шлёт, у кого
  // не прошла (пара уже застолблена другим вызовом) - тот молча ничего не делает.
  const [userIdA, userIdB] = [record.liker_id, record.liked_id].sort()
  const { error: claimError } = await ctx.supabaseAdmin
    .from('match_notifications')
    .insert({ user_id_a: userIdA, user_id_b: userIdB })
  if (claimError) {
    // 23505 (unique_violation) - это и есть ожидаемый исход "другой вызов уже
    // застолбил эту пару первым", не поломка - молчим. Любая другая ошибка -
    // настоящая проблема (например, не хватает прав), её стоит видеть в логах.
    if (claimError.code !== '23505') console.error('match_notifications insert failed:', claimError)
    return []
  }

  return [
    { userId: record.liker_id, title: 'Новое совпадение!', body: 'У вас взаимный лайк', url: '/#/messages' },
    { userId: record.liked_id, title: 'Новое совпадение!', body: 'У вас взаимный лайк', url: '/#/messages' },
  ]
}

async function sendToUser(target: NotifyTarget, ctx: SupabaseContext) {
  const { data: subscriptions } = await ctx.supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', target.userId)

  const payload = JSON.stringify({ title: target.title, body: target.body, url: target.url })

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
        )
      } catch (error) {
        // 404/410 - подписка больше недействительна (например, человек снёс
        // приложение с телефона, или у браузера истёк внутренний endpoint) -
        // подчищаем её, иначе на неё продолжали бы бесполезно пытаться слать вечно.
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await ctx.supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        } else {
          // Любая другая причина (например, VAPID-ключи разъехались) должна быть
          // видна в логах - иначе уведомления тихо перестали бы приходить без
          // единого следа.
          console.error('sendNotification failed:', error)
        }
      }
    }),
  )
}
