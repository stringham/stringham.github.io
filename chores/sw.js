// sw.js
const CACHE_NAME = 'chore-app-v1.1'; // Increment this version to trigger SW update & recache
const APP_SHELL_FILES = [
    './index.html',
    './style.css',
    './manifest.json',
    './config.js',
    './auth.js',
    './sheetsService.js',
    './ui.js',
    './main.js',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    './icons/icon-maskable-192x192.png',
    './icons/icon-maskable-512x512.png'
    // Add any other static assets like specific font files if you host them locally
];

// Install event: Cache the app shell
self.addEventListener('install', (event) => {
    console.log('Service Worker: Install event in progress.');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching app shell files.');
                // Use {cache: 'reload'} to bypass the browser's HTTP cache for these critical files during SW install.
                // This ensures we get the freshest versions from the server, not potentially stale ones from the HTTP cache.
                const cachePromises = APP_SHELL_FILES.map(urlToCache => {
                    return fetch(urlToCache, { cache: 'reload' })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Failed to fetch ${urlToCache} - ${response.status} ${response.statusText}`);
                            }
                            return cache.put(urlToCache, response);
                        })
                        .catch(error => {
                            console.error(`Service Worker: Failed to cache ${urlToCache}. Error:`, error);
                        });
                });
                return Promise.all(cachePromises);
            })
            .then(() => {
                console.log('Service Worker: App shell files cached successfully.');
            })
            .catch(error => {
                console.error('Service Worker: Caching app shell failed:', error);
            })
    );
});

// Activate event: Clean up old caches and take control
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activate event in progress.');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activated and old caches cleared.');
            return self.clients.claim(); // Ensure new SW takes control of open clients immediately
        })
    );
});

// Fetch event: Serve app shell files from cache (Cache-First strategy)
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Only handle GET requests for app shell files.
    // Let other requests (POST, Google API calls, etc.) pass through to the network.
    if (event.request.method === 'GET' && APP_SHELL_FILES.includes(requestUrl.pathname.substring(requestUrl.origin.length))) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // console.log('Service Worker: Serving from cache:', event.request.url);
                        return cachedResponse;
                    }
                    // console.log('Service Worker: Fetching from network (not in cache, though it should be after install):', event.request.url);
                    return fetch(event.request); // Fallback to network if not in cache (should ideally be there post-install)
                })
        );
    } else {
        // For all other requests (e.g., API calls to Google, non-app-shell GETs),
        // let them go directly to the network.
        // console.log('Service Worker: Letting browser handle fetch:', event.request.url);
        return; // Equivalent to event.respondWith(fetch(event.request)) but more explicit that we're not handling it here.
    }
});