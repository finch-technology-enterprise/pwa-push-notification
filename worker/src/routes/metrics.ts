import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { getStats, initDatabase } from '../db'

const app = new Hono<Env>()

app.get('/metrics', async (c) => {
  try {
    const { DB } = env(c)
    await initDatabase(DB)
    const stats = await getStats(DB)

    const metrics = [
      `# HELP ntfy_messages_total Total number of published messages`,
      `# TYPE ntfy_messages_total counter`,
      `ntfy_messages_total ${stats.messages}`,
      ``,
      `# HELP ntfy_build_info Build information`,
      `# TYPE ntfy_build_info gauge`,
      `ntfy_build_info{version="1.0.0",commit="",user="",date=""} 1`,
      ``,
    ].join('\n')

    return c.newResponse(metrics, 200, {
      'Content-Type': 'text/plain; version=0.0.4',
    })
  } catch {
    return c.newResponse('', 500)
  }
})

export { app as metricsRoutes }
