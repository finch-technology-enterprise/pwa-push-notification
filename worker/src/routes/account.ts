import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import {
  authenticate, requireAuth, hashPassword, verifyPassword,
  generateToken, generateId, nowUnix,
} from '../middleware'
import { initDatabase } from '../db'
import { sendEmail } from './email'
import { checkAuthRateLimit, recordAuthFailure } from './rateLimit'

const app = new Hono<Env>()

app.post('/account', async (c) => {
  const { DB, ENABLE_SIGNUP } = env(c)
  await initDatabase(DB)

  if (ENABLE_SIGNUP === 'false') {
    return c.json({
      code: 40301, http_code: 403, error: 'Sign-up is disabled', link: 'https://docs.ntfy.sh',
    }, 403)
  }

  const body = await c.req.json<any>()
  const username = body.user || body.username
  if (!username || !body.password) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user or password', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  if (username.length < 3 || username.length > 64) {
    return c.json({
      code: 40001, http_code: 400, error: 'Username must be between 3 and 64 characters', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  if (body.password.length < 6) {
    return c.json({
      code: 40001, http_code: 400, error: 'Password must be at least 6 characters', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const existing = await DB.prepare('SELECT id FROM user WHERE user_name = ?').bind(username).first()
  if (existing) {
    return c.json({
      code: 40901, http_code: 409, error: 'Username already taken', link: 'https://docs.ntfy.sh',
    }, 409)
  }

  const userId = generateId()
  const passHash = await hashPassword(body.password)
  const now = nowUnix()

  await DB.prepare(
    'INSERT INTO user (id, user_name, pass, role, prefs, sync_topic, provisioned, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, username, passHash, 'user', '{}', '', 0, now).run()

  const token = await generateToken()
  const tokenExpires = now + 86400 * 365

  await DB.prepare(
    'INSERT INTO user_token (user_id, token, label, last_access, last_origin, expires, provisioned) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, token, 'default', now, '', tokenExpires, 0).run()

  return c.json({
    id: userId,
    user: username,
    token,
    role: 'user',
    prefs: {},
    created: now,
  }, 201)
})

app.get('/account', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)

  const auth = await requireAuth(c)

  const user = await DB.prepare(
    'SELECT id, user_name, role, prefs, sync_topic, created FROM user WHERE id = ? AND deleted IS NULL'
  ).bind(auth.userId).first<{ id: string; user_name: string; role: string; prefs: string; sync_topic: string; created: number }>()

  if (!user) {
    return c.json({
      code: 40401, http_code: 404, error: 'User not found', link: 'https://docs.ntfy.sh',
    }, 404)
  }

  const emails = await DB.prepare(
    'SELECT email, is_primary FROM user_email WHERE user_id = ?'
  ).bind(auth.userId).all()

  const phones = await DB.prepare(
    'SELECT phone_number FROM user_phone WHERE user_id = ?'
  ).bind(auth.userId).all()

  return c.json({
    id: user.id,
    user: user.user_name,
    role: user.role,
    prefs: JSON.parse(user.prefs || '{}'),
    sync_topic: user.sync_topic,
    created: user.created,
    emails: emails.results?.map((r: any) => r.email) || [],
    phone_numbers: phones.results?.map((r: any) => r.phone_number) || [],
  })
})

app.delete('/account', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  await DB.prepare('UPDATE user SET deleted = ? WHERE id = ?').bind(nowUnix(), auth.userId).run()

  return c.json({ success: true })
})

app.post('/account/login', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown'
  const rateCheck = await checkAuthRateLimit(DB, ip)
  if (!rateCheck.allowed) {
    return c.json({
      code: 42901, http_code: 429, error: 'Too many login attempts. Try again later.', link: 'https://docs.ntfy.sh',
    }, 429)
  }

  const authHeader = c.req.header('authorization') || c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing Basic auth header', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const decoded = atob(authHeader.slice(6))
  const colonIdx = decoded.indexOf(':')
  if (colonIdx === -1) {
    return c.json({
      code: 40001, http_code: 400, error: 'Invalid auth format', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const loginUser = decoded.substring(0, colonIdx)
  const loginPass = decoded.substring(colonIdx + 1)

  if (!loginUser || !loginPass) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user or password', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const user = await DB.prepare(
    'SELECT id, user_name, pass, role FROM user WHERE user_name = ? AND deleted IS NULL'
  ).bind(loginUser).first<{ id: string; user_name: string; pass: string; role: string }>()

  if (!user) {
    await recordAuthFailure(DB, ip)
    return c.json({
      code: 40101, http_code: 401, error: 'Invalid credentials', link: 'https://docs.ntfy.sh',
    }, 401)
  }

  const valid = await verifyPassword(loginPass, user.pass)
  if (!valid) {
    await recordAuthFailure(DB, ip)
    return c.json({
      code: 40101, http_code: 401, error: 'Invalid credentials', link: 'https://docs.ntfy.sh',
    }, 401)
  }

  const token = await generateToken()
  const now = nowUnix()
  const tokenExpires = now + 86400 * 365

  await DB.prepare(
    'INSERT INTO user_token (user_id, token, label, last_access, last_origin, expires, provisioned) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.id, token, 'web', now, '', tokenExpires, 0).run()

  return c.json({
    token,
    username: user.user_name,
    role: user.role,
    id: user.id,
    last_access: now,
    expires: tokenExpires,
  }, 201)
})

app.post('/account/token', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown'
  const rateCheck = await checkAuthRateLimit(DB, ip)
  if (!rateCheck.allowed) {
    return c.json({
      code: 42901, http_code: 429, error: 'Too many login attempts. Try again later.', link: 'https://docs.ntfy.sh',
    }, 429)
  }

  // Accept credentials from JSON body OR Basic auth header
  let loginUser: string | undefined
  let loginPass: string | undefined
  let label: string | undefined

  try {
    const body = await c.req.json<{ user: string; password: string; label?: string }>()
    loginUser = body.user
    loginPass = body.password
    label = body.label
  } catch {
    // Body is not JSON — try Basic auth header
  }

  if (!loginUser || !loginPass) {
    const authHeader = c.req.header('authorization') || c.req.header('Authorization')
    if (authHeader && authHeader.startsWith('Basic ')) {
      const decoded = atob(authHeader.slice(6))
      const colonIdx = decoded.indexOf(':')
      if (colonIdx !== -1) {
        loginUser = decoded.substring(0, colonIdx)
        loginPass = decoded.substring(colonIdx + 1)
      }
    }
  }

  if (!loginUser || !loginPass) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user or password', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const user = await DB.prepare(
    'SELECT id, user_name, pass, role FROM user WHERE user_name = ? AND deleted IS NULL'
  ).bind(loginUser).first<{ id: string; user_name: string; pass: string; role: string }>()

  if (!user) {
    await recordAuthFailure(DB, ip)
    return c.json({
      code: 40101, http_code: 401, error: 'Invalid credentials', link: 'https://docs.ntfy.sh',
    }, 401)
  }

  const valid = await verifyPassword(loginPass!, user.pass)
  if (!valid) {
    await recordAuthFailure(DB, ip)
    return c.json({
      code: 40101, http_code: 401, error: 'Invalid credentials', link: 'https://docs.ntfy.sh',
    }, 401)
  }

  const token = await generateToken()
  const now = nowUnix()
  const tokenExpires = now + 86400 * 365
  const finalLabel = label || 'web'

  await DB.prepare(
    'INSERT INTO user_token (user_id, token, label, last_access, last_origin, expires, provisioned) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.id, token, finalLabel, now, '', tokenExpires, 0).run()

  return c.json({
    token,
    username: user.user_name,
    role: user.role,
    id: user.id,
    last_access: now,
    expires: tokenExpires,
  }, 201)
})

app.patch('/account/token', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const tokens = await DB.prepare(
    'SELECT user_id, token, label, last_access, last_origin, expires FROM user_token WHERE user_id = ?'
  ).bind(auth.userId).all()

  const now = nowUnix()
  const extended: string[] = []

  for (const t of (tokens.results || []) as any[]) {
    const newExpires = now + 86400 * 365
    await DB.prepare('UPDATE user_token SET expires = ? WHERE user_id = ? AND token = ?')
      .bind(newExpires, auth.userId, t.token).run()
    extended.push(t.token)
  }

  return c.json({ success: true, tokens: extended })
})

app.delete('/account/token', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json().catch(() => ({}))
  const tokenToDelete = body.token || c.req.query('token')

  if (tokenToDelete) {
    await DB.prepare('DELETE FROM user_token WHERE user_id = ? AND token = ?')
      .bind(auth.userId, tokenToDelete).run()
  } else {
    await DB.prepare('DELETE FROM user_token WHERE user_id = ?').bind(auth.userId).run()
  }

  return c.json({ success: true })
})

app.post('/account/password', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<{ current_password: string; new_password: string }>()

  if (!body.current_password || !body.new_password) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing current_password or new_password', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  if (body.new_password.length < 6) {
    return c.json({
      code: 40001, http_code: 400, error: 'Password must be at least 6 characters', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const user = await DB.prepare('SELECT pass FROM user WHERE id = ?').bind(auth.userId).first<{ pass: string }>()
  if (!user) {
    return c.json({
      code: 40401, http_code: 404, error: 'User not found', link: 'https://docs.ntfy.sh',
    }, 404)
  }

  const valid = await verifyPassword(body.current_password, user.pass)
  if (!valid) {
    return c.json({
      code: 40101, http_code: 401, error: 'Current password is incorrect', link: 'https://docs.ntfy.sh',
    }, 401)
  }

  const newHash = await hashPassword(body.new_password)
  await DB.prepare('UPDATE user SET pass = ? WHERE id = ?').bind(newHash, auth.userId).run()

  return c.json({ success: true })
})

app.patch('/account/settings', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<Record<string, unknown>>()

  const user = await DB.prepare('SELECT prefs, sync_topic FROM user WHERE id = ?').bind(auth.userId).first<{ prefs: string; sync_topic: string }>()
  if (!user) {
    return c.json({
      code: 40401, http_code: 404, error: 'User not found', link: 'https://docs.ntfy.sh',
    }, 404)
  }

  const prefs = JSON.parse(user.prefs || '{}')

  if (body.prefs && typeof body.prefs === 'object' && !Array.isArray(body.prefs)) {
    Object.assign(prefs, body.prefs)
  }

  const syncTopic = typeof body.sync_topic === 'string' ? body.sync_topic : user.sync_topic

  await DB.prepare('UPDATE user SET prefs = ?, sync_topic = ? WHERE id = ?')
    .bind(JSON.stringify(prefs), syncTopic, auth.userId).run()

  return c.json({ success: true })
})

app.post('/account/subscription', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<{ topic: string; base_url?: string }>()
  if (!body.topic) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing topic', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  await DB.prepare(
    'INSERT OR IGNORE INTO user_access (user_id, topic, read_access, write_access, owner_user_id, provisioned) VALUES (?, ?, 1, 1, ?, 0)'
  ).bind(auth.userId, body.topic, auth.userId).run()

  return c.json({ success: true, topic: body.topic })
})

app.patch('/account/subscription', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<{ topic: string; read?: boolean; write?: boolean }>()
  if (!body.topic) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing topic', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const read = body.read !== undefined ? (body.read ? 1 : 0) : undefined
  const write = body.write !== undefined ? (body.write ? 1 : 0) : undefined

  if (read === undefined && write === undefined) {
    return c.json({
      code: 40001, http_code: 400, error: 'Nothing to update', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const existing = await DB.prepare(
    'SELECT read_access, write_access FROM user_access WHERE user_id = ? AND topic = ?'
  ).bind(auth.userId, body.topic).first<{ read_access: number; write_access: number }>()

  if (!existing) {
    return c.json({
      code: 40401, http_code: 404, error: 'Subscription not found', link: 'https://docs.ntfy.sh',
    }, 404)
  }

  const newRead = read ?? existing.read_access
  const newWrite = write ?? existing.write_access

  await DB.prepare(
    'UPDATE user_access SET read_access = ?, write_access = ? WHERE user_id = ? AND topic = ?'
  ).bind(newRead, newWrite, auth.userId, body.topic).run()

  return c.json({ success: true, topic: body.topic, read: newRead === 1, write: newWrite === 1 })
})

app.delete('/account/subscription', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const topic = c.req.query('topic')
  if (topic) {
    await DB.prepare('DELETE FROM user_access WHERE user_id = ? AND topic = ?')
      .bind(auth.userId, topic).run()
  }

  return c.json({ success: true })
})

app.post('/account/reservation', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<{ topic: string }>()
  if (!body.topic) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing topic', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const existing = await DB.prepare(
    'SELECT owner_user_id FROM user_access WHERE topic = ? AND owner_user_id IS NOT NULL AND owner_user_id != \'\''
  ).bind(body.topic).first<{ owner_user_id: string }>()

  if (existing) {
    return c.json({
      code: 40901, http_code: 409, error: 'Topic already reserved', link: 'https://docs.ntfy.sh',
    }, 409)
  }

  await DB.prepare(
    `INSERT INTO user_access (user_id, topic, read_access, write_access, owner_user_id, provisioned)
     VALUES (?, ?, 1, 1, ?, 0)
     ON CONFLICT(user_id, topic) DO UPDATE SET owner_user_id = ?, read_access = 1, write_access = 1`
  ).bind(auth.userId, body.topic, auth.userId, auth.userId).run()

  return c.json({ success: true, topic: body.topic })
})

