import type { PublishMessage } from '../types'

interface Connection {
  id: string
  type: 'ws' | 'sse' | 'json' | 'raw'
  lastMessageId: string | null
  controller?: ReadableStreamDefaultController<string>
  webSocket?: WebSocket
  pollTimer?: ReturnType<typeof setTimeout>
  keepaliveTimer?: ReturnType<typeof setInterval>
  writer?: WritableStreamDefaultWriter<string>
}

export class TopicDO {
  private state: DurableObjectState
  private env: unknown
  private connections: Map<string, Connection> = new Map()
  private messages: PublishMessage[] = []
  private scheduledMessages: PublishMessage[] = []
  private maxMessages = 100
  private keepaliveInterval = 30_000
  private initialized = false

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state
    this.env = env
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    const stored = await this.state.storage.get<PublishMessage[]>('messages')
    if (stored) this.messages = stored
    const scheduled = await this.state.storage.get<PublishMessage[]>('scheduledMessages')
    if (scheduled) this.scheduledMessages = scheduled
  }

  private async persistMessages(): Promise<void> {
    await this.state.storage.put('messages', this.messages)
  }

  private async persistScheduledMessages(): Promise<void> {
    await this.state.storage.put('scheduledMessages', this.scheduledMessages)
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized()
    const url = new URL(request.url)
    const path = url.pathname
    const topic = url.searchParams.get('topic') || ''
    const since = url.searchParams.get('since') || ''

    if (path.endsWith('/ws') || request.headers.get('Upgrade') === 'websocket') {
      try {
        return await this.handleWebSocket(request, topic, since)
      } catch (e) {
        console.error(`[TopicDO:${topic}] WebSocket error:`, e)
        return new Response(`WebSocket error: ${e}`, { status: 500 })
      }
    }

    if (path.endsWith('/sse')) {
      return this.handleSSE(request, topic)
    }

    if (path.endsWith('/json')) {
      return this.handleJSONStream(request, topic)
    }

    if (path.endsWith('/raw')) {
      return this.handleRawStream(request, topic)
    }

    if (path.endsWith('/publish')) {
      return this.handlePublish(request, topic)
    }

    return new Response('Not found', { status: 404 })
  }

  private async handleWebSocket(request: Request, topic: string, sinceParam: string): Promise<Response> {
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    const connId = crypto.randomUUID()
    const conn: Connection = {
      id: connId,
      type: 'ws',
      lastMessageId: null,
      webSocket: server,
    }
    this.connections.set(connId, conn)

    server.accept()

    server.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string)
        if (data.type === 'poll') {
          const s = data.since || 'all'
          this.sendPastMessages(conn, s)
        }
      } catch {
      }
    })

    server.addEventListener('close', () => {
      this.cleanupConnection(connId)
    })

    conn.keepaliveTimer = setInterval(() => {
      try {
        server.send(JSON.stringify({ event: 'keepalive', topic, time: Date.now() }))
      } catch {
        this.cleanupConnection(connId)
      }
    }, this.keepaliveInterval)

    this.sendOpenEvent(conn)
    this.sendPastMessages(conn, sinceParam || 'all')

    return new Response(null, { status: 101, webSocket: client })
  }

  private handleSSE(request: Request, topic: string): Response {
    const connId = crypto.randomUUID()
    const { readable, writable } = new TransformStream<string>()
    const writer = writable.getWriter()

    const conn: Connection = {
      id: connId,
      type: 'sse',
      lastMessageId: null,
      writer,
    }
    this.connections.set(connId, conn)

    const since = urlParam(request.url, 'since') || 'all'
    const poll = urlParam(request.url, 'poll')

    const send = (data: string) => {
      try {
        writer.write(data)
      } catch {
        this.cleanupConnection(connId)
      }
    }

    this.sendOpenEventSSE(send, topic)
    this.sendPastMessagesSSE(send, conn, since)

    if (poll) {
      const pollTimeout = parseInt(poll, 10) || 30
      const tid = setTimeout(() => {
        this.cleanupConnection(connId)
        writer.close().catch(() => {})
      }, pollTimeout * 1000)
      conn.pollTimer = tid
    }

    conn.keepaliveTimer = setInterval(() => {
      send(`event: keepalive\ndata: {"event":"keepalive","topic":"${topic}","time":${Date.now()}}\n\n`)
    }, this.keepaliveInterval)

    const cleanup = () => this.cleanupConnection(connId)
    request.signal?.addEventListener('abort', cleanup)

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  private handleJSONStream(request: Request, topic: string): Response {
    const connId = crypto.randomUUID()
    const { readable, writable } = new TransformStream<string>()
    const writer = writable.getWriter()

    const conn: Connection = {
      id: connId,
      type: 'json',
      lastMessageId: null,
      writer,
    }
    this.connections.set(connId, conn)

    const since = urlParam(request.url, 'since') || ''
    const poll = urlParam(request.url, 'poll')

    const send = (data: string) => {
      try {
        writer.write(data)
      } catch {
        this.cleanupConnection(connId)
      }
    }

    this.sendPastMessagesJSON(send, conn, since)

    if (poll) {
      const pollTimeout = parseInt(poll, 10) || 30
      const tid = setTimeout(() => {
        this.cleanupConnection(connId)
        writer.close().catch(() => {})
      }, pollTimeout * 1000)
      conn.pollTimer = tid
    }

    conn.keepaliveTimer = setInterval(() => {
      send(`{"event":"keepalive","topic":"${topic}","time":${Date.now()}}\n`)
    }, this.keepaliveInterval)

    const cleanup = () => this.cleanupConnection(connId)
    request.signal?.addEventListener('abort', cleanup)

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  private handleRawStream(request: Request, topic: string): Response {
    const connId = crypto.randomUUID()
    const { readable, writable } = new TransformStream<string>()
    const writer = writable.getWriter()

    const conn: Connection = {
      id: connId,
      type: 'raw',
      lastMessageId: null,
      writer,
    }
    this.connections.set(connId, conn)

    conn.keepaliveTimer = setInterval(() => {
      try {
        writer.write('\n')
      } catch {
        this.cleanupConnection(connId)
      }
    }, this.keepaliveInterval)

    const cleanup = () => this.cleanupConnection(connId)
    request.signal?.addEventListener('abort', cleanup)

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }
  private async handlePublish(request: Request, topic: string): Promise<Response> {
    try {
      const msg: PublishMessage = await request.json()
      const now = Math.floor(Date.now() / 1000)

      if (msg.event === 'message_delete') {
        const targetId = msg.poll_id || msg.id
        this.messages = this.messages.filter(m => m.id !== targetId)
        await this.persistMessages()
        this.broadcast(msg)
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (msg.event === 'message_clear') {
        this.messages = []
        await this.persistMessages()
        this.broadcast(msg)
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (msg.scheduled_for && msg.scheduled_for > now) {
        this.scheduledMessages.push(msg)
        this.scheduledMessages.sort((a, b) => (a.scheduled_for || 0) - (b.scheduled_for || 0))
        await this.persistScheduledMessages()
        this.setNextAlarm()
        return new Response(JSON.stringify({ success: true, scheduled: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      this.messages.push(msg)
      if (this.messages.length > this.maxMessages) {
        this.messages = this.messages.slice(-this.maxMessages)
      }
      await this.persistMessages()
      this.broadcast(msg)
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(JSON.stringify({ error: 'Bad request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  private broadcast(msg: PublishMessage): void {
    const json = JSON.stringify(msg)
    const dead: string[] = []

    for (const [id, conn] of this.connections) {
      switch (conn.type) {
        case 'ws': {
          try {
            conn.webSocket?.send(json)
          } catch {
            dead.push(id)
          }
          break
        }
        case 'sse': {
          try {
            const event = msg.event === 'message' ? 'message' : msg.event
            const sse = `event: ${event}\ndata: ${json}\n\n`
            conn.writer?.write(sse)
          } catch {
            dead.push(id)
          }
          break
        }
        case 'json': {
          try {
            conn.writer?.write(json + '\n')
          } catch {
            dead.push(id)
          }
          break
        }
        case 'raw': {
          try {
            conn.writer?.write((msg.message || '') + '\n')
          } catch {
            dead.push(id)
          }
          break
        }
      }
    }

    for (const id of dead) {
      this.cleanupConnection(id)
    }
  }

  private sendOpenEvent(conn: Connection): void {
    const openMsg = JSON.stringify({
      event: 'open',
      topic: '',
      time: Date.now(),
    })
    try {
      conn.webSocket?.send(openMsg)
    } catch {
    }
  }

  private sendOpenEventSSE(send: (data: string) => void, topic: string): void {
    send(`event: open\ndata: {"event":"open","topic":"${topic}","time":${Date.now()}}\n\n`)
  }

  private sendPastMessages(conn: Connection, since: string): void {
    const msgs = this.getMessagesSince(since)
    for (const msg of msgs) {
      try {
        conn.webSocket?.send(JSON.stringify(msg))
      } catch {
        return
      }
    }
  }

  private sendPastMessagesSSE(send: (data: string) => void, conn: Connection, since: string): void {
    const msgs = this.getMessagesSince(since)
    for (const msg of msgs) {
      const event = msg.event === 'message' ? 'message' : msg.event
      send(`event: ${event}\ndata: ${JSON.stringify(msg)}\n\n`)
      conn.lastMessageId = msg.id
    }
  }

  private sendPastMessagesJSON(send: (data: string) => void, conn: Connection, since: string): void {
    const msgs = this.getMessagesSince(since)
    for (const msg of msgs) {
      send(JSON.stringify(msg) + '\n')
      conn.lastMessageId = msg.id
    }
  }

  private getMessagesSince(since: string): PublishMessage[] {
    const now = Math.floor(Date.now() / 1000)
    const msgs = this.messages.filter(m => !m.scheduled_for || m.scheduled_for <= now)

    if (!since || since === 'all') return [...msgs]

    const sinceTime = parseInt(since, 10)
    if (!isNaN(sinceTime)) {
      return msgs.filter(m => m.time > sinceTime)
    }

    const idx = msgs.findIndex(m => m.id === since)
    if (idx !== -1) {
      return msgs.slice(idx + 1)
    }

    return []
  }

  private setNextAlarm(): void {
    const next = this.scheduledMessages[0]
    if (next?.scheduled_for) {
      const alarmTime = next.scheduled_for * 1000
      if (alarmTime > Date.now()) {
        this.state.storage.setAlarm(alarmTime)
      }
    }
  }

  private cleanupConnection(id: string): void {
    const conn = this.connections.get(id)
    if (!conn) return

    if (conn.keepaliveTimer) clearInterval(conn.keepaliveTimer)
    if (conn.pollTimer) clearTimeout(conn.pollTimer)

    if (conn.type === 'ws' && conn.webSocket) {
      try { conn.webSocket.close() } catch {}
    }

    if (conn.writer) {
      try { conn.writer.close() } catch {}
    }

    this.connections.delete(id)
  }

  async alarm(): Promise<void> {
    await this.ensureInitialized()
    const now = Math.floor(Date.now() / 1000)

    const due = this.scheduledMessages.filter(m => m.scheduled_for && m.scheduled_for <= now)
    this.scheduledMessages = this.scheduledMessages.filter(m => !m.scheduled_for || m.scheduled_for > now)

    for (const msg of due) {
      this.messages.push(msg)
      if (this.messages.length > this.maxMessages) {
        this.messages = this.messages.slice(-this.maxMessages)
      }
      this.broadcast(msg)
    }

    this.messages = this.messages.filter(m => {
      if (m.expires && m.expires > 0) {
        return now < m.expires
      }
      return true
    })

    await this.persistMessages()
    await this.persistScheduledMessages()
    this.setNextAlarm()
  }
}

function urlParam(url: string, name: string): string | null {
  try {
    return new URL(url).searchParams.get(name)
  } catch {
    return null
  }
}
