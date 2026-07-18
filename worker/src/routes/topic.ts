import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { authenticate, generateId, generateSequenceId, nowUnix, parseTags, parseActions, sanitizeHtml } from '../middleware'
import { initDatabase, incrementMessages } from '../db'
import { TOPIC_REGEX, DISALLOWED_TOPICS_DEFAULT } from '../types'
import type { PublishMessage, AuthInfo } from '../types'
import { checkMessageDailyLimit } from './rateLimit'

const app = new Hono<Env>()

// Support ntfy v2 unified API: PUT/POST / with topic in JSON body
app.put('/', handleRootPublish)
app.post('/', handleRootPublish)

app.put('/:topic', handlePublish)
app.post('/:topic', handlePublish)
app.put('/:topic/:sequenceId', handleUpdate)
app.delete('/:topic/:messageId', handleDelete)
app.delete('/:topic', handleTopicDelete)
app.put('/:topic/:messageId/clear', handleMessageClear)
app.get('/:topic/:messageId/clear', handleMessageClear)

app.get('/:topic/json', handleSubscribe)
app.get('/:topic/sse', handleSubscribe)
app.get('/:topic/raw', handleSubscribe)
app.get('/:topic/ws', handleSubscribe)
app.get('/:topic/auth', handleAuth)
app.get('/:topic', handlePublish)

async function handleRootPublish(c: any): Promise<Response> {
  const body = await c.req.json().catch(() => ({}))
  const topic = body.topic
  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://docs.ntfy.sh' }, 400)
  }
  const headers = new Headers(c.req.raw.headers)
  if (body.title) headers.set('X-Title', String(body.title))
  if (body.priority) headers.set('X-Priority', String(body.priority))
  if (body.tags) headers.set('X-Tags', Array.isArray(body.tags) ? body.tags.join(',') : String(body.tags))
  if (body.click) headers.set('X-Click', String(body.click))
  if (body.icon) headers.set('X-Icon', String(body.icon))
  if (body.actions) headers.set('X-Actions', JSON.stringify(body.actions))
  if (body.email) headers.set('X-Email', String(body.email))
  if (body.delay !== undefined && body.delay !== null) headers.set('X-Delay', String(body.delay))
  if (body.event) headers.set('X-Event', String(body.event))
  if (body.poll_id !== undefined) headers.set('X-Poll-ID', String(body.poll_id))
  if (body.unifiedpush) headers.set('X-UnifiedPush', 'true')

  const message = typeof body.message === 'string' ? body.message : ''
  const newReq = new Request(`${new URL(c.req.url).origin}/${topic}`, {
    method: c.req.method,
    headers,
    body: message || null,
  })
  return await app.fetch(newReq, c.env, c.executionCtx)
}

async function handleUpdate(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string
  const sequenceId = c.req.param('sequenceId') as string
  const { DB } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic) || !sequenceId) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic or sequence ID', link: 'https://docs.ntfy.sh' }, 400)
  }

  const existing = await DB.prepare('SELECT id FROM messages WHERE sequence_id = ? AND topic = ?')
    .bind(sequenceId, topic).first() as any | null

  if (!existing) {
    return c.json({ code: 40401, http_code: 404, error: 'Message not found', link: 'https://docs.ntfy.sh' }, 404)
  }

  // Forward to publish with X-Sequence-ID set so the existing message is updated
  const forwardHeaders = new Headers(c.req.raw.headers)
  forwardHeaders.set('X-Sequence-ID', sequenceId)
  const forwardUrl = new URL(c.req.url)
  forwardUrl.pathname = `/${topic}`
  const forwardReq = new Request(forwardUrl.toString(), {
    method: 'PUT',
    headers: forwardHeaders,
    body: c.req.raw.body,
  })
  return await app.fetch(forwardReq, c.env, c.executionCtx)
}

