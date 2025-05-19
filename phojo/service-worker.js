const CACHE_NAME = 'phojo-cache-v1';
const IDB_NAME = 'phojo-shared-files';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'sharedFiles';

// Get the base path - different in dev (/) vs production (/phojo/)
const BASE_PATH =
    self.location.pathname.includes('/phojo/') || self.location.pathname.endsWith('/phojo') ? '/phojo' : '';

// Share target action path - should match manifest.json
const SHARE_TARGET_ACTION = `${BASE_PATH}/share-target`;

// URLs to cache based on the determined base path
const urlsToCache = [
  "/phojo/",
  "/phojo/index.html",
  "/phojo/logo.svg",
  "/phojo/exif.js",
  "/phojo/icons/icon-192x192.png",
  "/phojo/icons/icon-512x512.png",
  "/phojo/icons/maskable-icon-192x192.png",
  "/phojo/icons/maskable-icon-512x512.png",
  "/phojo/assets/index-DG1aVRbm.css",
  "/phojo/assets/index-BBwJ27Ec.js"
];

// --- IndexedDB Helpers ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onerror = (event) => {
            console.error('[SW IDB openDB] IndexedDB error:', request.error);
            reject(`IndexedDB error: ${request.error?.message}`);
        };
        request.onsuccess = (event) => {
            // console.log('[SW IDB openDB] Database opened successfully.');
            resolve(request.result);
        };
        request.onupgradeneeded = (event) => {
            console.log('[SW IDB openDB] Upgrading database...');
            const db = request.result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                db.createObjectStore(IDB_STORE_NAME, {keyPath: 'key'});
                console.log('[SW IDB openDB] IndexedDB store created:', IDB_STORE_NAME);
            }
        };
    });
}

async function storeFiles(key, files) {
    // files here are original File objects from ShareTarget
    const db = await openDB();
    console.log(`[SW IDB storeFiles] Attempting to store ${files.length} files with key: ${key}`);

    const filesToStore = [];
    for (const file of files) {
        try {
            const buffer = await file.arrayBuffer();
            console.log(
                `[SW IDB storeFiles] Successfully read ArrayBuffer for ${file.name}. Original size: ${file.size}, Buffer size: ${buffer.byteLength}`,
            );
            if (buffer.byteLength === 0 && file.size > 0) {
                console.error(
                    `[SW IDB storeFiles] ALERT: Attempting to store 0-byte buffer for file ${file.name} which had original size ${file.size}`,
                );
            }
            filesToStore.push({
                name: file.name,
                type: file.type,
                lastModified: file.lastModified,
                buffer: buffer, // Store the buffer
                originalSize: file.size, // Keep original size for logging/debugging
            });
        } catch (error) {
            console.error(`[SW IDB storeFiles] Error reading ArrayBuffer for file ${file.name}:`, error);
            // Optionally, decide how to handle: skip this file, reject all, etc.
            // For now, we'll skip this problematic file
        }
    }

    if (filesToStore.length === 0 && files.length > 0) {
        console.error(
            `[SW IDB storeFiles] No files could be buffered for key ${key}. Original files count: ${files.length}`,
        );
        // It might be appropriate to reject here if no files are successfully buffered
        // For now, we proceed to store an empty array if all failed, or the successfully buffered ones
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.put({key: key, files: filesToStore, timestamp: Date.now()}); // files: filesToStore now holds objects with buffers

        request.onsuccess = () => {
            console.log(`[SW IDB storeFiles] store.put successful for key ${key}`);
            resolve();
        };
        request.onerror = (event) => {
            console.error(`[SW IDB storeFiles] Error storing files (store.put): ${request.error}`);
            reject(`Error storing files: ${request.error?.message}`);
        };
        transaction.oncomplete = () => {
            console.log(
                `[SW IDB storeFiles] Transaction complete. Stored ${filesToStore.length} buffered files for key ${key}`,
            );
            db.close();
        };
        transaction.onerror = (event) => {
            console.error(`[SW IDB storeFiles] Transaction error storing files: ${transaction.error}`);
            reject(`Transaction error storing files: ${transaction.error?.message}`);
        };
    });
}

