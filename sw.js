const CACHE_NAME = 'brta-bus-fare-v9';

const PRECACHE_URLS = [
    '/',
    './index.html',
    './style.css',
    './script.js',
    './local_bus_data.js',
    './local_stop_en.js',
    './routes_data.json',
    './local_routes_data.json',
    './local_fare_matrix.json',
    './local_routes_distance.json',
    './BRTA_Logo.png',
    './brta_bus_hero.png',
    './manifest.json',
    './favicon_io/favicon.ico',
    './favicon_io/favicon-32x32.png',
    './favicon_io/favicon-16x16.png',
    './favicon_io/apple-touch-icon.png',
    './favicon_io/android-chrome-192x192.png',
    './favicon_io/android-chrome-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const fetchPromise = fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                }).catch(() => cached || caches.match('./index.html'));

                return cached || fetchPromise;
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            const fetchPromise = fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});
