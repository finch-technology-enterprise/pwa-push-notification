import type { Message } from '@ntfy-cf/shared'
import db, { type StoredNotification, type StoredSubscription } from './db'

class SubscriptionManager {
  async getSubscriptions(): Promise<StoredSubscription[]> {
    const subs = await db.subscriptions.orderBy('position').toArray()
    return subs
  }

  async getSubscription(topic: string): Promise<StoredSubscription | undefined> {
    return db.subscriptions.get(topic)
  }

  async addSubscription(sub: StoredSubscription): Promise<void> {
    const max = await db.subscriptions.count()
    await db.subscriptions.put({
      ...sub,
      position: sub.position ?? max,
    })
  }

  async removeSubscription(topic: string): Promise<void> {
    await db.subscriptions.delete(topic)
    await db.notifications.where('topic').equals(topic).delete()
  }

  async updateSubscription(topic: string, updates: Partial<StoredSubscription>): Promise<void> {
    const existing = await db.subscriptions.get(topic)
    if (existing) {
      await db.subscriptions.put({ ...existing, ...updates })
    }
  }

  async clearAllSubscriptions(): Promise<void> {
    await db.subscriptions.clear()
  }

  async getNotifications(
    topic?: string,
    limit = 50,
    before?: number,
  ): Promise<StoredNotification[]> {
    let collection = db.notifications.orderBy('time').reverse()
    if (topic) {
      collection = db.notifications
        .where('topic')
        .equals(topic)
        .reverse()
        .sortBy('time') as unknown as typeof collection
      const items = await db.notifications
        .where('topic')
        .equals(topic)
        .reverse()
        .limit(limit)
        .toArray()
      return items
    }
    const items = await collection.limit(limit).toArray()
    return items
  }

  async addNotification(msg: Message): Promise<void> {
    const existing = await db.notifications.get(msg.id)
    if (existing) return

    await db.notifications.put({
      id: msg.id,
      topic: msg.topic,
      time: msg.time,
      expires: msg.expires,
      title: msg.title,
      message: msg.message,
      priority: msg.priority,
      tags: msg.tags,
      click: msg.click,
      icon: msg.icon,
      actions: msg.actions ? JSON.stringify(msg.actions) : undefined,
      attachment: msg.attachment ? JSON.stringify(msg.attachment) : undefined,
      content_type: msg.content_type,
      encoding: msg.encoding,
      poll_id: msg.poll_id,
      read: 0,
    })
  }

  async deleteNotification(id: string): Promise<void> {
    await db.notifications.delete(id)
  }

  async clearTopic(topic: string): Promise<void> {
    await db.notifications.where('topic').equals(topic).delete()
  }

  async clearAll(): Promise<void> {
    await db.notifications.clear()
  }

  async markAsRead(topic: string, time?: number): Promise<void> {
    const sub = await db.subscriptions.get(topic)
    if (sub) {
      await db.subscriptions.put({
        ...sub,
        lastRead: time ?? Math.floor(Date.now() / 1000),
      })
    }
    await db.notifications
      .where('topic')
      .equals(topic)
      .modify({ read: 1 })
  }

  async markAllAsRead(): Promise<void> {
    const subs = await db.subscriptions.toArray()
    const now = Math.floor(Date.now() / 1000)
    for (const sub of subs) {
      await db.subscriptions.put({ ...sub, lastRead: now })
    }
    await db.notifications.where('read').equals(0).modify({ read: 1 })
  }

  async getUnreadCount(topic?: string): Promise<number> {
    if (topic) {
      const sub = await db.subscriptions.get(topic)
      if (!sub || !sub.lastRead) {
        const count = await db.notifications.where('topic').equals(topic).count()
        return count
      }
      const count = await db.notifications
        .where('[topic+time]')
        .between([topic, sub.lastRead + 1], [topic, Number.MAX_SAFE_INTEGER])
        .count()
      return count
    }
    let total = 0
    const subs = await db.subscriptions.toArray()
    for (const sub of subs) {
      total += await this.getUnreadCount(sub.topic)
    }
    return total
  }
}

export const subscriptionManager = new SubscriptionManager()
export default subscriptionManager
