let registration: ServiceWorkerRegistration | null = null

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    registration.addEventListener('updatefound', () => {
      const installing = registration?.installing
      if (installing) {
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New SW version available')
          }
        })
      }
    })
    registration.update()
    setInterval(() => registration?.update(), 60 * 60 * 1000)
    return registration
  } catch (err) {
    console.error('SW registration failed:', err)
    return null
  }
}

export function getRegistration(): ServiceWorkerRegistration | null {
  return registration
}

export async function subscribeWebPush(
  publicKey: string,
): Promise<PushSubscription | null> {
  const reg = registration
  if (!reg) return null
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    return sub
  } catch (err) {
    console.error('Push subscribe failed:', err)
    return null
  }
}

export async function getWebPushSubscription(): Promise<PushSubscription | null> {
  const reg = registration
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function unsubscribeWebPush(): Promise<boolean> {
  const sub = await getWebPushSubscription()
  if (!sub) return true
  return sub.unsubscribe()
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    arr[i] = rawData.charCodeAt(i)
  }
  return arr
}
