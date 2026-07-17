import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import {
  authenticate, requireAuth, hashPassword, generateToken,
  generateId, nowUnix,
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
      code: 40301, http_code: 403, error: 'Sign-up is disabled', link: 'https://ntfy.sh/docs',
    }, 403)
  }

  const body = await c.req.json<any>()
  const username = body.user || body.username
  if (!username || !body.password) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user or password', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  if (username.length < 3 || username.length > 64) {
    return c.json({
      code: 40001, http_code: 400, error: 'Username must be between 3 and 64 characters', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  if (body.password.length < 6) {
    return c.json({
      code: 40001, http_code: 400, error: 'Password must be at least 6 characters', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const existing = await DB.prepare('SELECT id FROM user WHERE user_name = ?').bind(username).first()
  if (existing) {
    return c.json({
      code: 40901, http_code: 409, error: 'Username already taken', link: 'https://ntfy.sh/docs',
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
      code: 40401, http_code: 404, error: 'User not found', link: 'https://ntfy.sh/docs',
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

app.post('/account/token', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown'
  const rateCheck = await checkAuthRateLimit(DB, ip)
  if (!rateCheck.allowed) {
    return c.json({
      code: 42901, http_code: 429, error: 'Too many login attempts. Try again later.', link: 'https://ntfy.sh/docs',
    }, 429)
  }

  const body = await c.req.json<{ user: string; password: string; label?: string }>()

  if (!body.user || !body.password) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing user or password', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const user = await DB.prepare(
    'SELECT id, user_name, pass, role FROM user WHERE user_name = ? AND deleted IS NULL'
  ).bind(body.user).first<{ id: string; user_name: string; pass: string; role: string }>()

  if (!user) {
    await recordAuthFailure(DB, ip)
    return c.json({
      code: 40101, http_code: 401, error: 'Invalid credentials', link: 'https://ntfy.sh/docs',
    }, 401)
  }

  const valid = await verifyPassword(body.password, user.pass)
  if (!valid) {
    await recordAuthFailure(DB, ip)
    return c.json({
      code: 40101, http_code: 401, error: 'Invalid credentials', link: 'https://ntfy.sh/docs',
    }, 401)
  }

  const token = await generateToken()
  const now = nowUnix()
  const tokenExpires = now + 86400 * 365
  const label = body.label || 'web'

  await DB.prepare(
    'INSERT INTO user_token (user_id, token, label, last_access, last_origin, expires, provisioned) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.id, token, label, now, '', tokenExpires, 0).run()

  return c.json({
    token,
    user: user.user_name,
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
      code: 40001, http_code: 400, error: 'Missing current_password or new_password', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  if (body.new_password.length < 6) {
    return c.json({
      code: 40001, http_code: 400, error: 'Password must be at least 6 characters', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const user = await DB.prepare('SELECT pass FROM user WHERE id = ?').bind(auth.userId).first<{ pass: string }>()
  if (!user) {
    return c.json({
      code: 40401, http_code: 404, error: 'User not found', link: 'https://ntfy.sh/docs',
    }, 404)
  }

  const valid = await verifyPassword(body.current_password, user.pass)
  if (!valid) {
    return c.json({
      code: 40101, http_code: 401, error: 'Current password is incorrect', link: 'https://ntfy.sh/docs',
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
      code: 40401, http_code: 404, error: 'User not found', link: 'https://ntfy.sh/docs',
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
      code: 40001, http_code: 400, error: 'Missing topic', link: 'https://ntfy.sh/docs',
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
      code: 40001, http_code: 400, error: 'Missing topic', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const read = body.read !== undefined ? (body.read ? 1 : 0) : undefined
  const write = body.write !== undefined ? (body.write ? 1 : 0) : undefined

  if (read === undefined && write === undefined) {
    return c.json({
      code: 40001, http_code: 400, error: 'Nothing to update', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const existing = await DB.prepare(
    'SELECT read_access, write_access FROM user_access WHERE user_id = ? AND topic = ?'
  ).bind(auth.userId, body.topic).first<{ read_access: number; write_access: number }>()

  if (!existing) {
    return c.json({
      code: 40401, http_code: 404, error: 'Subscription not found', link: 'https://ntfy.sh/docs',
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
      code: 40001, http_code: 400, error: 'Missing topic', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const existing = await DB.prepare(
    'SELECT owner_user_id FROM user_access WHERE topic = ? AND owner_user_id IS NOT NULL AND owner_user_id != \'\''
  ).bind(body.topic).first<{ owner_user_id: string }>()

  if (existing) {
    return c.json({
      code: 40901, http_code: 409, error: 'Topic already reserved', link: 'https://ntfy.sh/docs',
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
      code: 40001, http_code: 400, error: 'Missing topic', link: 'https://ntfy.sh/docs',
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
      code: 40001, http_code: 400, error: 'Missing phone_number', link: 'https://ntfy.sh/docs',
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
      code: 40001, http_code: 400, error: 'Missing phone_number', link: 'https://ntfy.sh/docs',
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
      code: 40001, http_code: 400, error: 'Missing email', link: 'https://ntfy.sh/docs',
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
      code: 40001, http_code: 400, error: 'Missing email', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  await DB.prepare('DELETE FROM user_email WHERE user_id = ? AND email = ?')
    .bind(auth.userId, email).run()

  return c.json({ success: true })
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
    return c.json({ code: 40001, http_code: 400, error: 'No email addresses on file', link: 'https://ntfy.sh/docs' }, 400)
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
    from: { email: 'notify@finchtech.my', name: 'ntfy' },
    subject: 'Verify your email address',
    text: `Hi ${userName},\n\nPlease verify your email address by clicking this link:\n${verifyUrl}\n\nThis link expires in 1 hour.\n\n- ntfy`,
    html: `<h2>Verify your email</h2><p>Hi ${userName},</p><p>Please verify your email address by clicking the button below:</p><p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#088f8f;color:#fff;text-decoration:none;border-radius:4px">Verify Email</a></p><p>This link expires in 1 hour.</p>`,
  })

  return c.json({ success: true })
})

app.post('/account/password/reset/request', async (c) => {
  const { DB, EMAIL, BASE_URL } = env(c)
  await initDatabase(DB)

  const body = await c.req.json<{ email: string }>()
  if (!body.email) {
    return c.json({
      code: 40001, http_code: 400, error: 'Missing email', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const userEmail = await DB.prepare(
    'SELECT u.id, u.user_name FROM user u JOIN user_email e ON e.user_id = u.id WHERE e.email = ? AND u.deleted IS NULL'
  ).bind(body.email).first<{ id: string; user_name: string }>()

  if (userEmail) {
    const rawToken = await generateToken()
    const now = nowUnix()
    const expires = now + 3600

    const tokenHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken))
    const tokenHashHex = Array.from(new Uint8Array(tokenHashBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

    await DB.prepare(
      'INSERT INTO user_magic_link (token_hash, kind, user_id, email, expires, created) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(tokenHashHex, 'password-reset', userEmail.id, body.email, expires, now).run()

    const resetUrl = `${BASE_URL}/app/password-reset?token=${rawToken}`

    await sendEmail(EMAIL, {
      to: body.email,
      from: { email: 'notify@finchtech.my', name: 'ntfy' },
      subject: 'Reset your password',
      text: `Hi ${userEmail.user_name},\n\nYou requested a password reset. Click this link to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.\nIf you didn't request this, you can ignore this email.\n\n- ntfy`,
      html: `<h2>Password Reset</h2><p>Hi ${userEmail.user_name},</p><p>You requested a password reset. Click the button below to reset your password:</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#088f8f;color:#fff;text-decoration:none;border-radius:4px">Reset Password</a></p><p>This link expires in 1 hour.</p><p>If you didn't request this, you can ignore this email.</p>`,
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
      code: 40001, http_code: 400, error: 'Missing token or password', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  if (body.password.length < 6) {
    return c.json({
      code: 40001, http_code: 400, error: 'Password must be at least 6 characters', link: 'https://ntfy.sh/docs',
    }, 400)
  }

  const tokenHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.token))
  const tokenHashHex = Array.from(new Uint8Array(tokenHashBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

  const link = await DB.prepare(
    'SELECT user_id FROM user_magic_link WHERE token_hash = ? AND kind = ? AND expires > ?'
  ).bind(tokenHashHex, 'password-reset', nowUnix()).first<{ user_id: string }>()

  if (!link) {
    return c.json({
      code: 40101, http_code: 401, error: 'Invalid or expired token', link: 'https://ntfy.sh/docs',
    }, 401)
  }

  const newHash = await hashPassword(body.password)
  await DB.prepare('UPDATE user SET pass = ? WHERE id = ?').bind(newHash, link.user_id).run()
  await DB.prepare('DELETE FROM user_magic_link WHERE token_hash = ?').bind(tokenHashHex).run()

  return c.json({ success: true })
})

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('$')
  const algo = parts[0]
  const iterations64 = parts[1]
  const salt64 = parts[2]
  const hash64 = parts[3]
  if (!algo || !iterations64 || !salt64 || !hash64) return false
  if (algo !== 'scrypt' && algo !== 'pbkdf2') return false
  const iterations = parseInt(atob(iterations64), 10)
  const salt = Uint8Array.from(atob(salt64), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256
  )
  const expectedBytes = Uint8Array.from(atob(hash64), c => c.charCodeAt(0))
  const derivedBytes = new Uint8Array(derived)
  return derivedBytes.length === expectedBytes.length && derivedBytes.every((b, i) => b === expectedBytes[i])
}

export { app as accountRoutes }
