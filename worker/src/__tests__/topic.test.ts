import { describe, it, expect, beforeAll, vi } from 'vitest'
import { Hono } from 'hono'

function createMockDb() {
  const store = new Map<string, { value: number }>()
  store.set('messages', { value: 0 })

  return {
    prepare: (sql: string) => {
      const bindings: unknown[] = []
      const stmt = {
        bind: (...args: unknown[]) => {
          bindings.push(...args)
          return stmt
        },
        first: async <T>() => {
          if (sql.includes("key = 'messages'")) return store.get('messages') as T
          if (sql.includes('SELECT COUNT(*) as cnt')) return { cnt: 0 } as T
          return null as T
        },
        run: async () => {
          if (sql.includes('INSERT INTO') || sql.includes('UPDATE message_stats')) {
            const current = store.get('messages')!
            store.set('messages', { value: current.value + 1 })
          }
          return { success: true }
        },
        all: async <T>() => ({ results: [] as T[] }),
      }
      return stmt
    },
  } as unknown as D1Database
}

const mockEnv = {
  DB: createMockDb(),
  TOPIC_DO: {
    idFromName: () => 'mock-do-id',
    get: () => ({
      fetch: async () => new Response('ok', { status: 200 }),
    }),
  } as unknown as DurableObjectNamespace,
  BASE_URL: 'http://localhost:8787',
  ENABLE_SIGNUP: 'true',
  ENABLE_LOGIN: 'true',
  DISALLOWED_TOPICS: 'docs,static,file,app,metrics,account,settings,signup,login,v1',
  ACCESS_CONTROL_ALLOW_ORIGIN: '*',
  VISITOR_SUBSCRIPTION_LIMIT: '30',
  VISITOR_MESSAGE_DAILY_LIMIT: '0',
  MESSAGE_SIZE_LIMIT: '4096',
  KEEPALIVE_INTERVAL: '45',
}

vi.mock('hono/adapter', () => ({
  env: () => mockEnv,
}))

describe('Topic Routes', () => {
  let app: Hono

  beforeAll(async () => {
    const { topicRoutes } = await import('../routes/topic')
    app = new Hono()
    app.route('/', topicRoutes)
  })

  it('PUT /valid-topic should publish a message', async () => {
    const req = new Request('http://localhost/mytopic', {
      method: 'PUT',
      body: 'Hello World',
      headers: { 'Content-Type': 'text/plain' },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('event', 'message')
    expect(body).toHaveProperty('topic', 'mytopic')
    expect(body).toHaveProperty('message', 'Hello World')
  })

  it('PUT with invalid topic should return 400', async () => {
    const req = new Request('http://localhost/invalid topic!', {
      method: 'PUT',
      body: 'test',
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('code', 40001)
  })

  it('PUT with disallowed topic should return 400', async () => {
    const req = new Request('http://localhost/docs', {
      method: 'PUT',
      body: 'test',
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error', 'Disallowed topic')
  })
})
