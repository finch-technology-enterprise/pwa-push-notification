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
// With run_worker_first = true, ALL requests reach the Worker; we try Hono first, then ASSETS.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Let Hono try to match an API route first
    const response = await app.fetch(request, env, ctx)
    // Hono's notFound handler returns a JSON 404 for unmatched routes.
    // When that happens, serve the static assets (frontend SPA) instead.
    if (response.status === 404) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        // This was Hono's JSON 404 — try the frontend
        try {
          const assets = (env as any).ASSETS as Fetcher
          return await assets.fetch(request)
        } catch {
          // ASSETS.fetch may throw if the request can't be served (e.g. non-GET)
          return response
        }
      }
    }
    return response
  },
}

export { TopicDO } from './do/topic'
