import { TOPIC_REGEX } from '@ntfy-cf/shared'
import { baseUrl, appRoot } from './config'

export function apiUrl(path: string): string {
  const base = baseUrl || ''
  return `${base}/v1${path}`
}

export function wsUrl(topic: string): string {
  const base = baseUrl || ''
  const wsProto = base.startsWith('https') ? 'wss' : 'ws'
  const host = base.replace(/^https?:\/\//, '')
  return `${wsProto}://${host}/v1/ws?topic=${encodeURIComponent(topic)}`
}

export function topicUrl(topic: string): string {
  return `${appRoot}${topic}`
}

export function isTopicValid(topic: string): boolean {
  return TOPIC_REGEX.test(topic)
}

export function formatTime(unix: number): string {
  const d = new Date(unix * 1000)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(unix: number): string {
  const d = new Date(unix * 1000)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(unix: number): string {
  return `${formatDate(unix)} ${formatTime(unix)}`
}

export function formatRelativeTime(unix: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - unix
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return formatDate(unix)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function priorityLabel(p: number): string {
  const labels: Record<number, string> = {
    1: 'min', 2: 'low', 3: 'default', 4: 'high', 5: 'urgent',
  }
  return labels[p] || 'default'
}

export function extractAuthToken(header: string): string | null {
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

export function getAuthHeader(token: string): string {
  return `Bearer ${token}`
}

export function getQueryParams(): Record<string, string> {
  const params: Record<string, string> = {}
  const search = window.location.search.substring(1)
  for (const part of search.split('&')) {
    const [key, value] = part.split('=')
    if (key) params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : ''
  }
  return params
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData.split('').map((c) => c.charCodeAt(0)))
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => { inThrottle = false }, limit)
    }
  }
}
