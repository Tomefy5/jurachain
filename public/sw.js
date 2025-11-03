/**
 * Service Worker for JusticeAutomation PWA
 * Handles offline functionality, caching, and background sync
 */

const CACHE_NAME = 'justice-automation-v1';
const STATIC_CACHE = 'justice-automation-static-v1';
const DYNAMIC_CACHE = 'justice-automation-dynamic-v1';

// Files to cache for offline use
const STATIC_FILES = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/translation.html',
    '/manifest.json',
    // Add CSS and JS files here when available
];

// API endpoints that should be cached
const CACHEABLE_APIS = [
    '/api/offline/capabilities',
    '/api/offline/documents',
    '/api/offline/preferences',
    '/api/offline/storage/stats'
];

// Install event - cache static files
self.addEventListener('install', event => {
    console.log('Service Worker installing...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Static files cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Error caching static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE &&
                            cacheName !== DYNAMIC_CACHE &&
                            cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle network requests
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Handle static file requests
    if (request.method === 'GET') {
        event.respondWith(handleStaticRequest(request));
        return;
    }
});

/**
 * Handle API requests with offline fallback
 */
async function handleApiRequest(request) {
    const url = new URL(request.url);

    try {
        // Try network first
        const networkResponse = await fetch(request);

        // Cache successful GET requests for offline use
        if (request.method === 'GET' && networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('Network request failed, trying cache:', url.pathname);

        // Network failed, try cache for GET requests
        if (request.method === 'GET') {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
        }

        // Handle offline document generation
        if (url.pathname === '/api/documents/generate' && request.method === 'POST') {
            return handleOfflineDocumentGeneration(request);
        }

        // Handle offline document operations
        if (url.pathname.startsWith('/api/offline/')) {
            return handleOfflineOperation(request);
        }

        // Return offline page for other requests
        return createOfflineResponse(request);
    }
}

/**
 * Handle static file requests
 */
async function handleStaticRequest(request) {
    try {
        // Try cache first for static files
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Try network
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('Static request failed:', request.url);

        // Return cached version or offline page
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline page for HTML requests
        if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
        }

        return new Response('Offline', { status: 503 });
    }
}

/**
 * Handle offline document generation
 */
async function handleOfflineDocumentGeneration(request) {
    try {
        const requestData = await request.json();

        // Store request for later sync
        await storeOfflineAction({
            type: 'generate_document',
            data: requestData,
            timestamp: Date.now(),
            url: request.url,
            method: request.method
        });

        // Return offline response
        return new Response(JSON.stringify({
            success: false,
            offline: true,
            message: 'Demande enregistrée pour traitement hors ligne',
            queuedAt: new Date().toISOString()
        }), {
            status: 202,
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('Error handling offline document generation:', error);
        return createErrorResponse('Erreur lors du traitement hors ligne');
    }
}

/**
 * Handle offline operations
 */
async function handleOfflineOperation(request) {
    const url = new URL(request.url);

    try {
        // These operations should work offline
        if (url.pathname === '/api/offline/capabilities' ||
            url.pathname === '/api/offline/documents' ||
            url.pathname === '/api/offline/preferences') {

            // Try to use IndexedDB or localStorage directly
            return handleLocalStorageOperation(request);
        }

        // Queue other operations for sync
        const requestData = request.method === 'POST' || request.method === 'PUT'
            ? await request.json()
            : null;

        await storeOfflineAction({
            type: 'api_request',
            data: requestData,
            timestamp: Date.now(),
            url: request.url,
            method: request.method
        });

        return new Response(JSON.stringify({
            success: false,
            offline: true,
            message: 'Opération mise en file d\'attente pour synchronisation',
            queuedAt: new Date().toISOString()
        }), {
            status: 202,
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('Error handling offline operation:', error);
        return createErrorResponse('Erreur lors de l\'opération hors ligne');
    }
}

/**
 * Handle local storage operations
 */
async function handleLocalStorageOperation(request) {
    // This would integrate with the IndexedDB operations
    // For now, return a basic offline response
    return new Response(JSON.stringify({
        success: true,
        offline: true,
        data: [],
        message: 'Données locales (fonctionnalité à implémenter)'
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Store offline action for later sync
 */
async function storeOfflineAction(action) {
    try {
        // Open IndexedDB
        const db = await openOfflineDB();
        const transaction = db.transaction(['offlineActions'], 'readwrite');
        const store = transaction.objectStore('offlineActions');

        const actionWithId = {
            id: generateId(),
            ...action,
            synced: false
        };

        await store.add(actionWithId);
        console.log('Offline action stored:', actionWithId.id);

    } catch (error) {
        console.error('Error storing offline action:', error);
        // Fallback to localStorage
        const actions = JSON.parse(localStorage.getItem('offlineActions') || '[]');
        actions.push({
            id: generateId(),
            ...action,
            synced: false
        });
        localStorage.setItem('offlineActions', JSON.stringify(actions));
    }
}

/**
 * Open offline IndexedDB
 */
function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('JusticeAutomationDB', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('offlineActions')) {
                const store = db.createObjectStore('offlineActions', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('synced', 'synced', { unique: false });
            }
        };
    });
}

/**
 * Create offline response
 */
function createOfflineResponse(request) {
    const isApiRequest = new URL(request.url).pathname.startsWith('/api/');

    if (isApiRequest) {
        return new Response(JSON.stringify({
            success: false,
            offline: true,
            error: 'Service indisponible hors ligne',
            message: 'Cette fonctionnalité nécessite une connexion internet'
        }), {
            status: 503,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // Return cached HTML page or basic offline page
    return caches.match('/index.html').then(response => {
        return response || new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>JusticeAutomation - Hors ligne</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body>
                <h1>Mode hors ligne</h1>
                <p>Vous êtes actuellement hors ligne. Certaines fonctionnalités sont limitées.</p>
                <p>La synchronisation reprendra automatiquement lorsque la connexion sera rétablie.</p>
            </body>
            </html>
        `, {
            status: 200,
            headers: {
                'Content-Type': 'text/html'
            }
        });
    });
}

/**
 * Create error response
 */
function createErrorResponse(message) {
    return new Response(JSON.stringify({
        success: false,
        error: message
    }), {
        status: 500,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Background sync event
self.addEventListener('sync', event => {
    console.log('Background sync triggered:', event.tag);

    if (event.tag === 'sync-offline-actions') {
        event.waitUntil(syncOfflineActions());
    }
});

/**
 * Sync offline actions when connection is restored
 */
async function syncOfflineActions() {
    try {
        console.log('Syncing offline actions...');

        // Get unsynced actions from IndexedDB
        const db = await openOfflineDB();
        const transaction = db.transaction(['offlineActions'], 'readonly');
        const store = transaction.objectStore('offlineActions');
        const index = store.index('synced');
        const unsyncedActions = await index.getAll(false);

        console.log(`Found ${unsyncedActions.length} unsynced actions`);

        for (const action of unsyncedActions) {
            try {
                // Attempt to replay the action
                const response = await fetch(action.url, {
                    method: action.method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: action.data ? JSON.stringify(action.data) : undefined
                });

                if (response.ok) {
                    // Mark as synced
                    const updateTransaction = db.transaction(['offlineActions'], 'readwrite');
                    const updateStore = updateTransaction.objectStore('offlineActions');
                    action.synced = true;
                    action.syncedAt = Date.now();
                    await updateStore.put(action);

                    console.log('Action synced successfully:', action.id);
                } else {
                    console.error('Failed to sync action:', action.id, response.status);
                }

            } catch (error) {
                console.error('Error syncing action:', action.id, error);
            }
        }

        console.log('Offline actions sync completed');

    } catch (error) {
        console.error('Error during offline actions sync:', error);
    }
}

// Message event for communication with main thread
self.addEventListener('message', event => {
    const { type, data } = event.data;

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'GET_CACHE_STATUS':
            getCacheStatus().then(status => {
                event.ports[0].postMessage({ type: 'CACHE_STATUS', data: status });
            });
            break;

        case 'CLEAR_CACHE':
            clearAllCaches().then(result => {
                event.ports[0].postMessage({ type: 'CACHE_CLEARED', data: result });
            });
            break;

        default:
            console.log('Unknown message type:', type);
    }
});

/**
 * Get cache status
 */
async function getCacheStatus() {
    try {
        const cacheNames = await caches.keys();
        const status = {};

        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            status[cacheName] = keys.length;
        }

        return status;
    } catch (error) {
        console.error('Error getting cache status:', error);
        return { error: error.message };
    }
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        return { success: true, cleared: cacheNames.length };
    } catch (error) {
        console.error('Error clearing caches:', error);
        return { success: false, error: error.message };
    }
}

console.log('Service Worker loaded successfully');