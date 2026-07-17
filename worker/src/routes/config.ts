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
    'base_url': BASE_URL || '',
    'app_root': '/',
    'enable_signup': ENABLE_SIGNUP !== 'false',
    'enable_login': ENABLE_LOGIN !== 'false',
    'enable_reservations': false,
    'enable_payments': false,
    'enable_emails': false,
    'enable_calls': false,
    'enable_web_push': false,
    'enable_reset_password': false,
    'require_login': false,
    'billing_contact': 'billing@finchtech.my',
    'web_push_public_key': WEB_PUSH_PUBLIC_KEY || null,
    'disallowed_topics': disallowed,
    'config_hash': 'v1',
    'visitor_subscription_limit': parseInt(VISITOR_SUBSCRIPTION_LIMIT || '30', 10),
    'visitor_message_daily_limit': parseInt(VISITOR_MESSAGE_DAILY_LIMIT || '0', 10),
    'message_size_limit': parseInt(MESSAGE_SIZE_LIMIT || '4096', 10),
    'keepalive_interval': parseInt(KEEPALIVE_INTERVAL || '45', 10),
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
self.config = {
  "base_url": ${JSON.stringify(BASE_URL || '')},
  "app_root": "/",
  "enable_signup": ${ENABLE_SIGNUP !== 'false'},
  "enable_login": ${ENABLE_LOGIN !== 'false'},
  "enable_reservations": false,
  "enable_payments": false,
  "enable_emails": false,
  "enable_calls": false,
  "enable_web_push": false,
  "enable_reset_password": false,
  "require_login": false,
  "billing_contact": ${JSON.stringify('billing@finchtech.my')},
  "web_push_public_key": ${JSON.stringify(WEB_PUSH_PUBLIC_KEY || null)},
  "disallowed_topics": ${JSON.stringify(disallowed)},
  "config_hash": "v1",
  "visitor_subscription_limit": ${parseInt(VISITOR_SUBSCRIPTION_LIMIT || '30', 10)},
  "visitor_message_daily_limit": ${parseInt(VISITOR_MESSAGE_DAILY_LIMIT || '0', 10)},
  "message_size_limit": ${parseInt(MESSAGE_SIZE_LIMIT || '4096', 10)},
  "keepalive_interval": ${parseInt(KEEPALIVE_INTERVAL || '45', 10)}
};
`
  return c.newResponse(js, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=300',
  })
})

export { app as configRoutes }
