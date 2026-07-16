import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from '../index'
import { initDatabase } from '../db'
import { DISALLOWED_TOPICS_DEFAULT } from '../types'
import { hashPassword } from '../middleware'

const app = new Hono<Env>()

app.get('/config', async (c) => {
  const {
    BASE_URL,
    ENABLE_SIGNUP,
    ENABLE_LOGIN,
    DISALLOWED_TOPICS,
    WEB_PUSH_PUBLIC_KEY,
    VISITOR_SUBSCRIPTION_LIMIT,
    VISITOR_MESSAGE_DAILY_LIMIT,
    MESSAGE_SIZE_LIMIT,
    KEEPALIVE_INTERVAL,
    DB,
  } = env(c)

  await initDatabase(DB)

  const disallowed = DISALLOWED_TOPICS
    ? DISALLOWED_TOPICS.split(',').map(s => s.trim()).filter(Boolean)
    : [...DISALLOWED_TOPICS_DEFAULT]

  const config = {
    'base-url': BASE_URL || 'http://localhost',
    'app-root': '/',
    'enable-signup': ENABLE_SIGNUP !== 'false',
    'enable-login': ENABLE_LOGIN !== 'false',
    'enable-reservations': false,
    'enable-payments': false,
    'require-login': false,
    'web-push-public-key': WEB_PUSH_PUBLIC_KEY || undefined,
    'disallowed-topics': disallowed,
    'config-hash': 'v1',
    'visitor-subscription-limit': parseInt(VISITOR_SUBSCRIPTION_LIMIT || '30', 10),
    'visitor-message-daily-limit': parseInt(VISITOR_MESSAGE_DAILY_LIMIT || '0', 10),
    'message-size-limit': parseInt(MESSAGE_SIZE_LIMIT || '4096', 10),
    'keepalive-interval': parseInt(KEEPALIVE_INTERVAL || '45', 10),
  }

  return c.json(config)
})

app.get('/config.js', async (c) => {
  const {
    BASE_URL,
    ENABLE_SIGNUP,
    ENABLE_LOGIN,
    DISALLOWED_TOPICS,
    WEB_PUSH_PUBLIC_KEY,
    VISITOR_SUBSCRIPTION_LIMIT,
    VISITOR_MESSAGE_DAILY_LIMIT,
    MESSAGE_SIZE_LIMIT,
    KEEPALIVE_INTERVAL,
  } = env(c)

  const disallowed = DISALLOWED_TOPICS
    ? DISALLOWED_TOPICS.split(',').map(s => s.trim()).filter(Boolean)
    : [...DISALLOWED_TOPICS_DEFAULT]

  const js = `
window.ntfyConfig = {
  "base-url": ${JSON.stringify(BASE_URL || 'http://localhost')},
  "app-root": "/",
  "enable-signup": ${ENABLE_SIGNUP !== 'false'},
  "enable-login": ${ENABLE_LOGIN !== 'false'},
  "enable-reservations": false,
  "enable-payments": false,
  "require-login": false,
  "web-push-public-key": ${JSON.stringify(WEB_PUSH_PUBLIC_KEY || null)},
  "disallowed-topics": ${JSON.stringify(disallowed)},
  "visitor-subscription-limit": ${parseInt(VISITOR_SUBSCRIPTION_LIMIT || '30', 10)},
  "visitor-message-daily-limit": ${parseInt(VISITOR_MESSAGE_DAILY_LIMIT || '0', 10)},
  "message-size-limit": ${parseInt(MESSAGE_SIZE_LIMIT || '4096', 10)},
  "keepalive-interval": ${parseInt(KEEPALIVE_INTERVAL || '45', 10)}
};
`
  return c.newResponse(js, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=300',
  })
})

export { app as configRoutes }