async function getFiles(key) {
    // This will now retrieve an array of {name, type, buffer, originalSize}
    const db = await openDB();
    // console.log(`[SW IDB getFiles] Attempting to get files for key: ${key}`);
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => {
            if (request.result) {
                // console.log(`[SW IDB getFiles] Successfully retrieved data for key ${key}. Files array length: ${request.result.files ? request.result.files.length : 'undefined'}`);
                resolve(request.result.files); // This is an array of our custom file data objects
            } else {
                console.warn(`[SW IDB getFiles] No data found for key ${key}.`);
                resolve(null);
            }
        };
        request.onerror = (event) => {
            console.error(`[SW IDB getFiles] Error getting files for key ${key}: ${request.error}`);
            reject(`Error getting files: ${request.error?.message}`);
        };
        transaction.oncomplete = () => {
            // console.log(`[SW IDB getFiles] Transaction complete for key ${key}.`);
            db.close();
        };
        transaction.onerror = (event) => {
            console.error(`[SW IDB getFiles] Transaction error getting files for key ${key}: ${transaction.error}`);
            reject(`Transaction error getting files: ${transaction.error?.message}`);
        };
    });
}

async function deleteFiles(key) {
    const db = await openDB();
    // console.log(`[SW IDB deleteFiles] Attempting to delete files for key: ${key}`);
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.delete(key);
        request.onsuccess = () => {
            // console.log(`[SW IDB deleteFiles] store.delete successful for key ${key}`);
            resolve();
        };
        request.onerror = (event) => {
            console.error(`[SW IDB deleteFiles] Error deleting files (store.delete) for key ${key}: ${request.error}`);
            reject(`Error deleting files: ${request.error?.message}`);
        };
        transaction.oncomplete = () => {
            console.log(`[SW IDB deleteFiles] Transaction complete. Deleted files for key ${key}`);
            db.close();
        };
        transaction.onerror = (event) => {
            console.error(`[SW IDB deleteFiles] Transaction error deleting files for key ${key}: ${transaction.error}`);
            reject(`Transaction error deleting files: ${transaction.error?.message}`);
        };
    });
}

async function cleanupOldSharedFiles() {
    console.log('[Service Worker] Checking for old shared files to clean up');
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = async () => {
            const now = Date.now();
            const tenMinutesInMs = 10 * 60 * 1000;
            const oldItems = request.result.filter((item) => now - item.timestamp > tenMinutesInMs);

            if (oldItems.length > 0) {
                console.log(`[Service Worker] Found ${oldItems.length} shared file entries older than 10 minutes`);
                for (const item of oldItems) {
                    try {
                        await deleteFiles(item.key);
                        console.log(`[Service Worker] Cleaned up old shared files with key: ${item.key}`);
                    } catch (error) {
                        console.error(
                            `[Service Worker] Error cleaning up old shared files for key ${item.key}: ${error}`,
                        );
                    }
                }
            } else {
                console.log('[Service Worker] No old shared files to clean up');
            }
            resolve();
        };

        request.onerror = (event) => {
            console.error('[Service Worker] Error checking for old shared files (getAll):', request.error);
            reject(`Error checking for old shared files: ${request.error?.message}`);
        };

        transaction.oncomplete = () => db.close();
        transaction.onerror = (event) => {
            console.error(`[Service Worker] Transaction error during cleanup (getAll): ${transaction.error}`);
            // We don't reject the main promise here as getAll itself might have succeeded or failed.
        };
    });
}
// --- End IndexedDB Helpers ---

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install event');
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Opened cache:', CACHE_NAME);
                const validUrlsToCache = urlsToCache.filter((url) => typeof url === 'string');
                return cache.addAll(validUrlsToCache).catch((error) => {
                    console.error('[Service Worker] Failed to cache initial assets:', error);
                    throw error; // Propagate error to fail install if core assets don't cache
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
    console.log('[Service Worker] Activate event');
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName !== CACHE_NAME)
                        .map((cacheName) => {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }),
                );
            })
            .then(() => {
                console.log('[Service Worker] Old caches deleted. Claiming clients.');
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('[Service Worker] Activation failed:', error);
            }),
    );
});

