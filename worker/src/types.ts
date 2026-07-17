export type EventType = 'open' | 'keepalive' | 'message' | 'message_delete' | 'message_clear' | 'poll_request'

export type Priority = 1 | 2 | 3 | 4 | 5

export type UserRole = 'anonymous' | 'admin' | 'user'

export type Permission = 'read-write' | 'read-only' | 'write-only' | 'deny-all'

export interface PublishMessage {
  id: string
  sequence_id: string
  time: number
  event: EventType
  expires?: number
  scheduled_for?: number
  topic: string
  title?: string
  message?: string
  priority?: Priority
  tags?: string[]
  click?: string
  icon?: string
  actions?: Action[]
  attachment?: Attachment
  poll_id?: string
  content_type?: string
  encoding?: string
}

export interface Attachment {
  name: string
  type?: string
  size?: number
  expires?: number
  url: string
}

export interface Action {
  id: string
  action: 'view' | 'broadcast' | 'http' | 'copy'
  label: string
  clear?: boolean
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: string
  intent?: string
  extras?: Record<string, string>
  value?: string
}

export interface WebPushSubscription {
  id: string
  endpoint: string
  key_auth: string
  key_p256dh: string
  user_id: string
  topics: string[]
  updated_at: number
}

export interface RateLimitInfo {
  count: number
  reset: number
}

export interface AuthInfo {
  userId: string
  username: string
  role: UserRole
  authenticated: boolean
}

export const DISALLOWED_TOPICS_DEFAULT = [
  'docs', 'static', 'file', 'app', 'metrics', 'account',
  'settings', 'signup', 'login', 'v1',
] as const

export const TOPIC_REGEX = /^[-_A-Za-z0-9]{1,64}$/