app.delete('/account/reservation', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const topic = c.req.query('topic') || (await c.req.json().catch(() => ({}))).topic
  if (!topic) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing topic', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  await DB.prepare(
    'DELETE FROM user_access WHERE user_id = ? AND topic = ? AND owner_user_id = ?'
  ).bind(auth.userId, topic, auth.userId).run()

  return c.json({ success: true })
})

app.put('/account/phone', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<{ phone_number: string }>()
  if (!body.phone_number) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing phone_number', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  await DB.prepare('INSERT OR IGNORE INTO user_phone (user_id, phone_number) VALUES (?, ?)')
    .bind(auth.userId, body.phone_number).run()

  return c.json({ success: true })
})

app.delete('/account/phone', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const phoneNumber = c.req.query('phone_number') || (await c.req.json().catch(() => ({}))).phone_number
  if (!phoneNumber) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing phone_number', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  await DB.prepare('DELETE FROM user_phone WHERE user_id = ? AND phone_number = ?')
    .bind(auth.userId, phoneNumber).run()

  return c.json({ success: true })
})

app.put('/account/email', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<{ email: string }>()
  if (!body.email) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing email', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const existing = await DB.prepare(
    'SELECT is_primary FROM user_email WHERE user_id = ?'
  ).bind(auth.userId).first<{ is_primary: number }>()

  await DB.prepare('INSERT OR IGNORE INTO user_email (user_id, email, is_primary) VALUES (?, ?, ?)')
    .bind(auth.userId, body.email, existing ? 0 : 1).run()

  return c.json({ success: true })
})

