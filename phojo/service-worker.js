const CACHE_NAME = 'phojo-cache-v1';
// Make sure share-target isn't cached by the generic handler
const SHARE_TARGET_ACTION = '/phojo/share-target';
const urlsToCache = [
  "/phojo/",
  "/phojo/index.html",
  "/phojo/logo.svg",
  "/phojo/exif.js",
  "/phojo/icons/icon-192x192.png",
  "/phojo/icons/icon-512x512.png",
  "/phojo/icons/maskable-icon-192x192.png",
  "/phojo/icons/maskable-icon-512x512.png",
  "/phojo/assets/index-Cxp37pTo.css",
  "/phojo/assets/index-BzaO1yYS.js"
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Opened cache:', CACHE_NAME);
                const validUrlsToCache = urlsToCache.filter((url) => typeof url === 'string');
                return cache.addAll(validUrlsToCache).catch((error) => {
                    console.error('[Service Worker] Failed to cache initial assets:', error);
                    throw error;
                });
            })
            .then(() => {
                console.log('[Service Worker] Core assets cached successfully.');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            }),
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            return cacheName !== CACHE_NAME;
                        })
                        .map((cacheName) => {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }),
                );
            })
            .then(() => {
                console.log('[Service Worker] Claiming clients.');
                return self.clients.claim();
            }),
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Handle Share Target POST request
    if (event.request.method === 'POST' && url.pathname === SHARE_TARGET_ACTION) {
        console.log('[Service Worker] Share Target request received.');
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const files = formData.getAll('shared_files'); // Name matches manifest.json params
                    console.log(`[Service Worker] Received ${files.length} files from share.`);

                    if (files.length === 0) {
                        console.log('[Service Worker] No files found in share.');
                        // Redirect to the app root immediately if no files
                        return Response.redirect('/phojo/', 303);
                    }

                    // Get all clients
                    const allClients = await self.clients.matchAll({includeUncontrolled: true});
                    let client = allClients.find((c) => c.url.endsWith('/phojo/') && 'focus' in c); // Find a suitable client

                    if (client) {
                        console.log('[Service Worker] Found existing client, focusing and sending files...');
                        await client.focus(); // Focus the existing window
                        client.postMessage({type: 'SHARED_FILES', files: files});
                    } else {
                        console.log('[Service Worker] No suitable client found, opening new window...');
                        // If no client found, open a new window/tab.
                        // Opening the window first, then sending the message ensures the listener might be ready.
                        client = await self.clients.openWindow('/phojo/');
                        if (client) {
                            // Short delay to allow the new window to potentially set up its listener
                            await new Promise((resolve) => setTimeout(resolve, 500));
                            console.log('[Service Worker] Sending files to newly opened client...');
                            client.postMessage({type: 'SHARED_FILES', files: files});
                        } else {
                            console.error('[Service Worker] Failed to open a new window.');
                            // Fallback or error handling needed here
                        }
                    }

                    // Redirect the service worker fetch response to the main app page
                    // This happens after the message is sent.
                    return Response.redirect('/phojo/', 303);
                } catch (error) {
                    console.error('[Service Worker] Error handling share target request:', error);
                    // Redirect on error too, maybe with an error parameter?
                    return Response.redirect('/phojo/?share_error=true', 303);
                }
            })(),
        );
        return; // Stop processing this fetch event here
    }

    // Default Cache-First strategy for GET requests (excluding share target)
    if (event.request.method === 'GET' && url.pathname !== SHARE_TARGET_ACTION) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) {
                    return response;
                }

                const fetchRequest = event.request.clone();

                return fetch(fetchRequest)
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                        return response;
                    })
                    .catch((error) => {
                        console.error(`[Service Worker] Fetch failed for: ${event.request.url}`, error);
                        // Consider returning an offline page here if appropriate
                        throw error;
                    });
            }),
        );
    }
});
