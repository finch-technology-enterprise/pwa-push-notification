/* global self, caches, Response, clients, importScripts, workbox */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js')

workbox.setConfig({ debug: false })

const CACHE_NAME = 'ntfy-v1'
const STATIC_CACHE = 'ntfy-static-v1'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/static/css/fonts.css',
  '/config.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      await cache.addAll(PRECACHE_URLS)
      const manifest = self.__WB_MANIFEST
      if (manifest) {
        for (const entry of manifest) {
          const url = typeof entry === 'string' ? entry : entry.url
          if (url && !PRECACHE_URLS.includes(url)) {
            try {
              await cache.add(url)
            } catch { /* ignore */ }
          }
        }
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== CACHE_NAME) {
            return caches.delete(key)
          }
        }),
      )
      await self.clients.claim()
    })(),
  )
})

workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new workbox.strategies.NetworkFirst({
    cacheName: CACHE_NAME,
    plugins: [
      new workbox.expiry.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 }),
    ],
  }),
)

workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/static/'),
  new workbox.strategies.CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new workbox.expiry.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 }),
    ],
  }),
)

workbox.routing.registerRoute(
  ({ url }) => url.pathname.endsWith('.js') || url.pathname.endsWith('.css'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: STATIC_CACHE,
  }),
)

workbox.routing.registerRoute(
  ({ url }) => url.pathname === '/config.js',
  new workbox.strategies.NetworkFirst({
    cacheName: CACHE_NAME,
    plugins: [
      new workbox.expiry.ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 60 }),
    ],
  }),
)

workbox.routing.registerRoute(
  ({ url }) => url.pathname === '/',
  new workbox.strategies.NetworkFirst({
    cacheName: CACHE_NAME,
    plugins: [
      new workbox.expiry.ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 60 }),
    ],
  }),
)

const broadcast = new BroadcastChannel('ntfy')

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { message: event.data.text() }
  }

  const {
    id,
    time,
    event: eventType,
    topic,
    title,
    message,
    priority = 3,
    tags = [],
    click,
    icon,
    actions = [],
    attachment,
    content_type,
  } = data

  if (eventType === 'message' || data.message) {
    const tag = topic ? `ntfy-${topic}` : 'ntfy'
    const body = message || ''

    let tagList = ''
    if (tags && tags.length) {
      tagList = tags.join(' ')
    }

    const notificationTitle = title || topic || 'ntfy'
    const notificationBody = tagList ? `${tagList} ${body}` : body

    const notificationOptions = {
      tag,
      body: notificationBody,
      icon: icon || '/static/images/pwa-192x192.png',
      badge: '/static/images/pwa-192x192.png',
      timestamp: time ? time * 1000 : Date.now(),
      data: {
        id,
        time,
        event: eventType,
        topic,
        title,
        message: body,
        priority,
        tags,
        click,
        url: click,
        actions,
        attachment,
        content_type,
      },
      vibrate: priority && priority >= 4 ? [200, 100, 200] : [100],
      requireInteraction: priority && priority >= 4,
      renotify: true,
      silent: false,
    }

    if (actions && actions.length) {
      notificationOptions.actions = actions.map((a) => ({
        action: a.action === 'view' ? a.url || a.id : a.id,
        title: a.label,
        icon: a.icon,
      }))
    }

    event.waitUntil(
      (async () => {
        broadcast.postMessage({
          type: 'playSound',
          topic,
          priority,
          tags,
        })
        try {
          await self.registration.showNotification(notificationTitle, notificationOptions)
        } catch (err) {
          console.error('Failed to show notification:', err)
        }
      })(),
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification
  const data = notification.data || {}
  const action = event.action

  notification.close()

  if (data.topic) {
    const topicUrl = `/${data.topic}`

    if (action) {
      const matchedAction = (data.actions || []).find(
        (a) => a.id === action || a.url === action || a.id === action,
      )
      if (matchedAction) {
        if (matchedAction.action === 'view' && matchedAction.url) {
          event.waitUntil(clients.openWindow(matchedAction.url))
          return
        }
        if (matchedAction.action === 'http' && matchedAction.url) {
          event.waitUntil(
            (async () => {
              try {
                await fetch(matchedAction.url, {
                  method: matchedAction.method || 'POST',
                  headers: matchedAction.headers || { 'Content-Type': 'application/json' },
                  body: matchedAction.body || null,
                })
              } catch (err) {
                console.error('Action HTTP request failed:', err)
              }
            })(),
          )
          return
        }
      }
    }

    event.waitUntil(
      (async () => {
        const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clientsList) {
          if (client.url.includes(topicUrl) && 'focus' in client) {
            await client.focus()
            return
          }
        }
        if (data.click || data.url) {
          await clients.openWindow(data.click || data.url)
        } else {
          await clients.openWindow(topicUrl)
        }
      })(),
    )
  } else {
    event.waitUntil(
      (async () => {
        const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clientsList) {
          if ('focus' in client) {
            await client.focus()
            return
          }
        }
        await clients.openWindow('/')
      })(),
    )
  }
})

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data
  if (data && data.topic) {
    broadcast.postMessage({
      type: 'notificationClose',
      topic: data.topic,
      id: data.id,
    })
  }
})

self.addEventListener('message', (event) => {
  const msg = event.data
  if (!msg) return

  switch (msg.type) {
    case 'clear':
      if (msg.topic) {
        broadcast.postMessage({ type: 'clear', topic: msg.topic, id: msg.id })
      }
      break
    case 'clearAll':
      broadcast.postMessage({ type: 'clearAll' })
      break
    case 'skipWaiting':
      self.skipWaiting()
      break
    case 'setBadge':
      if ('setAppBadge' in navigator) {
        navigator.setAppBadge(msg.count || 0)
      }
      break
    case 'clearBadge':
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge()
      }
      break
  }
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'ntfy-token-extend') {
    event.waitUntil(
      (async () => {
        const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clientsList) {
          client.postMessage({ type: 'extendToken' })
        }
      })(),
    )
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST' && event.request.url.includes('/v1/poll')) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request)
          return response
        } catch {
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      })(),
    )
  }
})
