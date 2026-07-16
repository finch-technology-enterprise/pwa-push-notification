import type { User, Account } from '@ntfy-cf/shared'
import db from './db'

class SessionManager {
  private currentUser: User | null = null
  private currentAccount: Account | null = null
  private listeners: Array<() => void> = []

  getUser(): User | null {
    return this.currentUser
  }

  getAccount(): Account | null {
    return this.currentAccount
  }

  async setUser(user: User | null): Promise<void> {
    this.currentUser = user
    this.notify()
  }

  async setAccount(account: Account | null): Promise<void> {
    this.currentAccount = account
    this.notify()
  }

  async loadFromStorage(): Promise<void> {
    try {
      const users = await db.users.toArray()
      const user = users[0]
      if (user) {
        this.currentUser = {
          id: user.topicUser || user.username,
          user: user.username,
          role: 'user',
          prefs: {},
          sync_topic: '',
          created: 0,
        }
      }
    } catch { /* ignore */ }
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null
  }

  async logout(): Promise<void> {
    try {
      await db.users.clear()
    } catch { /* ignore */ }
    this.currentUser = null
    this.currentAccount = null
    this.notify()
  }

  onChange(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export const sessionManager = new SessionManager()
export default sessionManager
