export function priorityVibration(priority: number): number[] {
  if (priority >= 5) return [200, 100, 200, 100, 200]
  if (priority >= 4) return [200, 100, 200]
  return [100]
}

export function prioritySound(priority: number): string | null {
  if (priority >= 5) return '/static/media/urgent.ogg'
  if (priority >= 4) return '/static/media/high.ogg'
  return '/static/media/default.ogg'
}

export function parseActions(actionsJson: string | undefined | null): unknown[] {
  if (!actionsJson) return []
  try {
    return JSON.parse(actionsJson)
  } catch {
    return []
  }
}

export function canNotify(): boolean {
  return 'Notification' in window && Notification.permission !== 'denied'
}

export function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return Promise.resolve('denied')
  if (Notification.permission === 'granted') return Promise.resolve('granted')
  return Notification.requestPermission()
}

export function showDesktopNotification(
  title: string,
  options: NotificationOptions,
): Notification | null {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null
  try {
    return new Notification(title, options)
  } catch {
    return null
  }
}
