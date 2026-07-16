import type { Message } from '@ntfy-cf/shared'
import { apiUrl, getAuthHeader } from './utils'
import { apiErrorFromResponse, NetworkError } from './errors'
import userManager from './UserManager'

async function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['Authorization'] = getAuthHeader(token)
  }

  const response = await fetch(apiUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  return response
}

async function requestJson<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await request(method, path, body, token)
  const data = await response.json()
  if (!response.ok) {
    throw apiErrorFromResponse(data as { code?: number; http_code?: number; error?: string; link?: string })
  }
  return data as T
}

async function getToken(baseUrl?: string): Promise<string | null> {
  if (baseUrl) {
    return userManager.getToken(baseUrl)
  }
  return userManager.getToken('')
}

export async function poll(
  topic: string,
  since?: string | number,
): Promise<Message[]> {
  let path = `/poll/${encodeURIComponent(topic)}`
  if (since) {
    path += `?since=${since}`
  }
  const token = await getToken()
  return requestJson<Message[]>('POST', path, undefined, token || undefined)
}

export async function publish(
  topic: string,
  body: string | FormData,
  contentType?: string,
  token?: string,
): Promise<Message> {
  if (body instanceof FormData) {
    const response = await fetch(apiUrl(`/${encodeURIComponent(topic)}`), {
      method: 'POST',
      headers: token ? { Authorization: getAuthHeader(token) } : {},
      body,
    })
    const data = await response.json()
    if (!response.ok) {
      throw apiErrorFromResponse(data as { code?: number; http_code?: number; error?: string; link?: string })
    }
    return data as Message
  }

  const headers: Record<string, string> = {}
  if (contentType) {
    headers['Content-Type'] = contentType
  } else {
    headers['Content-Type'] = 'text/plain'
  }
  if (token) {
    headers['Authorization'] = getAuthHeader(token)
  }

  const response = await fetch(apiUrl(`/${encodeURIComponent(topic)}`), {
    method: 'POST',
    headers,
    body,
  })
  const data = await response.json()
  if (!response.ok) {
    throw apiErrorFromResponse(data as { code?: number; http_code?: number; error?: string; link?: string })
  }
  return data as Message
}

export async function publishJson(
  topic: string,
  msg: Record<string, unknown>,
  token?: string,
): Promise<Message> {
  return requestJson<Message>(
    'POST',
    `/${encodeURIComponent(topic)}`,
    msg,
    token || undefined,
  )
}

export async function topicAuth(topic: string): Promise<{
  permission: string
  limit?: number
  remaining?: number
}> {
  const token = await getToken()
  return requestJson('GET', `/auth/${encodeURIComponent(topic)}`, undefined, token || undefined)
}

export async function getConfig(): Promise<{
  'base-url': string
  'app-root': string
  'enable-signup': boolean
  'enable-login': boolean
  'enable-reservations': boolean
  'enable-payments': boolean
  'require-login': boolean
  'web-push-public-key': string
  'disallowed-topics': string[]
  'visitor-subscription-limit': number
  'message-size-limit': number
  'keepalive-interval': number
}> {
  const response = await fetch(apiUrl('/config'))
  return response.json()
}

export async function health(): Promise<{ healthy: boolean }> {
  return requestJson('GET', '/health')
}

export async function stats(): Promise<{ messages: number; messages_rate: number }> {
  return requestJson('GET', '/stats')
}
