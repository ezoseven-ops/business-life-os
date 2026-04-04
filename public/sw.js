// ─────────────────────────────────────────────
// Business Life OS — Service Worker
// Minimal cache-first for app shell.
// Network-first for API and dynamic routes.
// ─────────────────────────────────────────────

const CACHE_NAME = 'blos-v1'

const SHELL_ASSETS = [
  '/',
  '/manifest.json',
]

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never cache API, auth, or webhook routes
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    event.request.method !== 'GET'
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        // Cache successful GET responses for static assets
        if (response.ok && url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      return cached || fetched
    })
  )
})
