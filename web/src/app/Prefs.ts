import db from './db'

type PrefValue = string | number | boolean | Record<string, unknown> | unknown[] | null

class PrefsManager {
  private cache = new Map<string, PrefValue>()

  private defaults: Record<string, PrefValue> = {
    theme: 'system',
    sound: 'default',
    soundEnabled: true,
    vibrationEnabled: true,
    desktopNotifications: true,
    webPushEnabled: false,
    dateFormat: 'relative',
    timeFormat: '24h',
    defaultPriority: 3,
    defaultDeleteAfter: 0,
    muteNewTopics: false,
    showRead: true,
    showPriority: true,
    showTags: true,
    showTimestamps: true,
    infiniteScroll: true,
    pageSize: 50,
    locale: 'en',
  }

  async get(key: string): Promise<PrefValue> {
    if (this.cache.has(key)) return this.cache.get(key)!
    try {
      const pref = await db.prefs.get(key)
      const value = pref?.value ?? this.defaults[key] ?? null
      this.cache.set(key, value as PrefValue)
      return value as PrefValue
    } catch {
      return this.defaults[key] ?? null
    }
  }

  async set(key: string, value: PrefValue): Promise<void> {
    this.cache.set(key, value)
    try {
      await db.prefs.put({ key, value })
    } catch (err) {
      console.error('Failed to save pref:', err)
    }
  }

  async getAll(): Promise<Record<string, PrefValue>> {
    const all: Record<string, PrefValue> = { ...this.defaults }
    try {
      const prefs = await db.prefs.toArray()
      for (const p of prefs) {
        all[p.key] = p.value as PrefValue
      }
    } catch { /* ignore */ }
    return all
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
    try {
      await db.prefs.delete(key)
    } catch { /* ignore */ }
  }

  async resetAll(): Promise<void> {
    this.cache.clear()
    try {
      await db.prefs.clear()
    } catch { /* ignore */ }
  }
}

export const prefsManager = new PrefsManager()
export default prefsManager
