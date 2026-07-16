export const NTFY_EVENTS = {
  MESSAGE: 'message' as const,
  KEEPALIVE: 'keepalive' as const,
  OPEN: 'open' as const,
  MESSAGE_DELETE: 'message_delete' as const,
  MESSAGE_CLEAR: 'message_clear' as const,
  POLL_REQUEST: 'poll_request' as const,
}

export const ACTION_TYPES = {
  BATCH: 'ntfy_batch',
} as const
