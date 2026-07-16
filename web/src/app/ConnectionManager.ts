import { Connection } from './Connection'
import type { Message } from '@ntfy-cf/shared'

type MessageHandler = (msg: Message, topic: string) => void
type StatusHandler = (topic: string, status: 'connected' | 'disconnected' | 'connecting') => void

class ConnectionManager {
  private connections = new Map<string, Connection>()
  private desiredTopics = new Set<string>()
  private messageHandler: MessageHandler | null = null
  private statusHandlers: StatusHandler[] = []

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler)
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler)
    }
  }

  subscribe(topic: string): void {
    this.desiredTopics.add(topic)
    this.ensureConnection(topic)
  }

  unsubscribe(topic: string): void {
    this.desiredTopics.delete(topic)
    const conn = this.connections.get(topic)
    if (conn) {
      conn.destroy()
      this.connections.delete(topic)
      this.notifyStatus(topic, 'disconnected')
    }
  }

  setTopics(topics: string[]): void {
    const desired = new Set(topics)
    for (const topic of this.desiredTopics) {
      if (!desired.has(topic)) {
        this.unsubscribe(topic)
      }
    }
    this.desiredTopics = desired
    for (const topic of desired) {
      if (!this.connections.has(topic)) {
        this.subscribe(topic)
      }
    }
  }

  isConnected(topic: string): boolean {
    return this.connections.get(topic)?.isConnected() ?? false
  }

  disconnectAll(): void {
    for (const [topic, conn] of this.connections) {
      conn.destroy()
      this.notifyStatus(topic, 'disconnected')
    }
    this.connections.clear()
    this.desiredTopics.clear()
  }

  private ensureConnection(topic: string): void {
    if (this.connections.has(topic)) return

    const conn = new Connection(topic, {
      onMessage: (msg) => {
        this.messageHandler?.(msg, topic)
      },
      onOpen: () => {
        this.notifyStatus(topic, 'connected')
      },
      onClose: () => {
        this.notifyStatus(topic, 'disconnected')
      },
      onError: () => {
        this.notifyStatus(topic, 'disconnected')
      },
    })

    this.connections.set(topic, conn)
    conn.connect()
    this.notifyStatus(topic, 'connecting')
  }

  private notifyStatus(topic: string, status: 'connected' | 'disconnected' | 'connecting'): void {
    for (const handler of this.statusHandlers) {
      handler(topic, status)
    }
  }
}

export const connectionManager = new ConnectionManager()
export default connectionManager