// Fetch handler for Share Target POST
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname === SHARE_TARGET_ACTION) {
        console.log('[Service Worker] Share Target POST request received for:', url.pathname);
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const files = formData.getAll('shared_files'); // Name matches manifest.json
                    console.log(`[Service Worker ShareTarget] Received ${files.length} file(s) from share event.`);
                    files.forEach((f) =>
                        console.log(
                            `[Service Worker ShareTarget] Original shared file: ${f.name}, size: ${f.size}, type: ${f.type}`,
                        ),
                    );

                    if (!files || files.length === 0) {
                        console.warn('[Service Worker ShareTarget] No files found in share. Redirecting.');
                        return Response.redirect(`${BASE_PATH}/`, 303);
                    }

                    const shareKey = `share-${Date.now()}`;
                    await storeFiles(shareKey, files); // This now stores objects with ArrayBuffers
                    console.log(
                        `[Service Worker ShareTarget] Files processed and stored in IndexedDB with key: ${shareKey}`,
                    );
                    const storedData = await getFiles(shareKey); // For immediate verification after store
                    if (storedData) {
                        console.log(
                            `[Service Worker ShareTarget] Verification: Retrieved ${storedData.length} items from IDB for key ${shareKey}.`,
                        );
                        storedData.forEach((item) =>
                            console.log(
                                `[Service Worker ShareTarget] Verified item: ${item.name}, buffer size: ${
                                    item.buffer ? item.buffer.byteLength : 'N/A'
                                }, original size: ${item.originalSize}`,
                            ),
                        );
                    } else {
                        console.error(
                            `[Service Worker ShareTarget] Verification FAILED: Could not retrieve data for key ${shareKey} immediately after storing.`,
                        );
                    }

                    const clients = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
                    const appClient = clients.find((c) => c.url.startsWith(self.registration.scope));

                    if (appClient) {
                        console.log(
                            '[Service Worker ShareTarget] Found active client. Sending SHARED_FILES_READY message.',
                        );
                        appClient.postMessage({type: 'SHARED_FILES_READY', key: shareKey});
                        if ('focus' in appClient) await appClient.focus();
                    } else {
                        console.log(
                            '[Service Worker ShareTarget] No active client found by matchAll. Redirect will handle app launch.',
                        );
                    }

                    const redirectUrl = `${BASE_PATH}/#shareKey=${shareKey}`;
                    console.log(`[Service Worker ShareTarget] Redirecting to: ${redirectUrl}`);
                    return Response.redirect(redirectUrl, 303);
                } catch (error) {
                    console.error('[Service Worker ShareTarget] Error handling share target request:', error);
                    return Response.redirect(
                        `${BASE_PATH}/?share_error=true&message=${encodeURIComponent(error.message)}`,
                        303,
                    );
                }
            })(),
        );
        return; // Important: Stop further processing for this request
    }

    // Default Cache-First strategy for GET requests
    if (event.request.method === 'GET') {
        const requestUrl = new URL(event.request.url);
        // console.log(`[Service Worker GET] Request for: ${requestUrl.pathname}`);
        const isMainPage =
            requestUrl.pathname === `${BASE_PATH}/` ||
            requestUrl.pathname === `${BASE_PATH}/index.html` ||
            requestUrl.pathname === '/'; // Also check for root in dev

        if (isMainPage) {
            console.log(
                '[Service Worker GET] Main page requested, running cleanup of old shared files (non-blocking).',
            );
            cleanupOldSharedFiles().catch((error) =>
                console.error('[Service Worker GET] Error in background cleanup task:', error),
            );
        }

        event.respondWith(
            caches
                .match(event.request)
                .then((response) => {
                    if (response) {
                        // console.log(`[Service Worker GET] Cache hit for: ${event.request.url}`);
                        return response;
                    }
                    // console.log(`[Service Worker GET] Cache miss for: ${event.request.url}. Fetching from network.`);
                    const fetchRequest = event.request.clone();
                    return fetch(fetchRequest).then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            // console.warn(`[Service Worker GET] Network fetch for ${event.request.url} - not caching (status: ${response?.status}, type: ${response?.type})`);
                            return response;
                        }
                        // console.log(`[Service Worker GET] Network fetch success for: ${event.request.url}. Caching response.`);
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                        return response;
                    });
                })
                .catch((error) => {
                    console.error(`[Service Worker GET] Fetch failed for: ${event.request.url}`, error);
                    // Consider returning a generic offline page if appropriate
                    // For example: return caches.match(`${BASE_PATH}/offline.html`);
                    throw error;
                }),
        );
    }
});

