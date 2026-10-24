// Go SVT Maroc - Service Worker v3
const CACHE_NAME = 'gosvt-v3';
const OFFLINE_CACHE = 'gosvt-offline';   // ملفات PDF التي يحفظها التلميذ
const KEEP = [CACHE_NAME, OFFLINE_CACHE];
const CACHEABLE = /\.(html|css|js|json|webmanifest|png|svg|ico)$/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    // ملفات PDF: النسخة المحفوظة أولاً، وإلا من الإنترنت
    if (/\.pdf$/i.test(url.pathname)) {
        event.respondWith(
            caches.open(OFFLINE_CACHE)
                .then(cache => cache.match(request, { ignoreSearch: true, ignoreVary: true }))
                .then(saved => saved || fetch(request))
        );
        return;
    }

    // ملفات الموقع: الإنترنت أولاً، والنسخة المحفوظة فقط عند انقطاع الاتصال
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
