const CACHE_NAME = 'gowar-pwa-v3';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API, Django Admin, health checks, or uploaded media
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/django-admin/') ||
    url.pathname.startsWith('/health/') ||
    url.pathname.startsWith('/media/') ||
    url.pathname.startsWith('/static/')
  ) {
    return;
  }

  // SPA navigation requests: network-first with offline index.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Hashed Vite assets & PWA icons: cache-first with network fallback
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/pwa-') ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      try {
        payload = { body: event.data.text() };
      } catch {
        payload = {};
      }
    }
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : 'Gowar';
  const body =
    typeof payload.body === 'string' && payload.body.trim()
      ? payload.body.trim()
      : 'You have a new update in Gowar.';
  const targetUrl =
    typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/';

  const options = {
    body,
    icon: typeof payload.icon === 'string' ? payload.icon : '/pwa-192x192.png',
    badge: typeof payload.badge === 'string' ? payload.badge : '/pwa-192x192.png',
    tag: typeof payload.tag === 'string' && payload.tag ? payload.tag : 'gowar-notification',
    renotify: true,
    data: { url: targetUrl },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            client.postMessage({ type: 'GOWAR_PUSH_RECEIVED', payload });
          }
        })
        .catch(() => undefined),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawPath = event.notification?.data?.url;
  const safePath = typeof rawPath === 'string' && rawPath.startsWith('/') ? rawPath : '/';
  const targetUrl = new URL(safePath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            if ('navigate' in client) {
              return client.navigate(targetUrl).then((navigated) => (navigated || client).focus());
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
