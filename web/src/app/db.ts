import Dexie, { type EntityTable } from 'dexie'
import type { Message } from '@ntfy-cf/shared'

export interface StoredNotification {
  id: string
  topic: string
  time: number
  expires?: number
  title?: string
  message?: string
  priority?: number
  tags?: string[]
  click?: string
  icon?: string
  actions?: string
  attachment?: string
  content_type?: string
  encoding?: string
  poll_id?: string
  read?: number
}

export interface StoredSubscription {
  topic: string
  baseUrl: string
  displayName?: string
  muted?: number
  mutedUntil?: number
  minPriority?: number
  lastRead?: number
  position?: number
}

export interface StoredUser {
  baseUrl: string
  token: string
  username: string
  topicUser?: string
}

export interface StoredPref {
  key: string
  value: unknown
}

const db = new Dexie('ntfy') as Dexie & {
  notifications: EntityTable<StoredNotification, 'id'>
  subscriptions: EntityTable<StoredSubscription, 'topic'>
  users: EntityTable<StoredUser, 'baseUrl'>
  prefs: EntityTable<StoredPref, 'key'>
}

db.version(1).stores({
  notifications: 'id, topic, time, [topic+time]',
  subscriptions: 'topic, position',
  users: 'baseUrl',
  prefs: 'key',
})

db.version(2).stores({
  notifications: 'id, topic, time, [topic+time]',
  subscriptions: 'topic, position',
  users: 'baseUrl',
  prefs: 'key',
})

export default db
