const CACHE_NAME = 'verba-v1';
const urlsToCache = [
  '/',
  '/offline',
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate service worker and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy: Network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other schemes
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseToCache = response.clone();

        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // If no cache, return offline page for navigations
            if (event.request.mode === 'navigate') {
              return caches.match('/offline');
            }
          });
      })
  );
});

// Background sync for offline vocabulary
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-vocab') {
    event.waitUntil(syncVocabulary());
  }
});

async function syncVocabulary() {
  // Get pending vocabulary from IndexedDB
  const db = await openDB();
  const pendingWords = await getPendingWords(db);

  // Try to sync each word
  for (const word of pendingWords) {
    try {
      await fetch('/api/sync-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(word)
      });
      
      // Remove from pending list on success
      await removePendingWord(db, word.id);
    } catch (error) {
      console.log('Sync failed, will retry later');
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PolyglotDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingWords')) {
        db.createObjectStore('pendingWords', { keyPath: 'id' });
      }
    };
  });
}

function getPendingWords(db) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['pendingWords'], 'readonly');
    const store = transaction.objectStore('pendingWords');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

function removePendingWord(db, id) {
  return new Promise((resolve) => {
    const transaction = db.transaction(['pendingWords'], 'readwrite');
    const store = transaction.objectStore('pendingWords');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}
