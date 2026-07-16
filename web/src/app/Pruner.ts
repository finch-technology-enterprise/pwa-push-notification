import db from './db'

class Pruner {
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null

  start(): void {
    if (this.running) return
    this.running = true
    this.prune()
    this.intervalId = setInterval(() => this.prune(), 5 * 60 * 1000)
  }

  stop(): void {
    this.running = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async prune(): Promise<void> {
    try {
      const subscriptions = await db.subscriptions.toArray()
      const now = Math.floor(Date.now() / 1000)
      const keepTime = 7 * 24 * 3600

      for (const sub of subscriptions) {
        const cutoff = now - keepTime
        await db.notifications
          .where('[topic+time]')
          .between([sub.topic, 0], [sub.topic, cutoff])
          .delete()
      }

      const totalBefore = await db.notifications.count()
      const maxNotifications = 10000
      if (totalBefore > maxNotifications) {
        const toDelete = totalBefore - maxNotifications
        const ids = await db.notifications
          .orderBy('time')
          .limit(toDelete)
          .primaryKeys()
        await db.notifications.bulkDelete(ids as string[])
      }
    } catch (err) {
      console.error('Pruner error:', err)
    }
  }
}

export const pruner = new Pruner()
export default pruner
