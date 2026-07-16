import type { Message, EventType } from '@ntfy-cf/shared'
import { wsUrl } from './utils'
import { keepaliveInterval } from './config'
import { subscriptionManager } from './SubscriptionManager'

export type ConnectionEventHandler = {
  onMessage?: (msg: Message) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: Event) => void
}

export class Connection {
  private ws: WebSocket | null = null
  private topic: string
  private handlers: ConnectionEventHandler
  private reconnectAttempts = 0
  private maxReconnectDelay = 30000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false
  private since: { id?: string; time?: number } = {}

  private static readonly BASE_DELAY = 1000
  private static readonly MAX_DELAY = 30000

  constructor(topic: string, handlers: ConnectionEventHandler) {
    this.topic = topic
    this.handlers = handlers
  }

  setSince(since: { id?: string; time?: number }): void {
    this.since = since
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSince()
    }
  }

  connect(): void {
    if (this.destroyed) return
    this.disconnect()
    this.createWebSocket()
  }

  disconnect(): void {
    this.clearTimers()
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.close()
      this.ws = null
    }
  }

  destroy(): void {
    this.destroyed = true
    this.disconnect()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private createWebSocket(): void {
    try {
      const url = wsUrl(this.topic)
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.sendSince()
        this.startKeepalive()
        this.handlers.onOpen?.()
      }

      this.ws.onmessage = (event) => {
        try {
          const messages = event.data
            .split('\n')
            .filter((l: string) => l.trim())
            .map((l: string) => JSON.parse(l) as Message)

          for (const msg of messages) {
            if (msg.event === 'message' || msg.event === 'open') {
              if (msg.event === 'message') {
                subscriptionManager.addNotification(msg)
                this.handlers.onMessage?.(msg)
              }
            } else if (msg.event === 'keepalive') {
              this.updateSince(msg)
            } else if (msg.event === 'message_delete') {
              if (msg.id) {
                subscriptionManager.deleteNotification(msg.id)
              }
              this.handlers.onMessage?.(msg)
            } else if (msg.event === 'message_clear') {
              subscriptionManager.clearTopic(msg.topic)
              this.handlers.onMessage?.(msg)
            } else if (msg.event === 'poll_request') {
              this.handlers.onMessage?.(msg)
            }
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err)
        }
      }

      this.ws.onclose = () => {
        this.clearTimers()
        this.handlers.onClose?.()
        this.scheduleReconnect()
      }

      this.ws.onerror = (err) => {
        this.handlers.onError?.(err)
      }
    } catch (err) {
      console.error('Failed to create WebSocket:', err)
      this.scheduleReconnect()
    }
  }

  private sendSince(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const parts: string[] = []
    if (this.since.id) parts.push(`since=${this.since.id}`)
    if (this.since.time) parts.push(`since=${this.since.time}`)
    if (parts.length) {
      this.ws.send(parts.join('\n'))
    }
  }

  private updateSince(msg: Message): void {
    if (msg.time) {
      this.since = { time: msg.time }
    } else if (msg.id) {
      this.since = { id: msg.id }
    }
  }

  private startKeepalive(): void {
    this.keepaliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('')
      }
    }, (keepaliveInterval || 45) * 1000)
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    const delay = Math.min(
      Connection.BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      Connection.MAX_DELAY,
    )
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) {
        this.connect()
      }
    }, delay + Math.random() * 1000)
  }
}
