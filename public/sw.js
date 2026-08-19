// Service worker mínimo: mantém o app instalável e responde offline ao shell básico.
const CACHE = 'dental-ia-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/'])).catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (request.mode === 'navigate') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