app.delete('/account/email', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const email = c.req.query('email') || (await c.req.json().catch(() => ({}))).email
  if (!email) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing email', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  await DB.prepare('DELETE FROM user_email WHERE user_id = ? AND email = ?')
    .bind(auth.userId, email).run()

  return c.json({ success: true })
})

app.post('/account/email/resend', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<{ email: string }>().catch(() => ({ email: '' }))
  if (!body.email) {
    return c.json({ code: 40001, http_code: 400, error: 'Missing email', link: 'https://docs.ntfy.sh' }, 400)
  }

  const emailRow = await DB.prepare(
    'SELECT email FROM user_email WHERE user_id = ? AND email = ?'
  ).bind(auth.userId, body.email).first<{ email: string }>()

  if (!emailRow) {
    return c.json({ code: 40001, http_code: 400, error: 'Email not found', link: 'https://docs.ntfy.sh' }, 400)
  }

  const rawToken = await generateToken()
  const now = nowUnix()
  const expires = now + 3600

  const tokenHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken))
  const tokenHashHex = Array.from(new Uint8Array(tokenHashBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

  await DB.prepare(
    'INSERT INTO user_magic_link (token_hash, kind, user_id, email, expires, created) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(tokenHashHex, 'email-verify', auth.userId, body.email, expires, now).run()

  return c.json({ success: true, token: rawToken })
})

app.post('/account/email/primary', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const body = await c.req.json<{ email: string }>().catch(() => ({ email: '' }))
  if (!body.email) {
    return c.json({ code: 40001, http_code: 400, error: 'Missing email', link: 'https://docs.ntfy.sh' }, 400)
  }

  const emailRow = await DB.prepare(
    'SELECT is_primary FROM user_email WHERE user_id = ? AND email = ?'
  ).bind(auth.userId, body.email).first<{ is_primary: number }>()

  if (!emailRow) {
    return c.json({ code: 40001, http_code: 400, error: 'Email not found', link: 'https://docs.ntfy.sh' }, 400)
  }

  await DB.prepare('UPDATE user_email SET is_primary = 0 WHERE user_id = ?').bind(auth.userId).run()
  await DB.prepare('UPDATE user_email SET is_primary = 1 WHERE user_id = ? AND email = ?').bind(auth.userId, body.email).run()

  return c.json({ success: true, email: body.email, is_primary: true })
})

