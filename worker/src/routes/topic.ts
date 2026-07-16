import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { authenticate, generateId, generateSequenceId, nowUnix, parseTags, parseActions } from '../middleware'
import { initDatabase, incrementMessages } from '../db'
import { TOPIC_REGEX, DISALLOWED_TOPICS_DEFAULT } from '../types'
import type { PublishMessage } from '../types'

const app = new Hono<Env>()

app.put('/:topic', handlePublish)
app.post('/:topic', handlePublish)

app.get('/:topic/json', handleSubscribe)
app.get('/:topic/sse', handleSubscribe)
app.get('/:topic/raw', handleSubscribe)
app.get('/:topic/ws', handleSubscribe)
app.get('/:topic/auth', handleAuth)

async function handlePublish(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string
  const { DB, TOPIC_DO, DISALLOWED_TOPICS, MESSAGE_SIZE_LIMIT, VISITOR_MESSAGE_DAILY_LIMIT } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://ntfy.sh/docs' }, 400)
  }

  const disallowed = (DISALLOWED_TOPICS || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  if (disallowed.length === 0) disallowed.push(...DISALLOWED_TOPICS_DEFAULT)
  if (disallowed.includes(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Disallowed topic', link: 'https://ntfy.sh/docs' }, 400)
  }

  const auth = await authenticate(c)

  const dailyLimit = parseInt(VISITOR_MESSAGE_DAILY_LIMIT || '0', 10)
  if (dailyLimit > 0 && !auth.authenticated) {
    const dayStart = Math.floor(Date.now() / 86400000) * 86400
    const stmt = DB.prepare('SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND time >= ?')
      .bind(auth.userId, dayStart)
    const msgCount = await stmt.first() as { cnt: number } | null
    if (msgCount && msgCount.cnt >= dailyLimit) {
      return c.json({ code: 40303, http_code: 403, error: `Message limit of ${dailyLimit} reached`, link: 'https://ntfy.sh/docs' }, 403)
    }
  }

  const body = await c.req.text().catch(() => '')
  const msgSizeLimit = parseInt(MESSAGE_SIZE_LIMIT || '4096', 10)
  if (body.length > msgSizeLimit) {
    return c.json({ code: 40001, http_code: 400, error: `Message exceeds ${msgSizeLimit} bytes`, link: 'https://ntfy.sh/docs' }, 400)
  }

  const id = generateId()
  const now = nowUnix()
  const seqId = generateSequenceId()
  const title = c.req.header('X-Title') || ''
  const priority = Math.max(1, Math.min(5, parseInt(c.req.header('X-Priority') || '3', 10)))
  const tags = parseTags(c.req.header('X-Tags') || '')
  const click = c.req.header('X-Click') || ''
  const icon = c.req.header('X-Icon') || ''
  const actions = parseActions(c.req.header('X-Actions') || '[]')
  const sendAs = c.req.header('X-Send-As') || ''
  const encoding = c.req.header('X-Encoding') || ''
  const contentType = c.req.header('Content-Type') || ''

  await DB.prepare(
    `INSERT INTO messages (id, sequence_id, time, event, expires, topic, message, title, priority, tags, click, icon, actions, attachment_name, attachment_type, attachment_size, attachment_expires, attachment_url, sender, user_id, content_type, encoding, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, seqId, now, 'message', 0, topic, body || '', title, priority, tags.join(','),
    click, icon, actions, '', '', 0, 0, '', auth.authenticated ? auth.username : '', auth.userId, contentType, encoding, 1
  ).run()

  await incrementMessages(DB)

  const publishMsg: PublishMessage = {
    id, sequence_id: seqId, time: now, event: 'message', topic,
    title: title || undefined, message: body || undefined,
    priority: priority as PublishMessage['priority'],
    tags: tags.length > 0 ? tags : undefined,
    click: click || undefined, icon: icon || undefined,
    actions: actions !== '[]' ? JSON.parse(actions) : undefined,
    content_type: contentType || undefined, encoding: encoding || undefined,
  }

  try {
    const doId = TOPIC_DO.idFromName(topic)
    const stub = TOPIC_DO.get(doId)
    await stub.fetch(`http://do/publish?topic=${topic}`, {
      method: 'POST', body: JSON.stringify(publishMsg),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {}

  try {
    await sendWebPushNotifications(DB, topic, publishMsg)
  } catch {}

  const resp = formatMessageResponse(publishMsg)
  return c.json(resp, 201)
}

async function handleSubscribe(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string
  const { DB, TOPIC_DO, DISALLOWED_TOPICS } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://ntfy.sh/docs' }, 400) as Response
  }

  const disallowed = (DISALLOWED_TOPICS || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  if (disallowed.length === 0) disallowed.push(...DISALLOWED_TOPICS_DEFAULT)
  if (disallowed.includes(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Disallowed topic', link: 'https://ntfy.sh/docs' }, 400) as Response
  }

  const url = new URL(c.req.url)
  const path = url.pathname
  const parts = path.split('/')
  let suffix = 'json'

  const last = parts[parts.length - 1]
  if (last && ['json', 'sse', 'raw', 'ws'].includes(last)) {
    suffix = last
  }

  const since = c.req.query('since') || ''
  const poll = c.req.query('poll') || ''

  const doId = TOPIC_DO.idFromName(topic)
  const stub = TOPIC_DO.get(doId)

  const doUrl = `http://do/${suffix}?topic=${topic}&since=${since}&poll=${poll}`

  if (suffix === 'ws') {
    const doResp = await stub.fetch(doUrl, c.req.raw)
    return doResp
  }

  const doResp = await stub.fetch(doUrl)
  return doResp
}

async function handleAuth(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string
  const { DB } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://ntfy.sh/docs' }, 400) as Response
  }

  const auth = await authenticate(c)
  const accessStmt = DB.prepare(
    'SELECT read_access, write_access FROM user_access WHERE user_id = ? AND topic = ?'
  ).bind(auth.userId, topic)
  const access = await accessStmt.first() as { read_access: number; write_access: number } | null

  return c.json({
    topic, authenticated: auth.authenticated, user: auth.username,
    read: access ? access.read_access === 1 : true,
    write: access ? access.write_access === 1 : true,
  }) as Response
}

async function sendWebPushNotifications(
  db: D1Database,
  topic: string,
  msg: PublishMessage
): Promise<void> {
  const subs = await db.prepare(
    `SELECT s.endpoint, s.key_auth, s.key_p256dh
     FROM webpush_subscription s
     JOIN webpush_subscription_topic st ON st.subscription_id = s.id
     WHERE st.topic = ?`
  ).bind(topic).all()

  if (!subs.results || subs.results.length === 0) return

  const payload = JSON.stringify(msg)

  for (const sub of subs.results) {
    try {
      const endpoint = sub.endpoint as string
      const keyAuth = sub.key_auth as string
      const keyP256dh = sub.key_p256dh as string

      const ciphertext = await webPushEncrypt(payload, keyP256dh, keyAuth)

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'TTL': '86400',
        },
        body: ciphertext,
      })
    } catch {
    }
  }
}

