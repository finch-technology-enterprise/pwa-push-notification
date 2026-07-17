import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from 'hono/adapter'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { healthRoutes } from './routes/health'
import { configRoutes } from './routes/config'
import { metricsRoutes } from './routes/metrics'
import { webpushRoutes } from './routes/webpush'
import { accountRoutes } from './routes/account'
import { adminRoutes } from './routes/admin'
import { topicRoutes } from './routes/topic'
import { attachmentRoutes } from './routes/attachment'
import { billingRoutes } from './routes/billing'
import { TOPIC_REGEX } from './types'
import { buildConfigJs } from './routes/config'

export type Env = {
  Bindings: {
    DB: D1Database
    TOPIC_DO: DurableObjectNamespace
    ATTACHMENTS: R2Bucket
    EMAIL: SendEmail
    ASSETS: Fetcher  // Static assets binding for frontend
    BASE_URL: string
    ENABLE_SIGNUP?: string
    ENABLE_LOGIN?: string
    ENABLE_RESET_PASSWORD?: string
    DISALLOWED_TOPICS?: string
    WEB_PUSH_PUBLIC_KEY?: string
    WEB_PUSH_PRIVATE_KEY?: string
    ACCESS_CONTROL_ALLOW_ORIGIN?: string
    VISITOR_SUBSCRIPTION_LIMIT?: string
    VISITOR_MESSAGE_DAILY_LIMIT?: string
    MESSAGE_SIZE_LIMIT?: string
    KEEPALIVE_INTERVAL?: string
    MAX_MESSAGES?: string
    ATTACHMENT_FILE_SIZE_LIMIT?: string
    ATTACHMENT_TOTAL_SIZE_LIMIT?: string
    FCM_SERVER_KEY?: string
    TWILIO_ACCOUNT_SID?: string
    TWILIO_AUTH_TOKEN?: string
    TWILIO_FROM_NUMBER?: string
  }
}

const app = new Hono<Env>()

app.use('*', async (c, next) => {
  const { ACCESS_CONTROL_ALLOW_ORIGIN } = env(c)
  const allowOrigin = ACCESS_CONTROL_ALLOW_ORIGIN || '*'
  const corsMiddleware = cors({ origin: allowOrigin })
  return corsMiddleware(c, next)
})
app.use('*', logger())
app.use('*', secureHeaders())

app.route('/v1', healthRoutes)
app.route('/v1', configRoutes)
app.get('/config.js', (c) => {
  const js = buildConfigJs(c)
  return c.newResponse(js, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=300',
  })
})
app.route('/v1', metricsRoutes)
app.route('/v1', webpushRoutes)
app.route('/v1', accountRoutes)
app.route('/v1', adminRoutes)
app.route('/', attachmentRoutes)
app.route('/', topicRoutes)
app.route('/v1', billingRoutes)

// Wrap the fetch handler so that non-API requests fall through to the static assets (frontend SPA).
// With run_worker_first = true, ALL requests reach the Worker; we try assets first for non-API
// GET requests, then let Hono match API/topic routes.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    const SUBSCRIBE_SUFFIXES = ['/json', '/ws', '/sse', '/raw', '/auth']
    const isSubscribePath = SUBSCRIBE_SUFFIXES.some(s => url.pathname.endsWith(s))

    // For GET requests to non-API paths that aren't topic subscription paths,
    // try static assets first so the SPA handles its own routes.
    // Falls through to Hono if the asset doesn't exist (404).
    if (request.method === 'GET' && !url.pathname.startsWith('/v1/') && !isSubscribePath && url.pathname !== '/config.js') {
      try {
        const assets = (env as any).ASSETS as Fetcher
        const assetResponse = await assets.fetch(request)
        if (assetResponse.status !== 404 && assetResponse.status !== 307) {
          return assetResponse
        }
        // Assets returned 404/307 — try index.html for SPA routing
        const indexUrl = new URL(request.url)
        indexUrl.pathname = '/index.html'
        const indexResponse = await assets.fetch(new Request(indexUrl, request))
        if (indexResponse.status === 200) {
          return indexResponse
        }
      } catch {
        // ASSETS.fetch may throw on methods it can't serve
      }
    }

    // Handle WebSocket upgrades directly, bypassing Hono middleware (cors/secureHeaders can corrupt 101 responses)
    const upgradeHeader = request.headers.get('Upgrade')
    if (request.method === 'GET' && upgradeHeader === 'websocket') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 2 && parts[1] === 'ws') {
        const topic = parts[0]!
        if (TOPIC_REGEX.test(topic)) {
          const bindings = env as unknown as Env['Bindings']
          const doId = bindings.TOPIC_DO.idFromName(topic)
          const stub = bindings.TOPIC_DO.get(doId)
          const since = url.searchParams.get('since') || ''
          return await stub.fetch(new Request(`http://do/ws?topic=${topic}&since=${since}`, {
            method: 'GET',
            headers: request.headers,
          }))
        }
      }
    }

    // Strip Priority header (RFC 9218) — Cloudflare edge returns 500 on PUT + Priority
    const sanitized = new Headers(request.headers)
    sanitized.delete('priority')
    const cleaned = new Request(request, { headers: sanitized })

    return await app.fetch(cleaned, env, ctx)
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const bindings = env as unknown as Env['Bindings']
    const { handleScheduledCleanup } = await import('./routes/cleanup')
    const result = await handleScheduledCleanup(bindings.DB, bindings.ATTACHMENTS)
    console.log('[Cleanup]', JSON.stringify(result))
  },
}

export { TopicDO } from './do/topic'
