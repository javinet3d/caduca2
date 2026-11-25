const CACHE_NAME = 'caduca2-pwa-v1';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(LOCAL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar llamadas dinámicas a Firebase Auth/Firestore ni API de Gemini
  if (
    url.hostname.includes('googleapis.com') && !url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebaseapp.com')
  ) {
    return;
  }

  // Navegación HTML: Network-first con respaldo inmediato en caché offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Recursos estáticos (app, iconos, fuentes, SDKs): Cache-first con actualización en segundo plano
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (url.origin === self.location.origin || url.hostname.includes('gstatic.com') || url.hostname.includes('fonts.'))) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
