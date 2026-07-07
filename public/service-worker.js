// Service Worker for offline capability and caching
const CACHE_NAME = 'schoolxnow-v1';
const STATIC_CACHE = 'schoolxnow-static-v1';
const DYNAMIC_CACHE = 'schoolxnow-dynamic-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('Service Worker: Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - use network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for:
  // 1. API calls
  // 2. Chrome extensions
  // 3. Hot reload (development)
  if (
    url.pathname.startsWith('/api') ||
    url.protocol === 'chrome-extension:' ||
    request.url.includes('hot-update')
  ) {
    return;
  }

  // Strategy: Network-first for HTML, cache-first for assets
  const isHtmlRequest = request.headers.get('accept')?.includes('text/html');

  if (isHtmlRequest) {
    // Network-first for HTML (critical for SPA routing after deploys)
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache the response
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/index.html');
            });
        })
    );
  } else {
    // Cache-first for assets (CSS, JS, images)
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(request)
            .then((networkResponse) => {
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
                return networkResponse;
              }

              const responseToCache = networkResponse.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });

              return networkResponse;
            });
        })
        .catch(() => {
          // Return fallback for failed requests
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
  }
});

// Message event - for cache management from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