// Message handler for client requests
self.addEventListener('message', (event) => {
    console.log('[Service Worker MessageEvent] Received message from client:', event.data);
    if (!event.data || !event.data.type) {
        console.warn('[Service Worker MessageEvent] Received message with no type.');
        return;
    }

    if (event.data.type === 'GET_STORED_FILES') {
        const key = event.data.key;
        const clientId = event.source?.id;

        if (!key || !clientId) {
            console.error('[Service Worker MessageEvent GET_STORED_FILES] Invalid message:', event.data);
            return;
        }

        console.log(
            `[Service Worker MessageEvent GET_STORED_FILES] Client ${clientId} requested files for key: ${key}`,
        );

        event.waitUntil(
            (async () => {
                const client = await self.clients.get(clientId);
                if (!client) {
                    console.error(`[Service Worker MessageEvent GET_STORED_FILES] Client ${clientId} not found.`);
                    return;
                }
                try {
                    const storedFileObjects = await getFiles(key); // This is an array of {name, type, buffer, originalSize}

                    if (storedFileObjects && storedFileObjects.length > 0) {
                        console.log(
                            `[SW GET_STORED_FILES] Found ${storedFileObjects.length} stored file objects in IDB for key ${key}. Reconstructing and sending to client ${clientId}.`,
                        );
                        const filesToSendToClient = [];
                        for (const sfData of storedFileObjects) {
                            try {
                                if (!(sfData.buffer instanceof ArrayBuffer)) {
                                    console.error(
                                        `[SW GET_STORED_FILES] Invalid buffer type for ${
                                            sfData.name
                                        }. Type: ${typeof sfData.buffer}, IsArrayBuffer: ${
                                            sfData.buffer instanceof ArrayBuffer
                                        }. Buffer:`,
                                        sfData.buffer,
                                    );
                                    throw new Error(`Invalid buffer type for ${sfData.name}`);
                                }
                                const clientFile = new File([sfData.buffer], sfData.name, {
                                    type: sfData.type,
                                    lastModified: sfData.lastModified,
                                });
                                console.log(
                                    `[SW GET_STORED_FILES] Reconstructed ${clientFile.name}, clientFile.size: ${clientFile.size} bytes from buffer size: ${sfData.buffer.byteLength}. Original reported size was: ${sfData.originalSize}`,
                                );
                                if (clientFile.size === 0 && sfData.originalSize > 0) {
                                    console.warn(
                                        `[SW GET_STORED_FILES] ALERT: Reconstructed 0-byte file for ${clientFile.name} from buffer that was originally ${sfData.originalSize} bytes (buffer size ${sfData.buffer.byteLength}).`,
                                    );
                                }
                                filesToSendToClient.push(clientFile);
                            } catch (fileError) {
                                console.error(
                                    `[SW GET_STORED_FILES] Error reconstructing file ${sfData.name}:`,
                                    fileError,
                                );
                                // Optionally send an error marker for this file or skip it.
                                // For now, we'll just log and the file won't be included.
                            }
                        }
                        console.log(
                            `[SW GET_STORED_FILES] Reconstructed files to send: ${filesToSendToClient
                                .map((f) => `${f.name} - ${f.size} bytes`)
                                .join(', ')}`,
                        );
                        client.postMessage({type: 'STORED_FILES_DATA', key: key, files: filesToSendToClient});
                        // Deletion is now handled by DELETE_STORED_FILES message from client
                    } else {
                        console.warn(
                            `[SW GET_STORED_FILES] No files/file data found in IDB for key ${key}. Sending empty array.`,
                        );
                        client.postMessage({type: 'STORED_FILES_DATA', key: key, files: []});
                        // Optionally delete the empty key entry if it somehow exists, but it should have been cleaned by cleanupOldSharedFiles
                        await deleteFiles(key).catch((e) => {
                            /* console.warn('[SW GET_STORED_FILES] Silently failed to delete (possibly non-existent) key:', key, e) */
                        });
                    }
                } catch (error) {
                    console.error(`[SW GET_STORED_FILES] Error processing GET_STORED_FILES for key ${key}:`, error);
                    client.postMessage({
                        type: 'STORED_FILES_ERROR',
                        key: key,
                        error: error.message || 'Unknown error getting stored files',
                    });
                    // Attempt cleanup even on error if key exists
                    await deleteFiles(key).catch((e) =>
                        console.warn('[SW GET_STORED_FILES] Error deleting files after error, key:', key, e),
                    );
                }
            })(),
        );
    } else if (event.data && event.data.type === 'DELETE_STORED_FILES') {
        const key = event.data.key;
        const clientId = event.source?.id;

        if (!key || !clientId) {
            console.error('[Service Worker MessageEvent DELETE_STORED_FILES] Invalid message:', event.data);
            return;
        }

        console.log(
            `[Service Worker MessageEvent DELETE_STORED_FILES] Client ${clientId} requested deletion of files for key: ${key}`,
        );

        event.waitUntil(
            (async () => {
                try {
                    await deleteFiles(key); // This is the IDB helper
                    console.log(
                        `[Service Worker MessageEvent DELETE_STORED_FILES] Successfully deleted files from IDB for key ${key}`,
                    );
                } catch (error) {
                    console.error(
                        `[Service Worker MessageEvent DELETE_STORED_FILES] Error deleting files from IDB for key ${key}:`,
                        error,
                    );
                }
            })(),
        );
    } else if (event.data && event.data.type === 'STORE_FILES') {
        const key = event.data.key;
        const files = event.data.files;
        const clientId = event.source?.id;

        if (!key || !files || !clientId) {
            console.error('[Service Worker MessageEvent STORE_FILES] Invalid message:', event.data);
            return;
        }

        console.log(
            `[Service Worker MessageEvent STORE_FILES] Client ${clientId} requested to store ${files.length} files with key: ${key}`,
        );

        event.waitUntil(
            (async () => {
                const client = await self.clients.get(clientId);
                if (!client) {
                    console.error(`[Service Worker MessageEvent STORE_FILES] Client ${clientId} not found.`);
                    return;
                }

                try {
                    await storeFiles(key, files);
                    console.log(
                        `[Service Worker MessageEvent STORE_FILES] Successfully stored ${files.length} files in IDB with key ${key}`,
                    );

                    // Send confirmation message back to client
                    client.postMessage({
                        type: 'SHARED_FILES_READY',
                        key: key,
                        count: files.length,
                    });
                } catch (error) {
                    console.error(
                        `[Service Worker MessageEvent STORE_FILES] Error storing files in IDB for key ${key}:`,
                        error,
                    );
                    client.postMessage({
                        type: 'STORED_FILES_ERROR',
                        key: key,
                        error: error.message || 'Unknown error storing files',
                    });
                }
            })(),
        );
    } else {
        console.log('[Service Worker MessageEvent] Received unhandled message type:', event.data?.type);
    }
});
