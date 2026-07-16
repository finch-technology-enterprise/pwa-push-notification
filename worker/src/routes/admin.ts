import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { requireAdmin, hashPassword, generateId, nowUnix } from '../middleware'
import { initDatabase } from '../db'

const app = new Hono<Env>()

app.get('/users', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAdmin(c)

  const users = await DB.prepare(
    'SELECT id, user_name, role, prefs, sync_topic, created FROM user WHERE deleted IS NULL ORDER BY created DESC LIMIT 100'
  ).all()

  return c.json({
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
