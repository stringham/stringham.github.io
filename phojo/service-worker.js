const CACHE_NAME = 'phojo-cache-v1';
const SHARE_TARGET_ACTION = '/phojo/share-target';
const IDB_NAME = 'phojo-shared-files';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'sharedFiles';

const urlsToCache = [
  "/phojo/",
  "/phojo/index.html",
  "/phojo/logo.svg",
  "/phojo/exif.js",
  "/phojo/icons/icon-192x192.png",
  "/phojo/icons/icon-512x512.png",
  "/phojo/icons/maskable-icon-192x192.png",
  "/phojo/icons/maskable-icon-512x512.png",
  "/phojo/assets/index-CTgM40ig.css",
  "/phojo/assets/index-B8qQjL6a.js"
];

// --- IndexedDB Helpers ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onerror = (event) => reject(`IndexedDB error: ${request.error}`);
        request.onsuccess = (event) => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = request.result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                db.createObjectStore(IDB_STORE_NAME, {keyPath: 'key'});
                console.log('[Service Worker] IndexedDB store created.');
            }
        };
    });
}

async function storeFiles(key, files) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);
        // Overwrite if key already exists
        const request = store.put({key: key, files: files, timestamp: Date.now()});
        request.onsuccess = resolve;
        request.onerror = (event) => reject(`Error storing files: ${request.error}`);
        transaction.oncomplete = () => {
            console.log(`[SW IDB] Stored files for key ${key}`);
            db.close();
        };
        transaction.onerror = (event) => reject(`Transaction error storing files: ${transaction.error}`);
    });
}

async function getFiles(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.files : null);
        request.onerror = (event) => reject(`Error getting files: ${request.error}`);
        transaction.oncomplete = () => db.close();
        transaction.onerror = (event) => reject(`Transaction error getting files: ${transaction.error}`);
    });
}

async function deleteFiles(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.delete(key);
        request.onsuccess = resolve;
        request.onerror = (event) => reject(`Error deleting files: ${request.error}`);
        transaction.oncomplete = () => {
            console.log(`[SW IDB] Deleted files for key ${key}`);
            db.close();
        };
        transaction.onerror = (event) => reject(`Transaction error deleting files: ${transaction.error}`);
    });
}
// --- End IndexedDB Helpers ---

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Opened cache:', CACHE_NAME);
                const validUrlsToCache = urlsToCache.filter((url) => typeof url === 'string');
                return cache.addAll(validUrlsToCache).catch((error) => {
                    console.error('[Service Worker] Failed cache initial assets:', error);
                    throw error;
                });
            })
            .then(() => {
                console.log('[Service Worker] Core assets cached.');
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
                        .filter((cacheName) => cacheName !== CACHE_NAME)
                        .map((cacheName) => caches.delete(cacheName)),
                );
            })
            .then(() => {
                console.log('[Service Worker] Claiming clients.');
                return self.clients.claim();
            }),
    );
});

// Fetch handler for Share Target POST
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname === SHARE_TARGET_ACTION) {
        console.log('[Service Worker] Share Target POST request received.');
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const files = formData.getAll('shared_files'); // Name matches manifest.json
                    console.log(`[Service Worker] Received ${files.length} file(s) from share.`);

                    if (!files || files.length === 0) {
                        console.log('[Service Worker] No files found in share.');
                        return Response.redirect('/phojo/', 303);
                    }

                    // Always store files with a unique key
                    const shareKey = `share-${Date.now()}`;
                    await storeFiles(shareKey, files);
                    console.log(`[Service Worker] Files stored in IndexedDB with key: ${shareKey}`);

                    // Try to find an active client *after* storing files
                    const clients = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
                    const appClient = clients.find((c) => c.url.startsWith(self.registration.scope)); // Find any client in scope

                    if (appClient) {
                        console.log('[Service Worker] Found active client. Sending SHARED_FILES_READY message.');
                        // If client exists, inform it that files are ready with the key
                        appClient.postMessage({type: 'SHARED_FILES_READY', key: shareKey});
                        if ('focus' in appClient) await appClient.focus(); // Attempt to focus
                    } else {
                        console.log('[Service Worker] No active client found by matchAll.');
                        // No need to show notification here. The redirect will launch the app.
                    }

                    // Always redirect to the main app URL with the key in the fragment.
                    // The app will check the fragment on load.
                    const redirectUrl = `/phojo/#shareKey=${shareKey}`;
                    console.log(`[Service Worker] Redirecting to: ${redirectUrl}`);
                    return Response.redirect(redirectUrl, 303);
                } catch (error) {
                    console.error('[Service Worker] Error handling share target request:', error);
                    // Redirect on error, maybe indicate error in URL?
                    return Response.redirect('/phojo/?share_error=true', 303);
                }
            })(),
        );
        return; // Important: Stop further processing for this request
    }

    // Default Cache-First strategy for GET requests
    if (event.request.method === 'GET') {
        event.respondWith(
            caches
                .match(event.request)
                .then((response) => {
                    if (response) return response;
                    const fetchRequest = event.request.clone();
                    return fetch(fetchRequest).then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') return response;
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                        return response;
                    });
                })
                .catch((error) => {
                    console.error(`[Service Worker] GET Fetch failed for: ${event.request.url}`, error);
                    throw error; // Or return offline page
                }),
        );
    }
});

// --- REMOVED notificationclick handler ---

// Message handler for client requests (GET_STORED_FILES)
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received from client:', event.data);
    if (event.data && event.data.type === 'GET_STORED_FILES') {
        const key = event.data.key;
        const clientId = event.source?.id;

        if (!key || !clientId) {
            console.error('[Service Worker] Invalid GET_STORED_FILES message:', event.data);
            return;
        }

        console.log(`[Service Worker] Client ${clientId} requested files for key: ${key}`);

        event.waitUntil(
            (async () => {
                const client = await self.clients.get(clientId);
                if (!client) {
                    console.error(`[Service Worker] Client ${clientId} not found.`);
                    return;
                }
                try {
                    const files = await getFiles(key);
                    if (files) {
                        console.log(
                            `[Service Worker] Found ${files.length} files in IDB for key ${key}. Sending to client ${clientId}.`,
                        );
                        client.postMessage({type: 'STORED_FILES_DATA', key: key, files: files});
                        await deleteFiles(key); // Delete after sending
                        console.log(`[Service Worker] Deleted files from IDB for key ${key}.`);
                    } else {
                        console.warn(`[Service Worker] No files found in IDB for key ${key}. Sending empty array.`);
                        client.postMessage({type: 'STORED_FILES_DATA', key: key, files: []});
                        // Optionally delete the empty key entry if it somehow exists
                        await deleteFiles(key).catch(() => {});
                    }
                } catch (error) {
                    console.error(`[Service Worker] Error processing GET_STORED_FILES for key ${key}:`, error);
                    client.postMessage({type: 'STORED_FILES_ERROR', key: key, error: error.message || 'Unknown error'});
                    // Attempt cleanup even on error
                    await deleteFiles(key).catch((e) => console.error('Error deleting files after error:', e));
                }
            })(),
        );
    } else {
        console.log('[Service Worker] Received unhandled message type:', event.data?.type);
    }
});
