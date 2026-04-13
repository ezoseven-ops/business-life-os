// ─────────────────────────────────────────────
// Business Life OS — Service Worker
// Network-first for HTML navigation requests.
// Cache-first for immutable static assets only.
// ─────────────────────────────────────────────

const CACHE_NAME = 'blos-v2'

// Install — skip waiting to activate immediately
self.addEventListener('install', (event) => {
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

// Fetch strategy:
//   - Navigation requests (HTML pages): network-first, no cache
//   - API / auth / _next: pass through (browser default)
//   - Static assets (.js, .css, images, fonts): cache-first with network update
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Pass through: API, auth, Next.js internals, non-GET
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    event.request.method !== 'GET'
  ) {
    return
  }

  // Navigation requests (HTML pages) — always network-first, never cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback: return a simple offline page
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{background:#0F1115;color:#F3F1EA;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0}div{text-align:center}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#8E8A83;font-size:0.9rem}</style></head><body><div><h1>You\'re offline</h1><p>Check your connection and try again.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      })
    )
    return
  }

  // Static assets — cache-first with network update
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        return cached || fetched
      })
    )
    return
  }

  // Everything else — network only
})
