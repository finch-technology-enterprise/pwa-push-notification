import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { authenticate, generateId, nowUnix } from '../middleware'
import { initDatabase } from '../db'
import { checkSubscriptionLimit } from './rateLimit'

const app = new Hono<Env>()

app.post('/webpush', async (c) => {
  const { DB, VISITOR_SUBSCRIPTION_LIMIT } = env(c)
  await initDatabase(DB)

  const auth = await authenticate(c)
  const body = await c.req.json<{
    endpoint: string
    key_auth: string
    key_p256dh: string
    topics?: string[]
  }>()

  if (!body.endpoint || !body.key_auth || !body.key_p256dh) {
    return c.json({
      code: 40001,
      http_code: 400,
      error: 'Missing required fields: endpoint, key_auth, key_p256dh',
      link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'

  const subResult = await checkSubscriptionLimit(DB, clientIp, VISITOR_SUBSCRIPTION_LIMIT || '30')
  if (!subResult.allowed) {
    return c.json({
      code: 40303,
      http_code: 403,
      error: subResult.error!,
      link: 'https://ntfy.sh/docs',
    }, 403)
  }

  const existing = await DB.prepare(
    'SELECT id FROM webpush_subscription WHERE endpoint = ?'
  ).bind(body.endpoint).first<{ id: string }>()

  let subId: string

  if (existing) {
    subId = existing.id
    await DB.prepare(
      'UPDATE webpush_subscription SET key_auth = ?, key_p256dh = ?, subscriber_ip = ?, updated_at = ? WHERE id = ?'
    ).bind(body.key_auth, body.key_p256dh, clientIp, nowUnix(), subId).run()
  } else {
    subId = generateId()
    await DB.prepare(
      `INSERT INTO webpush_subscription (id, endpoint, key_auth, key_p256dh, user_id, subscriber_ip, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(subId, body.endpoint, body.key_auth, body.key_p256dh, auth.userId, clientIp, nowUnix()).run()
  }

  if (body.topics && body.topics.length > 0) {
    await DB.prepare('DELETE FROM webpush_subscription_topic WHERE subscription_id = ?').bind(subId).run()
    for (const topic of body.topics) {
      await DB.prepare(
        'INSERT OR IGNORE INTO webpush_subscription_topic (subscription_id, topic) VALUES (?, ?)'
      ).bind(subId, topic).run()
    }
  }

  return c.json({
    success: true,
    id: subId,
    endpoint: body.endpoint,
  })
})

app.put('/webpush', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)

  const auth = await authenticate(c)
  const body = await c.req.json<{
    endpoint?: string
    id?: string
    topics?: string[]
  }>()

  let subId: string | undefined
  if (body.id) {
    const row = await DB.prepare('SELECT id FROM webpush_subscription WHERE id = ?').bind(body.id).first<{ id: string }>()
    subId = row?.id
  } else if (body.endpoint) {
    const row = await DB.prepare('SELECT id FROM webpush_subscription WHERE endpoint = ?').bind(body.endpoint).first<{ id: string }>()
    subId = row?.id
  }

  if (!subId) {
    return c.json({
      code: 40401, http_code: 404, error: 'Subscription not found', link: 'https://ntfy.sh/docs',
    }, 404)
  }

  if (body.topics && body.topics.length > 0) {
    await DB.prepare('DELETE FROM webpush_subscription_topic WHERE subscription_id = ?').bind(subId).run()
    for (const topic of body.topics) {
      await DB.prepare(
        'INSERT OR IGNORE INTO webpush_subscription_topic (subscription_id, topic) VALUES (?, ?)'
      ).bind(subId, topic).run()
    }
  }

  return c.json({ success: true, id: subId })
})

app.delete('/webpush', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)

  const endpoint = c.req.query('endpoint')
  const id = c.req.query('id')

  if (endpoint) {
    await DB.prepare('DELETE FROM webpush_subscription WHERE endpoint = ?').bind(endpoint).run()
  } else if (id) {
    await DB.prepare('DELETE FROM webpush_subscription WHERE id = ?').bind(id).run()
  } else {
    return c.json({
      code: 40001,
      http_code: 400,
      error: 'Missing endpoint or id parameter',
      link: 'https://ntfy.sh/docs',
    }, 400)
  }

  return c.json({ success: true })
})

export { app as webpushRoutes }
