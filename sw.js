// Go SVT Maroc - PWA Service Worker v4
// Keep offline study files in their own cache across application updates.
const SHELL_CACHE = 'gosvt-shell-v4';
const RUNTIME_CACHE = 'gosvt-runtime-v4';
const OFFLINE_CACHE = 'gosvt-offline';
const KEEP_CACHES = [SHELL_CACHE, RUNTIME_CACHE, OFFLINE_CACHE];

const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/styles.css',
  '/enhancements.css',
  '/visual-refresh.css',
  '/real-svg-icons.css',
  '/file-cards.css',
  '/student-space-layout.css',
  '/3d-lab.css',
  '/script.js',
  '/features.js',
  '/study.js',
  '/learn.js',
  '/pathways.js',
  '/student-space-3d.js',
  '/student-space.js',
  '/student-space-integration.js',
  '/supabase-config.js',
  '/student-account.js',
  '/teacher-classroom.js',
  '/real-svg-icons.js',
  '/student-space-academic.js',
  '/student-space-continue.js',
  '/student-space-analytics.js',
  '/founder-profile.js',
  '/private-student-lessons.js',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico'
];

const isSameOrigin = url => url.origin === self.location.origin;
const cacheKeyFor = request => {
  const url = new URL(request.url);
  return new Request(url.origin + url.pathname);
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('gosvt-') && !KEEP_CACHES.includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  // PDFs are available offline only after the learner explicitly saves them.
  if (/\\.pdf$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const saved = await caches.open(OFFLINE_CACHE);
      const cached = await saved.match(request, { ignoreSearch: true, ignoreVary: true });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (_) {
        return new Response('هذا الملف غير محفوظ للقراءة دون اتصال. اتصل بالإنترنت واحفظه أولاً من «مراجعتي».', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  const isNavigation = request.mode === 'navigate';
  const isAppAsset = url.pathname === '/' ||
    url.pathname === '/index.html' ||
    /\\.(html|css|js|json|webmanifest|png|svg|ico)$/i.test(url.pathname);

  if (!isNavigation && !isAppAsset) return;

  event.respondWith((async () => {
    const key = cacheKeyFor(request);
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(key, response.clone());
      }
      return response;
    } catch (_) {
      const cached = await caches.match(key);
      if (cached) return cached;

      if (isNavigation) {
        const home = await caches.match('/');
        if (home) return home;
        const offline = await caches.match('/offline.html');
        if (offline) return offline;
      }

      return new Response('المحتوى غير متاح دون اتصال. افتح الدروس التي حفظتها مسبقاً أو أعد الاتصال بالإنترنت.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
