import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { requireAuth } from '../middleware'
import { initDatabase } from '../db'

const app = new Hono<Env>()

app.get('/tiers', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)

  const tiers = await DB.prepare(
    'SELECT * FROM tier ORDER BY messages_limit ASC'
  ).all()

  return c.json({
    tiers: (tiers.results || []).map((t: any) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      messages_limit: t.messages_limit,
      messages_expiry_duration: t.messages_expiry_duration,
      emails_limit: t.emails_limit,
      calls_limit: t.calls_limit,
      reservations_limit: t.reservations_limit,
      attachment_file_size_limit: t.attachment_file_size_limit,
      attachment_total_size_limit: t.attachment_total_size_limit,
      attachment_expiry_duration: t.attachment_expiry_duration,
      attachment_bandwidth_limit: t.attachment_bandwidth_limit,
    })),
  })
})

app.post('/account/billing/subscription', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAuth(c)

  return c.json({
    code: 40001,
    http_code: 400,
    error: 'Stripe billing is not configured. Contact the server administrator.',
    link: 'https://ntfy.sh/docs',
  }, 400)
})

app.put('/account/billing/subscription', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAuth(c)

  return c.json({
    code: 40001,
    http_code: 400,
    error: 'Stripe billing is not configured. Contact the server administrator.',
    link: 'https://ntfy.sh/docs',
  }, 400)
})

app.delete('/account/billing/subscription', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAuth(c)

  return c.json({
    code: 40001,
    http_code: 400,
    error: 'Stripe billing is not configured. Contact the server administrator.',
    link: 'https://ntfy.sh/docs',
  }, 400)
})

app.post('/account/billing/portal', async (c) => {
  const { DB } = env(c)
  await initDatabase(DB)
  await requireAuth(c)

  return c.json({
    code: 40001,
    http_code: 400,
    error: 'Stripe billing is not configured. Contact the server administrator.',
    link: 'https://ntfy.sh/docs',
  }, 400)
})

export { app as billingRoutes }
