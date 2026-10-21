// Go SVT Maroc - Service Worker v2
const CACHE_NAME = 'gosvt-v2';
const CACHEABLE = /\.(html|css|js|webmanifest|png|svg|ico)$/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    // لا نتدخل أبداً في content.json ولا ملفات JSON
    if (url.pathname.endsWith('.json')) return;

    const cacheable = url.pathname === '/' || CACHEABLE.test(url.pathname);
    if (!cacheable) return;

    const cacheKey = url.origin + url.pathname;
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, copy));
                }
                return response;
            })
            .catch(() => caches.match(cacheKey).then(r => r || Response.error()))
    );
});
