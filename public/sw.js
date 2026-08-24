// Minimal offline cache for yard tablet — P5-2
const CACHE = 'scaffold-v1'
const ASSETS = ['/jobs', '/calc', '/safety', '/inventory', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))
  self.clients.claim()
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // Only cache GET navigations and static, not API POST
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      }).catch(()=> cached)
      return cached || fetchPromise
    })
  )
})
