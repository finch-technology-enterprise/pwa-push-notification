import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { generateId, nowUnix, parseTags, parseActions, authenticate } from '../middleware'
import { initDatabase, incrementMessages } from '../db'
import type { PublishMessage } from '../types'
import { checkAttachmentTotalLimit } from './rateLimit'

const app = new Hono<Env>()

app.put('/file/:id/:filename', handleFileUpload)
app.post('/file/:id/:filename', handleFileUpload)
app.get('/file/:id/:filename', handleFileDownload)

async function handleFileUpload(c: any): Promise<Response> {
  const { DB, TOPIC_DO, BASE_URL, ATTACHMENTS, ATTACHMENT_FILE_SIZE_LIMIT, ATTACHMENT_TOTAL_SIZE_LIMIT } = env(c)
  await initDatabase(DB)

  const topic = c.req.query('topic')
  if (!topic) {
    return c.json({ code: 40001, http_code: 400, error: 'Missing topic query parameter', link: 'https://ntfy.sh/docs' }, 400)
  }

  const auth = await authenticate(c)
  const filename = c.req.param('filename') || 'file'
  const id = c.req.param('id') || generateId()

  const bodyBlob = await c.req.blob().catch(() => new Blob())
  const bodyBytes = new Uint8Array(await bodyBlob.arrayBuffer())

  const fileSizeLimit = parseInt(ATTACHMENT_FILE_SIZE_LIMIT || '10485760', 10)
  if (bodyBytes.length > fileSizeLimit) {
    return c.json({ code: 40001, http_code: 400, error: `File exceeds ${fileSizeLimit} bytes`, link: 'https://ntfy.sh/docs' }, 400)
  }

  const totalResult = await checkAttachmentTotalLimit(DB, auth.userId, bodyBytes.length, ATTACHMENT_TOTAL_SIZE_LIMIT || '52428800')
  if (!totalResult.allowed) {
    return c.json({ code: 40303, http_code: 403, error: totalResult.error!, link: 'https://ntfy.sh/docs' }, 403)
  }

  const contentType = bodyBlob.type || c.req.header('Content-Type') || 'application/octet-stream'

  await ATTACHMENTS.put(`attachments/${id}/${filename}`, bodyBlob, {
    customMetadata: {
      topic,
      contentType,
      userId: auth.userId,
    },
  })

  const now = nowUnix()
  const attachExpires = now + 86400 * 7

  const url = `${BASE_URL}/file/${id}/${encodeURIComponent(filename)}`
  const msgId = generateId()

  const publishMsg: PublishMessage = {
    id: msgId,
    sequence_id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    time: now,
    event: 'message',
    topic,
    attachment: {
      name: filename,
      type: contentType,
      size: bodyBytes.length,
      expires: attachExpires,
      url,
    },
  }

  await DB.prepare(
    `INSERT INTO messages (id, sequence_id, time, event, expires, topic, message, title, priority, tags, click, icon, actions, attachment_name, attachment_type, attachment_size, attachment_expires, attachment_url, sender, user_id, content_type, encoding, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    msgId, publishMsg.sequence_id, now, 'message', 0, topic, '',
    '', 3, '', '', '', '[]',
    filename, contentType, bodyBytes.length, attachExpires, url,
    auth.authenticated ? auth.username : '', auth.userId, contentType, '', 1,
  ).run()

  await incrementMessages(DB)

  try {
    const doId = TOPIC_DO.idFromName(topic)
    const stub = TOPIC_DO.get(doId)
    await stub.fetch(`http://do/publish?topic=${topic}`, {
      method: 'POST', body: JSON.stringify(publishMsg),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {}

  return c.json({
    success: true,
    message: publishMsg,
    attachment: publishMsg.attachment,
  }, 201)
}

async function handleFileDownload(c: any): Promise<Response> {
  const id = c.req.param('id')
  const filename = c.req.param('filename')
  const { ATTACHMENTS, DB } = env(c)

  const obj = await ATTACHMENTS.get(`attachments/${id}/${filename}`)
  if (!obj) {
    return c.json({ code: 40401, http_code: 404, error: 'File not found', link: 'https://ntfy.sh/docs' }, 404)
  }

  const topic = obj.customMetadata?.topic as string | undefined
  if (topic) {
    await initDatabase(DB)
    const auth = await authenticate(c)
    const { read } = await checkTopicAccess(DB, auth.userId, topic)
    if (!read) {
      return c.json({ code: 40302, http_code: 403, error: 'Access denied', link: 'https://ntfy.sh/docs' }, 403)
    }
  }

  const contentType = obj.customMetadata?.contentType || 'application/octet-stream'

  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=31536000',
    },
  })
}

async function checkTopicAccess(
  db: D1Database,
  userId: string,
  topic: string,
): Promise<{ read: boolean; write: boolean }> {
  const exact = await db.prepare(
    'SELECT read_access, write_access FROM user_access WHERE user_id = ? AND topic = ?'
  ).bind(userId, topic).first() as { read_access: number; write_access: number } | null

  if (exact) {
    return { read: exact.read_access === 1, write: exact.write_access === 1 }
  }

  const patterns = await db.prepare(
    'SELECT topic, read_access, write_access FROM user_access WHERE user_id = ? AND topic LIKE ?'
  ).bind(userId, '%\*%').all()

  let read = true
  let write = true

  for (const row of (patterns.results || []) as any[]) {
    const pattern = row.topic as string
    if (wildcardMatch(pattern, topic)) {
      read = row.read_access === 1
      write = row.write_access === 1
      break
    }
  }

  return { read, write }
}

function wildcardMatch(pattern: string, topic: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i').test(topic)
}

export { app as attachmentRoutes }