async function handlePublish(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string

  // UnifiedPush discovery: GET /{topic}?up=1 returns UP discovery JSON
  const isUpDiscovery = c.req.method === 'GET' && (c.req.query('up') === '1' || c.req.query('unifiedpush') === '1')
  if (isUpDiscovery) {
    return c.json({ unifiedpush: { version: 1 } })
  }

  const { DB, TOPIC_DO, DISALLOWED_TOPICS, MESSAGE_SIZE_LIMIT, VISITOR_MESSAGE_DAILY_LIMIT } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://docs.ntfy.sh' }, 400)
  }

  const disallowed = (DISALLOWED_TOPICS || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  if (disallowed.length === 0) disallowed.push(...DISALLOWED_TOPICS_DEFAULT)
  if (disallowed.includes(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Disallowed topic', link: 'https://docs.ntfy.sh' }, 400)
  }

  const auth = await authenticate(c)

  const { read, write } = await checkTopicAccess(DB, auth.userId, topic)
  if (!write) {
    return c.json({ code: 40302, http_code: 403, error: 'Access denied', link: 'https://docs.ntfy.sh' }, 403)
  }

  const limitResult = await checkMessageDailyLimit(DB, auth.userId, VISITOR_MESSAGE_DAILY_LIMIT || '0')
  if (!limitResult.allowed) {
    return c.json({ code: 40303, http_code: 403, error: limitResult.error!, link: 'https://docs.ntfy.sh' }, 403)
  }

  const body = (await c.req.text().catch(() => '')) || c.req.query('message') || ''
  const cacheEnabled = readBool(c, 'X-Cache', 'Cache')
  const firebaseEnabled = readBool(c, 'X-Firebase', 'Firebase')

  const msgSizeLimit = parseInt(MESSAGE_SIZE_LIMIT || '4096', 10)
  const xFilename = c.req.header('X-Filename') || ''
  const xAttach = c.req.header('X-Attach') || c.req.header('Attach') || c.req.header('a') || ''

  let attachmentName = ''
  let attachmentType = ''
  let attachmentSize = 0
  let attachmentExpires = 0
  let attachmentUrl = ''
  let msgBody = body
  const { BASE_URL, ATTACHMENTS, ATTACHMENT_FILE_SIZE_LIMIT } = env(c)

  // X-Attach: external attachment URL — store URL directly without uploading to R2
  if (xAttach) {
    attachmentUrl = xAttach
    attachmentName = c.req.header('X-Filename') || xAttach.split('/').pop() || 'attachment'
    attachmentType = c.req.header('Content-Type') || ''
    attachmentExpires = nowUnix() + 86400 * 30
  } else if (xFilename || body.length > msgSizeLimit) {
    const attachId = generateId()
    const fname = xFilename || `message-${attachId}.txt`
    const bodyBytes = new TextEncoder().encode(body)
    const attachContentType = c.req.header('Content-Type') || ''

    const fileSizeLimit = parseInt(ATTACHMENT_FILE_SIZE_LIMIT || '10485760', 10)
    if (bodyBytes.length > fileSizeLimit) {
      return c.json({ code: 40001, http_code: 400, error: `Message exceeds ${fileSizeLimit} bytes`, link: 'https://docs.ntfy.sh' }, 400)
    }

    const expireTime = nowUnix()
    await ATTACHMENTS.put(`attachments/${attachId}/${fname}`, bodyBytes, {
      customMetadata: { topic, contentType: attachContentType, userId: auth.userId },
    })

    attachmentName = fname
    attachmentType = attachContentType
    attachmentSize = bodyBytes.length
    attachmentExpires = expireTime + 86400 * 7
    attachmentUrl = `${BASE_URL}/file/${attachId}/${encodeURIComponent(fname)}`

    if (xFilename) {
      msgBody = ''
    }
  }

  const id = generateId()
  const now = nowUnix()
  const seqId = generateSequenceId()
  msgBody = sanitizeHtml(msgBody)
  const title = sanitizeHtml(readParam(c, 'X-Title', 'Title') || '')
  const priority = Math.max(1, Math.min(5, parseInt(readParam(c, 'X-Priority', 'Priority') || '3', 10)))
  const tags = parseTags(readParam(c, 'X-Tags', 'Tags') || '')
  const click = sanitizeHtml(readParam(c, 'X-Click', 'Click') || '')
  const icon = sanitizeHtml(readParam(c, 'X-Icon', 'Icon') || '')
  const actions = parseActions(readParam(c, 'X-Actions', 'Actions') || '[]')
  const sendAs = readParam(c, 'X-Send-As', 'Send-As') || ''
  const encoding = readParam(c, 'X-Encoding', 'Encoding') || ''
  const contentType = c.req.header('Content-Type') || ''
  const delay = readParam(c, 'X-Delay', 'Delay', 'X-At', 'At', 'X-In', 'In') || ''
  const scheduledFor = delay ? parseDelay(delay) : 0
  const eventType = readParam(c, 'X-Event', 'Event') || 'message'
  const sequenceIdX = readParam(c, 'X-Sequence-ID', 'Sequence-ID', 'sid')
  const pollId = readParam(c, 'X-Poll-ID', 'Poll-ID') || ''
  const unifiedPush = readBool(c, 'X-UnifiedPush', 'UnifiedPush', 'UP')
  const emailTarget = readParam(c, 'X-Email', 'Email', 'e')
  const callTarget = readParam(c, 'X-Call', 'Call')

  // Use custom sequence ID if provided, matching original header spec
  const finalSeqId = sequenceIdX || seqId

  const dbEvent = ['message_delete', 'message_clear'].includes(eventType) ? eventType : 'message'

  // Support X-Cache: no to skip DB storage
  if (cacheEnabled) {
    await DB.prepare(
      `INSERT INTO messages (id, sequence_id, time, event, expires, scheduled_for, topic, message, title, priority, tags, click, icon, actions, attachment_name, attachment_type, attachment_size, attachment_expires, attachment_url, sender, user_id, content_type, encoding, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, finalSeqId, now, dbEvent, 0, scheduledFor, topic, msgBody || '', title, priority, tags.join(','),
      click, icon, actions, attachmentName, attachmentType, attachmentSize, attachmentExpires, attachmentUrl,
      auth.authenticated ? auth.username : '', auth.userId, contentType, encoding, 1
    ).run()

    await incrementMessages(DB)
  }

  const publishMsg: PublishMessage = {
    id, sequence_id: finalSeqId, time: now, event: (eventType as PublishMessage['event']), topic,
    title: title || undefined, message: msgBody || undefined,
    priority: priority as PublishMessage['priority'],
    tags: tags.length > 0 ? tags : undefined,
    click: click || undefined, icon: icon || undefined,
    actions: actions !== '[]' ? JSON.parse(actions) : undefined,
    content_type: contentType || undefined, encoding: encoding || undefined,
    scheduled_for: scheduledFor > 0 ? scheduledFor : undefined,
    poll_id: pollId || undefined,
  }

  if (attachmentUrl) {
    publishMsg.attachment = {
      name: attachmentName,
      type: attachmentType || undefined,
      size: attachmentSize,
      expires: attachmentExpires,
      url: attachmentUrl,
    }
  }

  try {
    const doId = TOPIC_DO.idFromName(topic)
    const stub = TOPIC_DO.get(doId)
    await stub.fetch(`http://do/publish?topic=${topic}`, {
      method: 'POST', body: JSON.stringify(publishMsg),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {}

  if (!scheduledFor) {
    try {
      const { WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY } = env(c)
      await sendWebPushNotifications(DB, topic, publishMsg, WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY)
    } catch {}
    if (firebaseEnabled) {
      try {
        const { FCM_SERVER_KEY } = env(c)
        const { sendFcmNotifications } = await import('./fcm')
        await sendFcmNotifications(DB, topic, publishMsg, FCM_SERVER_KEY)
      } catch {}
    }
    if (emailTarget && auth.authenticated) {
      try {
        const { EMAIL } = env(c)
        const resolvedEmail = await resolveEmailTarget(DB, emailTarget, auth)
        if (resolvedEmail) {
          const { sendEmail } = await import('./email')
          await sendEmail(EMAIL, {
            to: resolvedEmail,
            from: { email: 'notify@finchtech.my', name: 'PWA Push Notification' },
            subject: title || `PWA Push: ${topic}`,
            text: msgBody || 'You received a notification',
          })
        }
      } catch {}
    }
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = env(c)
    try {
      const { sendPhoneNotifications } = await import('./call')
      await sendPhoneNotifications(DB, topic, publishMsg, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
    } catch {}
    if (callTarget && auth.authenticated) {
      try {
        const resolvedPhone = await resolveCallTarget(DB, callTarget, auth)
        if (resolvedPhone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
          const message = msgBody || title || 'Notification from PWA Push'
          const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${sanitizeHtml(message)}</Say></Response>`
          const authStr = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${authStr}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ To: resolvedPhone, From: TWILIO_FROM_NUMBER, Twiml: twiml }).toString(),
          })
        }
      } catch {}
    }
  }

  const resp = formatMessageResponse(publishMsg)
  return c.json(resp, 201)
}

async function handleSubscribe(c: any): Promise<Response> {
  const topicParam = c.req.param('topic') as string
  const { DB, TOPIC_DO, DISALLOWED_TOPICS } = env(c)
  await initDatabase(DB)

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
  const { KEEPALIVE_INTERVAL } = env(c)
  const keepaliveMs = parseInt(KEEPALIVE_INTERVAL || '30000', 10)

  const topics = topicParam.split(',').map((t: string) => t.trim()).filter(Boolean)

  if (topics.length === 0) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://docs.ntfy.sh' }, 400) as Response
  }

  for (const topic of topics) {
    if (!TOPIC_REGEX.test(topic)) {
      return c.json({ code: 40001, http_code: 400, error: `Invalid topic: ${topic}`, link: 'https://docs.ntfy.sh' }, 400) as Response
    }
  }

  const disallowed = (DISALLOWED_TOPICS || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  if (disallowed.length === 0) disallowed.push(...DISALLOWED_TOPICS_DEFAULT)
  for (const topic of topics) {
    if (disallowed.includes(topic)) {
      return c.json({ code: 40001, http_code: 400, error: `Disallowed topic: ${topic}`, link: 'https://docs.ntfy.sh' }, 400) as Response
    }
  }

  if (topics.length === 1) {
    const topic = topics[0]
    const doId = TOPIC_DO.idFromName(topic)
    const stub = TOPIC_DO.get(doId)

    const doUrl = `http://do/${suffix}?topic=${topic}&since=${since}&poll=${poll}`

    if (suffix === 'ws') {
      try {
        return await stub.fetch(new Request(doUrl, {
          method: c.req.raw.method,
          headers: c.req.raw.headers,
        }))
      } catch (e) {
        console.error(`[TopicDO] WebSocket fetch failed`, e)
        return new Response(`WebSocket error: ${e}`, { status: 500 })
      }
    }

    return await stub.fetch(doUrl)
  }

  return handleMultiTopicSubscribe(c, DB, TOPIC_DO, topics, suffix, since, poll, keepaliveMs)
}

async function handleMultiTopicSubscribe(
  c: any,
  db: D1Database,
  topicDo: DurableObjectNamespace,
  topics: string[],
  suffix: string,
  since: string,
  poll: string,
  keepaliveMs: number,
): Promise<Response> {
  if (suffix === 'ws') {
    return await handleMultiTopicWebSocket(c, db, topicDo, topics, since)
  }

  const filterPriority = c.req.query('priority') || ''
  const filterTags = c.req.query('tags') || ''
  const filterMinLt = parseInt(c.req.query('min_lt') || '0', 10)
  const filterMinLte = parseInt(c.req.query('min_lte') || '0', 10)

  const { readable, writable } = new TransformStream<string>()
  const writer = writable.getWriter()

  const sendPastMessages = async () => {
    const sinceTime = since && since !== 'all' ? parseInt(since, 10) : 0
    const placeholders = topics.map(() => '?').join(',')
    let query = `SELECT * FROM messages WHERE topic IN (${placeholders})`
    const params: unknown[] = [...topics]

    if (sinceTime > 0) {
      query += ' AND time > ?'
      params.push(sinceTime)
    }

    if (filterPriority) {
      query += ' AND priority = ?'
      params.push(parseInt(filterPriority, 10))
    }

    if (filterTags) {
      const tagList = filterTags.split(',').map((t: string) => t.trim()).filter(Boolean)
      for (const tag of tagList) {
        query += ' AND tags LIKE ?'
        params.push(`%${tag}%`)
      }
    }

    if (filterMinLt > 0) {
      query += ' AND time < ?'
      params.push(filterMinLt)
    } else if (filterMinLte > 0) {
      query += ' AND time <= ?'
      params.push(filterMinLte)
    }

    query += ' AND (scheduled_for IS NULL OR scheduled_for = 0 OR scheduled_for <= ?)'
    params.push(Math.floor(Date.now() / 1000))

    query += ' ORDER BY time ASC LIMIT 1000'

    const stmt = db.prepare(query).bind(...params)
    const result = await stmt.all()

    for (const row of (result.results || []) as any[]) {
      const msg = formatDbRow(row)
      if (suffix === 'sse') {
        const event = msg.event === 'message' ? 'message' : msg.event
        writer.write(`event: ${event}\ndata: ${JSON.stringify(msg)}\n\n`).catch(() => {})
      } else if (suffix === 'raw') {
        writer.write((msg.message || '') + '\n').catch(() => {})
      } else {
        writer.write(JSON.stringify(msg) + '\n').catch(() => {})
      }
    }
  }

  await sendPastMessages()

  if (poll) {
    writer.close().catch(() => {})
    return new Response(readable, {
      headers: {
        'Content-Type': suffix === 'sse' ? 'text/event-stream' : suffix === 'raw' ? 'text/plain' : 'application/x-ndjson',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
      },
    })
  }

  const abortController = new AbortController()

  const livePromises = topics.map(async (topic) => {
    const doId = topicDo.idFromName(topic)
    const stub = topicDo.get(doId)
    const doUrl = `http://do/${suffix}?topic=${topic}&since=all`
    try {
      const resp = await stub.fetch(doUrl, { signal: abortController.signal })
      const reader = resp.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        try {
          writer.write(text)
        } catch {
          break
        }
      }
    } catch {}
  })

  const keepalive = setInterval(() => {
    const ka = suffix === 'sse'
      ? `event: keepalive\ndata: {"event":"keepalive","topic":"${topics[0]}","time":${Date.now()}}\n\n`
      : `{"event":"keepalive","topic":"${topics[0]}","time":${Date.now()}}\n`
    writer.write(ka).catch(() => {})
  }, keepaliveMs)

  c.req.raw?.signal?.addEventListener('abort', () => {
    abortController.abort()
    clearInterval(keepalive)
    writer.close().catch(() => {})
  })

  Promise.all(livePromises).finally(() => {
    clearInterval(keepalive)
    writer.close().catch(() => {})
  })

  return new Response(readable, {
    headers: {
      'Content-Type': suffix === 'sse' ? 'text/event-stream' : suffix === 'raw' ? 'text/plain' : 'application/x-ndjson',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function handleMultiTopicWebSocket(
  c: any,
  db: D1Database,
  topicDo: DurableObjectNamespace,
  topics: string[],
  since: string,
): Promise<Response> {
  const { 0: client, 1: server } = new WebSocketPair()
  server.accept()

  const sinceTime = since && since !== 'all' ? parseInt(since, 10) : 0

  // Send past messages from D1 for all topics
  if (sinceTime > 0) {
    const placeholders = topics.map(() => '?').join(',')
    const rows = await db.prepare(
      `SELECT * FROM messages WHERE topic IN (${placeholders}) AND time > ? AND (scheduled_for IS NULL OR scheduled_for = 0 OR scheduled_for <= ?) ORDER BY time ASC LIMIT 500`
    ).bind(...topics, sinceTime, Math.floor(Date.now() / 1000)).all()

    for (const row of (rows.results || []) as any[]) {
      try { server.send(JSON.stringify(formatDbRow(row))) } catch {}
    }
  }

  // Subscribe to each topic's DO via JSON stream, forward to client WS
  const abortController = new AbortController()
  server.addEventListener('close', () => abortController.abort())
  server.addEventListener('error', () => abortController.abort())

  for (const topic of topics) {
    const doId = topicDo.idFromName(topic)
    const stub = topicDo.get(doId)
    const doUrl = `http://do/json?topic=${topic}&since=all`

    ;(async () => {
      try {
        const resp = await stub.fetch(doUrl, { signal: abortController.signal, headers: c.req.raw.headers })
        const reader = resp.body?.getReader()
        if (!reader) return
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter(Boolean)
          for (const line of lines) {
            try { server.send(line) } catch { return }
          }
        }
      } catch {}
    })()
  }

  return new Response(null, { status: 101, webSocket: client })
}

async function handleDelete(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string
  const messageId = c.req.param('messageId') || ''
  const { DB, TOPIC_DO } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://docs.ntfy.sh' }, 400)
  }

  const existing = await DB.prepare('SELECT * FROM messages WHERE id = ? AND topic = ?')
    .bind(messageId, topic).first() as any | null

  if (!existing) {
    return c.json({ code: 40401, http_code: 404, error: 'Message not found', link: 'https://docs.ntfy.sh' }, 404)
  }

  const id = generateId()
  const now = nowUnix()

  // Use the original message's sequence_id so client-side deduplication works
  const originalSeqId = existing.sequence_id as string

  // Delete the original message from D1 so it's not replayed via polling
  await DB.prepare('DELETE FROM messages WHERE id = ? AND topic = ?')
    .bind(messageId, topic).run()

  // Insert a message_delete event for traceability (DO processes this for live connections)
  await DB.prepare(
    `INSERT INTO messages (id, sequence_id, time, event, expires, scheduled_for, topic, message, title, priority, tags, click, icon, actions, attachment_name, attachment_type, attachment_size, attachment_expires, attachment_url, sender, user_id, content_type, encoding, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, originalSeqId, now, 'message_delete', 0, 0, topic, existing.message, '', 3, '',
    '', '', '[]', '', '', 0, 0, '', '', '', '', '', 1
  ).run()

  const deleteMsg: PublishMessage = {
    id, sequence_id: originalSeqId, time: now, event: 'message_delete', topic,
    message: existing.message || undefined,
    poll_id: messageId,
  }

  try {
    const doId = TOPIC_DO.idFromName(topic)
    const stub = TOPIC_DO.get(doId)
    await stub.fetch(`http://do/publish?topic=${topic}`, {
      method: 'POST', body: JSON.stringify(deleteMsg),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {}

  const resp = formatMessageResponse(deleteMsg)
  return c.json(resp, 200)
}

async function handleTopicDelete(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string
  const { DB, TOPIC_DO } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://docs.ntfy.sh' }, 400)
  }

  const auth = await authenticate(c)
  const { write } = await checkTopicAccess(DB, auth.userId, topic)
  if (!write) {
    return c.json({ code: 40302, http_code: 403, error: 'Access denied', link: 'https://docs.ntfy.sh' }, 403)
  }

  await DB.prepare('DELETE FROM messages WHERE topic = ?').bind(topic).run()

  const id = generateId()
  const now = nowUnix()
  const seqId = generateSequenceId()
  const clearMsg: PublishMessage = {
    id, sequence_id: seqId, time: now, event: 'message_clear', topic,
  }

  try {
    const doId = TOPIC_DO.idFromName(topic)
    const stub = TOPIC_DO.get(doId)
    await stub.fetch(`http://do/publish?topic=${topic}`, {
      method: 'POST', body: JSON.stringify(clearMsg),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {}

  return c.json({ success: true, topic }, 200)
}

async function handleMessageClear(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string
  const messageId = c.req.param('messageId') || ''
  const { DB, TOPIC_DO } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://docs.ntfy.sh' }, 400)
  }

  const auth = await authenticate(c)
  const { write } = await checkTopicAccess(DB, auth.userId, topic)
  if (!write) {
    return c.json({ code: 40302, http_code: 403, error: 'Access denied', link: 'https://docs.ntfy.sh' }, 403)
  }

  const existing = await DB.prepare('SELECT * FROM messages WHERE id = ? AND topic = ?')
    .bind(messageId, topic).first() as any | null

  const id = generateId()
  const now = nowUnix()

  // Use original message's sequence_id for client-side deduplication
  const originalSeqId = existing?.sequence_id || generateSequenceId()

  // Delete the original message from D1
  await DB.prepare('DELETE FROM messages WHERE id = ? AND topic = ?')
    .bind(messageId, topic).run()

  await DB.prepare(
    `INSERT INTO messages (id, sequence_id, time, event, expires, scheduled_for, topic, message, title, priority, tags, click, icon, actions, attachment_name, attachment_type, attachment_size, attachment_expires, attachment_url, sender, user_id, content_type, encoding, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, originalSeqId, now, 'message_clear', 0, 0, topic, '', '', 3, '',
    '', '', '[]', '', '', 0, 0, '', '', '', '', '', 1
  ).run()

  const clearMsg: PublishMessage = {
    id, sequence_id: originalSeqId, time: now, event: 'message_clear', topic,
    poll_id: messageId,
  }

  try {
    const doId = TOPIC_DO.idFromName(topic)
    const stub = TOPIC_DO.get(doId)
    await stub.fetch(`http://do/publish?topic=${topic}`, {
      method: 'POST', body: JSON.stringify(clearMsg),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {}

  const resp = formatMessageResponse(clearMsg)
  return c.json(resp, 200)
}

async function handleAuth(c: any): Promise<Response> {
  const topic = c.req.param('topic') as string
  const { DB } = env(c)
  await initDatabase(DB)

  if (!topic || !TOPIC_REGEX.test(topic)) {
    return c.json({ code: 40001, http_code: 400, error: 'Invalid topic', link: 'https://docs.ntfy.sh' }, 400) as Response
  }

  const auth = await authenticate(c)
  const { read, write } = await checkTopicAccess(DB, auth.userId, topic)

  return c.json({
    topic, authenticated: auth.authenticated, user: auth.username,
    read, write,
  }) as Response
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

async function sendWebPushNotifications(
  db: D1Database,
  topic: string,
  msg: PublishMessage,
  vapidPublicKey?: string,
  vapidPrivateKey?: string
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

      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
      }

      if (vapidPublicKey && vapidPrivateKey) {
        const audience = new URL(endpoint).origin
        const vapidAuth = await generateVapidAuthorization(
          audience,
          'mailto:admin@finchtech.my',
          vapidPublicKey,
          vapidPrivateKey,
        )
        headers['Authorization'] = vapidAuth
      }

      await fetch(endpoint, { method: 'POST', headers, body: ciphertext })
    } catch {
    }
  }
}

async function generateVapidAuthorization(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub: subject, aud: audience, exp: now + 43200 }

  const headerB64 = base64UrlEncodeStr(JSON.stringify(header))
  const payloadB64 = base64UrlEncodeStr(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`
  const signature = await signEcdsaJwt(signingInput, publicKey, privateKey)
  const jwt = `${signingInput}.${signature}`

  return `vapid t=${jwt}, k=${publicKey}`
}

async function signEcdsaJwt(
  input: string,
  publicKeyB64: string,
  privateKeyB64: string,
): Promise<string> {
  const pubBin = base64UrlToBin(publicKeyB64)
  const privBin = base64UrlToBin(privateKeyB64)

  const x = pubBin.slice(1, 33)
  const y = pubBin.slice(33, 65)

  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: binToBase64Url(privBin),
      x: binToBase64Url(x),
      y: binToBase64Url(y),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const derSig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(input),
  )

  const rawSig = derToRaw64(new Uint8Array(derSig))
  return binToBase64Url(rawSig)
}

function derToRaw64(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30 || der.length < 8) return der

  let offset = 2
  if ((der[1]! & 0x80) !== 0) {
    offset += der[1]! & 0x7f
  }

  if (der[offset] !== 0x02) return der
  offset++

  const rLen = der[offset]!
  offset++
  let rStart = offset
  const rAdj = rLen > 32 ? 1 : 0
  if (rAdj) rStart++
  const r = der.slice(rStart, rStart + 32)
  offset = rStart + rLen - rAdj

  if (der[offset] !== 0x02) return der
  offset++

  const sLen = der[offset]!
  offset++
  let sStart = offset
  const sAdj = sLen > 32 ? 1 : 0
  if (sAdj) sStart++
  const s = der.slice(sStart, sStart + 32)
  offset = sStart + sLen - sAdj

  const raw = new Uint8Array(64)
  raw.set(pad32(r), 0)
  raw.set(pad32(s), 32)
  return raw
}

function pad32(buf: Uint8Array): Uint8Array {
  if (buf.length === 32) return buf
  const padded = new Uint8Array(32)
  padded.set(buf, 32 - buf.length)
  return padded
}

function base64UrlEncodeStr(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function binToBase64Url(bin: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bin.length; i++) {
    binary += String.fromCharCode(bin[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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
  const resp: Record<string, unknown> = {
    id: msg.id, time: msg.time, event: msg.event, topic: msg.topic,
    message: msg.message || null, title: msg.title || null,
    priority: msg.priority || 3, tags: msg.tags || [],
    click: msg.click || null, icon: msg.icon || null,
    actions: msg.actions || [],
  }
  if (msg.scheduled_for && msg.scheduled_for > Math.floor(Date.now() / 1000)) {
    resp.scheduled_for = msg.scheduled_for
  }
  if (msg.attachment) {
    resp.attachment = msg.attachment
  }
  return resp
}

function formatDbRow(row: any): PublishMessage {
  const scheduledFor = row.scheduled_for ? parseInt(row.scheduled_for, 10) : 0
  const msg: PublishMessage = {
    id: row.id,
    sequence_id: row.sequence_id,
    time: row.time,
    event: row.event,
    scheduled_for: scheduledFor > 0 ? scheduledFor : undefined,
    topic: row.topic,
    title: row.title || undefined,
    priority: row.priority as PublishMessage['priority'],
    tags: row.tags ? row.tags.split(',').filter((t: string) => t) : undefined,
    click: row.click || undefined,
    icon: row.icon || undefined,
    actions: row.actions && row.actions !== '[]' ? JSON.parse(row.actions) : undefined,
  }
  if (row.attachment_url) {
    msg.attachment = {
      name: row.attachment_name,
      type: row.attachment_type || undefined,
      size: row.attachment_size,
      expires: row.attachment_expires,
      url: row.attachment_url,
    }
  }
  return msg
}

function parseDelay(delay: string): number {
  const now = Date.now()
  const maxDelay = 3 * 86400_000 // 3 days in ms

  const durationMatch = delay.match(/^(\d+)\s*([smhd])$/i)
  if (durationMatch) {
    const value = parseInt(durationMatch[1]!, 10)
    const unit = durationMatch[2]!.toLowerCase()
    const multipliers: Record<string, number> = {
      s: 1000, m: 60000, h: 3600000, d: 86400000,
    }
    const ms = value * (multipliers[unit] || 0)
    if (ms > maxDelay) return 0
    return Math.floor((now + ms) / 1000)
  }

  const ts = parseInt(delay, 10)
  if (/^\d{8,}$/.test(delay) && !isNaN(ts)) {
    const ms = ts > 1e12 ? ts : ts * 1000
    if (ms > now && ms - now <= maxDelay) return Math.floor(ms / 1000)
    return 0
  }

  const parsed = Date.parse(delay)
  if (!isNaN(parsed)) {
    if (parsed > now && parsed - now <= maxDelay) return Math.floor(parsed / 1000)
  }

  return 0
}

function readParam(c: any, ...names: string[]): string | null {
  for (const name of names) {
    const h = c.req.header(name)
    if (h) return h
    const q = c.req.query(name.toLowerCase())
    if (q) return q
  }
  return null
}

async function resolveEmailTarget(db: D1Database, target: string, auth: AuthInfo): Promise<string | null> {
  if (target.toLowerCase() === 'true' && auth.authenticated) {
    const row = await db.prepare(
      'SELECT email FROM user_email WHERE user_id = ? ORDER BY is_primary DESC LIMIT 1'
    ).bind(auth.userId).first<{ email: string }>()
    return row?.email || null
  }
  return target
}

async function resolveCallTarget(db: D1Database, target: string, auth: AuthInfo): Promise<string | null> {
  if (target.toLowerCase() === 'true' && auth.authenticated) {
    const row = await db.prepare(
      'SELECT phone_number FROM user_phone WHERE user_id = ? LIMIT 1'
    ).bind(auth.userId).first<{ phone_number: string }>()
    return row?.phone_number || null
  }
  return target
}

function readBool(c: any, ...names: string[]): boolean {
  const val = readParam(c, ...names)
  if (!val) return true
  const lower = val.toLowerCase()
  return lower !== 'no' && lower !== 'false' && lower !== '0'
}

export { app as topicRoutes }
