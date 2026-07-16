import db, { type StoredUser } from './db'

class UserManager {
  async getUsers(): Promise<StoredUser[]> {
    return db.users.toArray()
  }

  async getUser(baseUrl: string): Promise<StoredUser | undefined> {
    return db.users.get(baseUrl)
  }

  async saveUser(user: StoredUser): Promise<void> {
    await db.users.put(user)
  }

  async deleteUser(baseUrl: string): Promise<void> {
    await db.users.delete(baseUrl)
  }

  async getToken(baseUrl: string): Promise<string | null> {
    const user = await db.users.get(baseUrl)
    return user?.token || null
  }

  async setToken(baseUrl: string, token: string): Promise<void> {
    const existing = await db.users.get(baseUrl)
    if (existing) {
      await db.users.put({ ...existing, token })
    }
  }

  async clearAll(): Promise<void> {
    await db.users.clear()
  }
}

export const userManager = new UserManager()
export default userManager
