import type { PublishMessage } from '../types'

export async function sendFcmNotifications(
  db: D1Database,
  topic: string,
  msg: PublishMessage,
  fcmServerKey?: string,
): Promise<void> {
  if (!fcmServerKey) return

  const subs = await db.prepare(
    'SELECT f.token FROM fcm_subscription f JOIN fcm_subscription_topic ft ON ft.subscription_id = f.id WHERE ft.topic = ?'
  ).bind(topic).all()

  if (!subs.results || subs.results.length === 0) return

  const title = msg.title || 'ntfy'
  const body = msg.message || ''
  const tag = msg.tags?.join(',') || ''

  for (const row of subs.results) {
    const token = (row as any).token as string
    try {
      await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${fcmServerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          priority: 'high',
          notification: {
            title,
            body,
            tag: topic,
            click_action: msg.click || undefined,
          },
          data: {
            topic,
            id: msg.id,
            time: String(msg.time),
            priority: String(msg.priority || 3),
            tags: tag,
            click: msg.click || '',
            icon: msg.icon || '',
            title,
            message: body,
          },
        }),
      })
    } catch {}
  }
}
