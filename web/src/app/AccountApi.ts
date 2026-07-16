import type { Account, ApiSuccess, WebPushSubscription } from '@ntfy-cf/shared'
import { apiUrl, getAuthHeader } from './utils'
import { apiErrorFromResponse } from './errors'

async function accountRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = getAuthHeader(token)
  }
  const response = await fetch(apiUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) {
    throw apiErrorFromResponse(data as { code?: number; http_code?: number; error?: string; link?: string })
  }
  return data as T
}

export async function signup(
  user: string,
  password: string,
  token?: string,
): Promise<Account> {
  return accountRequest<Account>('POST', '/account', { user, password }, token)
}

export async function login(
  user: string,
  password: string,
  token?: string,
): Promise<Account> {
  return accountRequest<Account>('POST', '/account/auth', { user, password }, token)
}

export async function getAccount(token: string): Promise<Account> {
  return accountRequest<Account>('GET', '/account', undefined, token)
}

export async function updateAccount(
  token: string,
  updates: Record<string, unknown>,
): Promise<Account> {
  return accountRequest<Account>('PUT', '/account', updates, token)
}

export async function deleteAccount(token: string): Promise<ApiSuccess> {
  return accountRequest<ApiSuccess>('DELETE', '/account', undefined, token)
}

export async function createToken(
  token: string,
  label?: string,
): Promise<{ token: string; label?: string; id: string }> {
  return accountRequest('POST', '/account/token', { label }, token)
}

export async function extendToken(token: string): Promise<{ token: string }> {
  return accountRequest('POST', '/account/token/extend', undefined, token)
}

export async function deleteToken(token: string, tokenId: string): Promise<ApiSuccess> {
  return accountRequest<ApiSuccess>('DELETE', `/account/token/${tokenId}`, undefined, token)
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<ApiSuccess> {
  return accountRequest<ApiSuccess>(
    'PUT',
    '/account/password',
    { current_password: currentPassword, new_password: newPassword },
    token,
  )
}

export async function updateSettings(
  token: string,
  settings: Record<string, unknown>,
): Promise<Account> {
  return accountRequest<Account>('PUT', '/account/settings', settings, token)
}

export async function addSubscription(
  token: string,
  topic: string,
  baseUrl?: string,
): Promise<Account> {
  return accountRequest<Account>(
    'PUT',
    '/account/subscription',
    { topic, base_url: baseUrl },
    token,
  )
}

export async function removeSubscription(
  token: string,
  topic: string,
): Promise<Account> {
  return accountRequest<Account>(
    'DELETE',
    `/account/subscription/${encodeURIComponent(topic)}`,
    undefined,
    token,
  )
}

export async function addReservation(
  token: string,
  topic: string,
  permission?: string,
): Promise<Account> {
  return accountRequest<Account>(
    'PUT',
    '/account/reservation',
    { topic, permission },
    token,
  )
}

export async function deleteReservation(
  token: string,
  topic: string,
): Promise<Account> {
  return accountRequest<Account>(
    'DELETE',
    `/account/reservation/${encodeURIComponent(topic)}`,
    undefined,
    token,
  )
}

export async function addEmail(
  token: string,
  email: string,
): Promise<Account> {
  return accountRequest<Account>('PUT', '/account/email', { email }, token)
}

export async function verifyEmail(token: string, code: string): Promise<ApiSuccess> {
  return accountRequest<ApiSuccess>(
    'POST',
    '/account/email/verify',
    { code },
    token,
  )
}

export async function deleteEmail(token: string, email: string): Promise<Account> {
  return accountRequest<Account>(
    'DELETE',
    `/account/email/${encodeURIComponent(email)}`,
    undefined,
    token,
  )
}

export async function requestPasswordReset(email: string): Promise<ApiSuccess> {
  return accountRequest<ApiSuccess>('POST', '/account/password/reset', { email })
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<ApiSuccess> {
  return accountRequest<ApiSuccess>(
    'POST',
    '/account/password/change',
    { token, password },
  )
}

export async function updateWebPush(
  token: string,
  sub: PushSubscription,
): Promise<WebPushSubscription> {
  const data = sub.toJSON()
  return accountRequest<WebPushSubscription>(
    'PUT',
    '/account/webpush',
    {
      endpoint: data.endpoint,
      key_auth: data.keys?.auth,
      key_p256dh: data.keys?.p256dh,
    },
    token,
  )
}

export async function deleteWebPush(token: string): Promise<ApiSuccess> {
  return accountRequest<ApiSuccess>('DELETE', '/account/webpush', undefined, token)
}