async function webPushEncrypt(
  payload: string,
  clientPublicKey: string,
  authSecret: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder()

  const clientKeyBin = base64UrlToBin(clientPublicKey)
  const authSecretBin = base64UrlToBin(authSecret)

  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  ) as unknown as { publicKey: CryptoKey; privateKey: CryptoKey }

  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer
  )

  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientKeyBin.buffer.slice(0) as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  )

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientKey } as any,
      kp.privateKey,
      256
    ) as ArrayBuffer
  )

  const salt = crypto.getRandomValues(new Uint8Array(16))

  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0')
  const prk = await hkdf(
    sharedSecret.buffer.slice(0) as ArrayBuffer,
    authSecretBin.buffer.slice(0) as ArrayBuffer,
    authInfo,
    32
  )
  const emptySalt = new Uint8Array(0).buffer as ArrayBuffer
  const cekInfo = buildInfo('aes128gcm', clientKeyBin, serverPublicKey)
  const cek = await hkdf(prk.buffer.slice(0) as ArrayBuffer, emptySalt, cekInfo, 16)
  const nonceInfo = buildInfo('nonce', clientKeyBin, serverPublicKey)
  const nonce = await hkdf(prk.buffer.slice(0) as ArrayBuffer, emptySalt, nonceInfo, 12)

  const plaintext = encoder.encode(payload)
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aesKey,
      plaintext
    ) as ArrayBuffer
  )

  const result = new Uint8Array(16 + 4 + 65 + encrypted.byteLength)
  result.set(salt, 0)
  result.set(new Uint8Array(4), 16)
  result.set(serverPublicKey, 20)
  result.set(encrypted, 85)

  return result
}

async function hkdf(
  ikm: ArrayBuffer,
  salt: ArrayBuffer,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const saltKey = await crypto.subtle.importKey(
    'raw', salt,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )

  const prk = await crypto.subtle.sign('HMAC', saltKey, ikm)

  const infoKey = await crypto.subtle.importKey(
    'raw', prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )

  const result = new Uint8Array(length)
  let current = new Uint8Array(0)
  let counter = 0

  while ((counter * 32) < length) {
    counter++
    const input = new Uint8Array(current.length + info.length + 1)
    input.set(current, 0)
    input.set(info, current.length)
    input[input.length - 1] = counter

    current = new Uint8Array(
      await crypto.subtle.sign('HMAC', infoKey, input) as ArrayBuffer
    )
    const start = (counter - 1) * 32
    for (let i = 0; i < 32 && (start + i) < length; i++) {
      result[start + i] = current[i]!
    }
  }

  return result
}

function buildInfo(type: string, clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder()
  const prefix = encoder.encode(`Content-Encoding: ${type}\0P-256\0`)
  const result = new Uint8Array(prefix.length + 2 + serverKey.length + 2 + clientKey.length)
  let offset = 0
  result.set(prefix, offset)
  offset += prefix.length
  result.set([0, 65], offset)
  offset += 2
  result.set(serverKey, offset)
  offset += serverKey.length
  result.set([0, 65], offset)
  offset += 2
  result.set(clientKey, offset)
  return result
}

function base64UrlToBin(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - base64.length % 4)
  const decoded = atob(base64 + padding)
  return Uint8Array.from(decoded, c => c.charCodeAt(0))
}

function formatMessageResponse(msg: PublishMessage): Record<string, unknown> {
  return {
    id: msg.id, time: msg.time, event: msg.event, topic: msg.topic,
    message: msg.message || null, title: msg.title || null,
    priority: msg.priority || 3, tags: msg.tags || [],
    click: msg.click || null, icon: msg.icon || null,
    actions: msg.actions || [],
  }
}

export { app as topicRoutes }
