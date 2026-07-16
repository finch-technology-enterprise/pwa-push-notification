class Notifier {
  private channel: BroadcastChannel | null = null
  private audioElements = new Map<string, HTMLAudioElement>()

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('ntfy')
        this.channel.onmessage = (event) => {
          const msg = event.data
          if (msg?.type === 'playSound') {
            this.playNotificationSound(msg.priority || 3, msg.tags || [])
          }
        }
      } catch {
        this.channel = null
      }
    }
  }

  playNotificationSound(priority: number, tags: string[] = []): void {
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false'
    if (!soundEnabled) return

    const sound = localStorage.getItem('sound') || 'default'
    if (sound === 'none') return

    const soundFile = this.getSoundFile(priority)
    if (!soundFile) return

    try {
      const audio = new Audio(soundFile)
      audio.volume = 0.5
      audio.play().catch(() => {})
    } catch { /* ignore */ }
  }

  private getSoundFile(priority: number): string | null {
    const customSound = localStorage.getItem('sound')
    if (customSound && customSound !== 'default' && customSound !== 'none') {
      return customSound
    }
    if (priority >= 5) return '/static/media/urgent.ogg'
    if (priority >= 4) return '/static/media/high.ogg'
    return '/static/media/default.ogg'
  }

  showNotification(title: string, options: NotificationOptions): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    try {
      new Notification(title, options)
    } catch (err) {
      console.error('Notification error:', err)
    }
  }

  postMessage(msg: Record<string, unknown>): void {
    this.channel?.postMessage(msg)
  }
}

export const notifier = new Notifier()
export default notifier
