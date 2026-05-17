const CACHE_NAME = 'soubayugami-v58-shell-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-180.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => null)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // API/data requests must stay fresh. Use network first, no permanent stale cache.
  if (url.pathname.startsWith('/api/') || url.pathname.includes('quote') || url.pathname.includes('scan')) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // HTML navigation: network first, cached shell fallback.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }

  // Built assets/icons: cache first, refresh in background.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
