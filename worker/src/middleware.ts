import { Context, Next } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from './index'
import type { AuthInfo } from './types'

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('$')
  const algo = parts[0]
  const iterations64 = parts[1]
  const salt64 = parts[2]
  const hash64 = parts[3]
  if (!algo || !iterations64 || !salt64 || !hash64) return false
  if (algo !== 'scrypt' && algo !== 'pbkdf2') return false
  const iterations = parseInt(atob(iterations64), 10)
  const salt = Uint8Array.from(atob(salt64), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key, 256
  )
  const expectedBytes = Uint8Array.from(atob(hash64), c => c.charCodeAt(0))
  const derivedBytes = new Uint8Array(derived)
  return derivedBytes.length === expectedBytes.length && derivedBytes.every((b, i) => b === expectedBytes[i])
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 600000
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key, 256
  )
  const saltB64 = btoa(String.fromCharCode(...salt))
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derived)))
  const iterB64 = btoa(String(iterations))
  return `pbkdf2$${iterB64}$${saltB64}$${hashB64}`
}

export async function generateToken(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function authenticate(c: Context<Env>): Promise<AuthInfo> {
  const { DB } = env(c)

  const authHeader = c.req.header('authorization') || c.req.header('Authorization')
  const authQuery = c.req.query('auth')

  let token: string | null = null

  if (authHeader) {
    if (authHeader.startsWith('Basic ')) {
      const decoded = atob(authHeader.slice(6))
      const colonIdx = decoded.indexOf(':')
      if (colonIdx === -1) return { userId: 'u_everyone', username: '*', role: 'anonymous', authenticated: false }
      const username = decoded.substring(0, colonIdx)
      const password = decoded.substring(colonIdx + 1)
      const user = await DB.prepare('SELECT id, user_name, pass, role FROM user WHERE user_name = ? AND deleted IS NULL').bind(username).first<{ id: string; user_name: string; pass: string; role: string }>()
      if (!user) return { userId: 'u_everyone', username: '*', role: 'anonymous', authenticated: false }
      const valid = await verifyPassword(password, user.pass)
      if (!valid) {
        return { userId: 'u_everyone', username: '*', role: 'anonymous', authenticated: false }
      }
      return { userId: user.id, username: user.user_name, role: user.role as AuthInfo['role'], authenticated: true }
    } else if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    } else if (authHeader.startsWith('nk')) {
      token = authHeader
    }
  } else if (authQuery) {
    token = authQuery
  }

  if (token) {
    const t = await DB.prepare('SELECT user_id FROM user_token WHERE token = ? AND (expires = 0 OR expires > ?)').bind(token, Math.floor(Date.now() / 1000)).first<{ user_id: string }>()
    if (t) {
      await DB.prepare('UPDATE user_token SET last_access = ? WHERE token = ?').bind(Math.floor(Date.now() / 1000), token).run()
      const user = await DB.prepare('SELECT id, user_name, role FROM user WHERE id = ? AND deleted IS NULL').bind(t.user_id).first<{ id: string; user_name: string; role: string }>()
      if (user) {
        return { userId: user.id, username: user.user_name, role: user.role as AuthInfo['role'], authenticated: true }
      }
    }
  }

  return { userId: 'u_everyone', username: '*', role: 'anonymous', authenticated: false }
}

export async function requireAuth(c: Context<Env>): Promise<AuthInfo> {
  const auth = await authenticate(c)
  if (!auth.authenticated) {
    throw new AuthError('Unauthorized')
  }
  return auth
}

export async function requireAdmin(c: Context<Env>): Promise<AuthInfo> {
  const auth = await authenticate(c)
  if (!auth.authenticated || auth.role !== 'admin') {
    throw new AuthError('Forbidden')
  }
  return auth
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export function generateId(length = 12): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

export function generateSequenceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `${timestamp}${random}`
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}

export function parseTags(tagsStr: string): string[] {
  if (!tagsStr) return []
  return tagsStr.split(',').map(t => t.trim()).filter(Boolean)
}

export function formatTags(tags: string[]): string {
  return tags.join(',')
}

export function parseActions(actionsStr: string): string {
  if (!actionsStr || actionsStr === '[]') return '[]'
  try {
    const parsed = JSON.parse(actionsStr)
    if (!Array.isArray(parsed)) return '[]'
    return JSON.stringify(parsed)
  } catch {
    return '[]'
  }
}
