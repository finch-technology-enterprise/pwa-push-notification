import { Hono } from 'hono'
import { cors } from 'hono/cors'
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
    DISALLOWED_TOPICS?: string
    WEB_PUSH_PUBLIC_KEY?: string
    WEB_PUSH_PRIVATE_KEY?: string
    ACCESS_CONTROL_ALLOW_ORIGIN?: string
    VISITOR_SUBSCRIPTION_LIMIT?: string
    VISITOR_MESSAGE_DAILY_LIMIT?: string
    MESSAGE_SIZE_LIMIT?: string
    KEEPALIVE_INTERVAL?: string
    ATTACHMENT_FILE_SIZE_LIMIT?: string
    ATTACHMENT_TOTAL_SIZE_LIMIT?: string
  }
}

const app = new Hono<Env>()

app.use('*', cors())
app.use('*', logger())
app.use('*', secureHeaders())

app.route('/v1', healthRoutes)
app.route('/v1', configRoutes)
app.route('/v1', metricsRoutes)
app.route('/v1', webpushRoutes)
app.route('/v1', accountRoutes)
app.route('/v1', adminRoutes)
app.route('/', attachmentRoutes)
app.route('/', topicRoutes)

// Wrap the fetch handler so that non-API requests fall through to the static assets (frontend SPA).
// With run_worker_first = true, ALL requests reach the Worker; we try assets first for non-API
// GET requests, then let Hono match API/topic routes.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // For GET requests to non-API paths, try static assets first so the SPA handles its own routes.
    // Falls through to Hono if the asset doesn't exist (404).
    if (request.method === 'GET' && !url.pathname.startsWith('/v1/')) {
      try {
        const assets = (env as any).ASSETS as Fetcher
        const assetResponse = await assets.fetch(request)
        if (assetResponse.status !== 404) {
          return assetResponse
        }
      } catch {
        // ASSETS.fetch may throw on methods it can't serve
      }
    }

    // Let Hono try to match an API or topic route
    return await app.fetch(request, env, ctx)
  },
}

export { TopicDO } from './do/topic'
