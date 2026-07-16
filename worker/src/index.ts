import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { env } from 'hono/adapter'
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

app.notFound((c) => c.json({
  code: 40401,
  http_code: 404,
  error: 'Not found',
  link: 'https://ntfy.sh/docs',
}, 404))

export default app

export { TopicDO } from './do/topic'
