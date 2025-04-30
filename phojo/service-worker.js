const CACHE_NAME = 'phojo-cache-v1';
const urlsToCache = [
  "/phojo/",
  "/phojo/index.html",
  "/phojo/logo.svg",
  "/phojo/exif.js",
  "/phojo/icons/icon-192x192.png",
  "/phojo/icons/icon-512x512.png",
  "/phojo/icons/maskable-icon-192x192.png",
  "/phojo/icons/maskable-icon-512x512.png",
  "/phojo/assets/index-Fgct6Tav.css",
  "/phojo/assets/index-DaCY1J3e.js"
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Opened cache:', CACHE_NAME);
        // Filter out any potentially undefined URLs before caching
        const validUrlsToCache = urlsToCache.filter(url => typeof url === 'string');
        return cache.addAll(validUrlsToCache).catch(error => {
            console.error('[Service Worker] Failed to cache initial assets:', error);
            // Don't skipWaiting if essential assets fail to cache
            throw error;
        });
      })
      .then(() => {
        console.log('[Service Worker] Core assets cached successfully.');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          // Delete caches that are not the current one
          return cacheName !== CACHE_NAME;
        }).map((cacheName) => {
          console.log('[Service Worker] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
        console.log('[Service Worker] Claiming clients.');
        // Take control of all open pages without requiring a reload
        return self.clients.claim();
    })
  );
});

// Fetch event: Serve cached assets first, fall back to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
      return;
  }

  // Use a cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                 cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(error => {
           console.error(`[Service Worker] Fetch failed for: ${event.request.url}`, error);
           throw error;
        });
      })
    );
});