app.post('/account/email/verify', async (c) => {
  const { DB, EMAIL, BASE_URL } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)

  const user = await DB.prepare(
    'SELECT user_name FROM user WHERE id = ? AND deleted IS NULL'
  ).bind(auth.userId).first<{ user_name: string }>()

  const emails = await DB.prepare(
    'SELECT email FROM user_email WHERE user_id = ?'
  ).bind(auth.userId).all()

  const emailAddresses = (emails.results || []).map((r: any) => r.email)
  if (emailAddresses.length === 0) {
    return c.json({ code: 40001, http_code: 400, error: 'No email addresses on file', link: 'https://docs.ntfy.sh' }, 400)
  }

  const rawToken = await generateToken()
  const now = nowUnix()
  const expires = now + 3600

  const tokenHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken))
  const tokenHashHex = Array.from(new Uint8Array(tokenHashBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

  await DB.prepare(
    'INSERT INTO user_magic_link (token_hash, kind, user_id, email, expires, created) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(tokenHashHex, 'email-verify', auth.userId, emailAddresses[0], expires, now).run()

  const verifyUrl = `${BASE_URL}/app/verify?token=${rawToken}`
  const userName = user?.user_name || 'User'

  await sendEmail(EMAIL, {
    to: emailAddresses[0],
    from: { email: 'notify@finchtech.my', name: 'PWA Push Notification' },
    subject: 'Verify your email address',
    text: `Hi ${userName},\n\nPlease verify your email address by clicking this link:\n${verifyUrl}\n\nThis link expires in 1 hour.\n\n- PWA Push`,
    html: `<h2>Verify your email</h2><p>Hi ${userName},</p><p>Please verify your email address by clicking the button below:</p><p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#088f8f;color:#fff;text-decoration:none;border-radius:4px">Verify Email</a></p><p>This link expires in 1 hour.</p>`,
  })

  return c.json({ success: true })
})

app.post('/account/password/reset/request', async (c) => {
  const { DB, BASE_URL } = env(c)
  await initDatabase(DB)

  const body = await c.req.json<{ username: string }>()
  if (!body.username) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing username', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const user = await DB.prepare(
    'SELECT id, user_name FROM user WHERE user_name = ? AND deleted IS NULL'
  ).bind(body.username).first<{ id: string; user_name: string }>()

  if (user) {
    const rawToken = await generateToken()
    const now = nowUnix()
    const expires = now + 3600

    const tokenHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken))
    const tokenHashHex = Array.from(new Uint8Array(tokenHashBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

    await DB.prepare(
      'INSERT INTO user_magic_link (token_hash, kind, user_id, email, expires, created) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(tokenHashHex, 'password-reset', user.id, '', expires, now).run()

    const resetUrl = `${BASE_URL}/account/password/reset/${rawToken}`

    return c.json({
      success: true,
      token: rawToken,
      reset_url: resetUrl,
      expires,
    })
  }

  return c.json({ success: true })
})

app.post('/account/password/reset', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)

  const body = await c.req.json<{ token: string; password: string }>()
  if (!body.token || !body.password) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing token or password', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  if (body.password.length < 6) {
    return c.json({
      code: 40001, http_code: 400, error: 'Password must be at least 6 characters', link: 'https://docs.ntfy.sh',
    }, 400)
  }

  const tokenHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.token))
  const tokenHashHex = Array.from(new Uint8Array(tokenHashBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

  const link = await DB.prepare(
    'SELECT user_id FROM user_magic_link WHERE token_hash = ? AND kind = ? AND expires > ?'
  ).bind(tokenHashHex, 'password-reset', nowUnix()).first<{ user_id: string }>()

  if (!link) {
    return c.json({
      code: 40101, http_code: 401, error: 'Invalid or expired token', link: 'https://docs.ntfy.sh',
    }, 401)
  }

  const newHash = await hashPassword(body.password)
  await DB.prepare('UPDATE user SET pass = ? WHERE id = ?').bind(newHash, link.user_id).run()
  await DB.prepare('DELETE FROM user_magic_link WHERE token_hash = ?').bind(tokenHashHex).run()

  return c.json({ success: true })
})

