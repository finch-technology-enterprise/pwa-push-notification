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

app.get('/stats', async (c) => {
  try {
    const { DB } = env(c)
    await initDatabase(DB)
    const stats = await getStats(DB)
    return c.json({
      messages: stats.messages,
      messages_rate: 0,
    })
  } catch (err) {
    return c.json({ messages: 0, messages_rate: 0 })
  }
})

export { app as healthRoutes }
