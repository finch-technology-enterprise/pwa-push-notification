import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { getStats, initDatabase } from '../db'

const app = new Hono<Env>()

app.get('/health', async (c) => {
  try {
    const { DB } = env(c)
    await initDatabase(DB)
    await DB.prepare('SELECT 1').run()
    return c.json({ healthy: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return c.json({ healthy: false, error: msg }, 503)
  }
})

app.get('/version', async (c) => {
  const { BUILD_VERSION, BUILD_COMMIT, BUILD_DATE } = env(c)
  return c.json({
    version: BUILD_VERSION || '2.11.1',
    commit: BUILD_COMMIT || 'cf',
    date: BUILD_DATE || '',
  })
})

app.get('/stats', async (c) => {
  try {
    const { DB } = env(c)
    await initDatabase(DB)
    const stats = await getStats(DB)

    // Calculate rate from last 10 seconds of message count
    const tenSecAgo = Math.floor(Date.now() / 1000) - 10
    const recent = await DB.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE time >= ?'
    ).bind(tenSecAgo).first<{ cnt: number }>()
    const messagesRate = recent?.cnt ? recent.cnt / 10 : 0

    return c.json({
      messages: stats.messages,
      messages_rate: Math.round(messagesRate * 100) / 100,
    })
  } catch (err) {
    return c.json({ messages: 0, messages_rate: 0 })
  }
})

export { app as healthRoutes }