// FCM subscription registration (for Android push notifications)
app.post('/account/fcm', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)
  const body = await c.req.json<{ token: string; topics: string[] }>().catch(() => ({ token: '', topics: [] }))

  if (!body.token) {
    return c.json({ code: 40001, http_code: 400, error: 'Missing FCM token', link: 'https://docs.ntfy.sh' }, 400)
  }

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown'
  const subId = generateId()
  const now = nowUnix()

  await DB.prepare(
    'INSERT OR REPLACE INTO fcm_subscription (id, token, user_id, subscriber_ip, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(subId, body.token, auth.userId, ip, now).run()

  if (body.topics?.length) {
    for (const topic of body.topics) {
      await DB.prepare(
        'INSERT OR IGNORE INTO fcm_subscription_topic (subscription_id, topic) VALUES (?, ?)'
      ).bind(subId, topic).run()
    }
  }

  return c.json({ success: true, id: subId }, 201)
})

app.delete('/account/fcm', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  const auth = await requireAuth(c)
  const body = await c.req.json<{ token?: string }>().catch(() => ({ token: '' }))

  if (body.token && body.token.length > 0) {
    const sub = await DB.prepare('SELECT id FROM fcm_subscription WHERE token = ? AND user_id = ?')
      .bind(body.token, auth.userId).first<{ id: string }>()
    if (sub) {
      await DB.prepare('DELETE FROM fcm_subscription_topic WHERE subscription_id = ?').bind(sub.id).run()
      await DB.prepare('DELETE FROM fcm_subscription WHERE id = ?').bind(sub.id).run()
    }
  }
  return c.json({ success: true })
})

export { app as accountRoutes }
