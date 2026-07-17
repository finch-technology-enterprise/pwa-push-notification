import { Hono } from 'hono'
import type { Env } from '../index'
import { env } from 'hono/adapter'
import { initDatabase } from '../db'
import { authenticate } from '../middleware'

const app = new Hono<Env>()

// Matrix push gateway discovery
app.get('/_matrix/push/v1/notify', (c) => {
  const { BASE_URL } = env(c)
  return c.json({
    unifiedpush: { version: 1 },
    'org.matrix.msc4141': {},
    notification: {
      url: `${BASE_URL || 'https://pwa-push-notification.finchtech-my.workers.dev'}/_matrix/push/v1/notify`,
    },
  })
})

// Matrix push gateway notification
app.post('/_matrix/push/v1/notify', async (c) => {
  const { DB, TOPIC_DO } = env(c)
  await initDatabase(DB)

  const auth = await authenticate(c)
  const body = await c.req.json<any>().catch(() => ({}))

  const notification = body.notification
  const deviceId = body.device_id || body.pushkey || 'matrix'
  const eventId = notification?.event_id || body.event_id || generateMatrixId()
  const roomId = notification?.room_id || body.room_id || 'matrix'
  const sender = notification?.sender_name || notification?.sender || 'matrix'
  const content = notification?.content?.body || notification?.content?.text || 'Matrix notification'
  const topic = `matrix-${deviceId}`

  const now = Math.floor(Date.now() / 1000)
  const id = generateMatrixId()
  const seqId = `${now.toString(36)}${Math.random().toString(36).substring(2, 6)}`

  await DB.prepare(
    `INSERT INTO messages (id, sequence_id, time, event, expires, topic, message, title, priority, tags, click, icon, actions, sender, user_id, content_type, encoding, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, seqId, now, 'message', 0, topic, content,
    `Matrix: ${roomId}`, 3, '', '', '', '[]',
    sender, auth.userId, '', '', 1
  ).run()

  const publishMsg = {
    id, sequence_id: seqId, time: now, event: 'message' as const, topic,
    title: `Matrix: ${roomId}`, message: content,
    priority: 3 as const,
  }

  try {
    const doId = TOPIC_DO.idFromName(topic)
    const stub = TOPIC_DO.get(doId)
    await stub.fetch(`http://do/publish?topic=${topic}`, {
      method: 'POST', body: JSON.stringify(publishMsg),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {}

  return c.json({
    notification: {},
    'org.matrix.msc4141': {},
  })
})

function generateMatrixId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

export { app as matrixRoutes }
