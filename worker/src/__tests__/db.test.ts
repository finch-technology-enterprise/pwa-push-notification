import { describe, it, expect, beforeEach } from 'vitest'
import { getStats, incrementMessages } from '../db'

function createMockDb() {
  const store = new Map<string, { value: number }>()
  store.set('messages', { value: 0 })

  return {
    prepare: (sql: string) => ({
      first: async <T>() => {
        if (sql.includes("key = 'messages'")) {
          return store.get('messages') as T
        }
        return null as T
      },
      run: async () => {
        if (sql.includes('value = value + 1')) {
          const current = store.get('messages')!
          store.set('messages', { value: current.value + 1 })
        }
        return { success: true }
      },
      bind: (..._args: unknown[]) => ({
        first: async <T>() => {
          return null as T
        },
        run: async () => ({ success: true }),
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  } as unknown as D1Database
}

describe('getStats', () => {
  it('should return 0 messages initially', async () => {
    const db = createMockDb()
    const stats = await getStats(db)
    expect(stats).toEqual({ messages: 0 })
  })
})

describe('incrementMessages', () => {
  it('should increment message count', async () => {
    const db = createMockDb()
    await incrementMessages(db)
    const stats = await getStats(db)
    expect(stats.messages).toBe(1)
  })

  it('should increment multiple times', async () => {
    const db = createMockDb()
    await incrementMessages(db)
    await incrementMessages(db)
    await incrementMessages(db)
    const stats = await getStats(db)
    expect(stats.messages).toBe(3)
  })
})
