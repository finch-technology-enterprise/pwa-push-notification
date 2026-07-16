import { describe, it, expect, beforeAll, vi } from 'vitest'
import { Hono } from 'hono'

function createMockDb() {
  const store = new Map<string, { value: number }>()
  store.set('messages', { value: 42 })

  return {
    prepare: (_sql: string) => ({
      first: async <T>() => {
        if (_sql.includes("key = 'messages'")) return store.get('messages') as T
        return null as T
      },
      run: async () => ({ success: true }),
      bind: (..._args: unknown[]) => ({
        first: async <T>() => null as T,
        run: async () => ({ success: true }),
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  } as unknown as D1Database
}

const mockEnv = {
  DB: createMockDb(),
}

vi.mock('hono/adapter', () => ({
  env: () => mockEnv,
}))

describe('Health Routes', () => {
  const app = new Hono()

  beforeAll(async () => {
    const { healthRoutes } = await import('../routes/health')
    app.route('/v1', healthRoutes)
  })

  it('GET /v1/health should return healthy', async () => {
    const req = new Request('http://localhost/v1/health')
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('healthy', true)
  })

  it('GET /v1/stats should return server stats', async () => {
    const req = new Request('http://localhost/v1/stats')
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('messages', 42)
  })
})
