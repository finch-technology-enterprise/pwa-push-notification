import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { requireAdmin, hashPassword, generateId, nowUnix } from '../middleware'
import { initDatabase } from '../db'

const app = new Hono<Env>()

app.get('/users', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAdmin(c)

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)))
  const offset = (page - 1) * limit

  const countResult = await DB.prepare(
    'SELECT COUNT(*) as total FROM user WHERE deleted IS NULL'
  ).first<{ total: number }>()
  const total = countResult?.total ?? 0

  const users = await DB.prepare(
    'SELECT id, user_name, role, prefs, sync_topic, created FROM user WHERE deleted IS NULL ORDER BY created DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all()

  return c.json({
    total,
    page,
    limit,
    users: (users.results || []).map((u: any) => ({
      id: u.id,
      user: u.user_name,
      role: u.role,
      prefs: JSON.parse(u.prefs || '{}'),
      sync_topic: u.sync_topic,
      created: u.created,
    })),
  })
})

app.get('/users/:id', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAdmin(c)

  const userId = c.req.param('id')
  const user = await DB.prepare(
    'SELECT id, user_name, role, prefs, sync_topic, tier_id, stats_messages, stats_emails, stats_calls, created FROM user WHERE id = ? AND deleted IS NULL'
  ).bind(userId).first<any>()

  if (!user) {
    return c.json({
      code: 40401, http_code: 404, error: 'User not found', link: 'https://ntfy.sh/docs',
    }, 404)
  }

  const emails = await DB.prepare(
    'SELECT email, is_primary FROM user_email WHERE user_id = ?'
  ).bind(userId).all()

  const phones = await DB.prepare(
    'SELECT phone_number FROM user_phone WHERE user_id = ?'
  ).bind(userId).all()

  const tokens = await DB.prepare(
    'SELECT token, label, last_access, last_origin, expires FROM user_token WHERE user_id = ?'
  ).bind(userId).all()

  const access = await DB.prepare(
    'SELECT topic, read_access, write_access, owner_user_id FROM user_access WHERE user_id = ?'
  ).bind(userId).all()

  return c.json({
    id: user.id,
    user: user.user_name,
    role: user.role,
    prefs: JSON.parse(user.prefs || '{}'),
    sync_topic: user.sync_topic,
    tier_id: user.tier_id,
    stats: {
      messages: user.stats_messages,
      emails: user.stats_emails,
      calls: user.stats_calls,
    },
    created: user.created,
    emails: (emails.results || []).map((r: any) => ({ email: r.email, primary: r.is_primary === 1 })),
    phone_numbers: (phones.results || []).map((r: any) => r.phone_number),
    tokens: (tokens.results || []).map((r: any) => ({
      label: r.label, last_access: r.last_access, last_origin: r.last_origin, expires: r.expires,
    })),
    access: (access.results || []).map((r: any) => ({
      topic: r.topic, read: r.read_access === 1, write: r.write_access === 1, owner: r.owner_user_id,
    })),
  })
})

app.post('/users', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAdmin(c)

  const body = await c.req.json<{ user: string; password: string; role?: string }>()

  if (!body.user || !body.password) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user or password', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const existing = await DB.prepare('SELECT id FROM user WHERE user_name = ?').bind(body.user).first()
  if (existing) {
    return c.json({
      code: 40901, http_code: 409, error: 'Username already taken', link: 'https://ntfy.sh/docs',
    }, 409)
  }

  const userId = generateId()
  const passHash = await hashPassword(body.password)
  const now = nowUnix()
  const role = body.role === 'admin' ? 'admin' : 'user'

  await DB.prepare(
    'INSERT INTO user (id, user_name, pass, role, prefs, sync_topic, provisioned, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, body.user, passHash, role, '{}', '', 1, now).run()

  return c.json({
    id: userId,
    user: body.user,
    role,
    created: now,
  }, 201)
})

app.delete('/users', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAdmin(c)

  const userId = c.req.query('user_id') || (await c.req.json().catch(() => ({}))).user_id
  if (!userId) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user_id', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  await DB.prepare('UPDATE user SET deleted = ? WHERE id = ?').bind(nowUnix(), userId).run()

  return c.json({ success: true })
})

app.put('/users/access', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAdmin(c)

  const body = await c.req.json<{
    user_id: string
    topic: string
    read?: boolean
    write?: boolean
  }>()

  if (!body.user_id || !body.topic) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user_id or topic', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  await DB.prepare(
    `INSERT INTO user_access (user_id, topic, read_access, write_access, owner_user_id, provisioned)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, topic) DO UPDATE SET read_access = ?, write_access = ?`
  ).bind(
    body.user_id, body.topic, body.read ? 1 : 0, body.write ? 1 : 0, '', 1,
    body.read ? 1 : 0, body.write ? 1 : 0
  ).run()

  return c.json({ success: true })
})

app.delete('/users/access', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAdmin(c)

  const body = await c.req.json().catch(() => ({}))
  const userId = body.user_id || c.req.query('user_id')
  const topic = body.topic || c.req.query('topic')

  if (!userId || !topic) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user_id or topic', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  await DB.prepare('DELETE FROM user_access WHERE user_id = ? AND topic = ?').bind(userId, topic).run()

  return c.json({ success: true })
})

export { app as adminRoutes }
