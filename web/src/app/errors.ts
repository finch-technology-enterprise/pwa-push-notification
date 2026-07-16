export class NtfyError extends Error {
  constructor(
    message: string,
    public code?: number,
    public httpCode?: number,
    public link?: string,
  ) {
    super(message)
    this.name = 'NtfyError'
  }
}

export class AuthError extends NtfyError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 401)
    this.name = 'AuthError'
  }
}

export class NetworkError extends NtfyError {
  constructor(message = 'Network error') {
    super(message, 0, 0)
    this.name = 'NetworkError'
  }
}

export class RateLimitError extends NtfyError {
  constructor(message = 'Rate limited') {
    super(message, 429, 429)
    this.name = 'RateLimitError'
  }
}

export function apiErrorFromResponse(data: { code?: number; http_code?: number; error?: string; link?: string }): NtfyError {
  const httpCode = data.http_code || data.code || 0
  if (httpCode === 401 || httpCode === 403) {
    return new AuthError(data.error || 'Authentication failed')
  }
  if (httpCode === 429) {
    return new RateLimitError(data.error || 'Rate limited')
  }
  return new NtfyError(data.error || 'Unknown error', data.code, httpCode, data.link)
}
