/*
 * Minimal service worker.
 *
 * Deliberately conservative: a dashboard that shows stale meetings is worse
 * than one that shows a spinner. So:
 *   - Static assets (icons, /_next/static): cache-first, they're hashed.
 *   - Everything else: NETWORK-ONLY, with an offline page as the fallback.
 *
 * No stale-while-revalidate on pages, no caching of API responses — email
 * subjects and calendar events should never be served from a stale cache, and
 * a cached authenticated response is a data-leak vector on a shared device.
 */

const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch auth or sync endpoints.
  if (url.pathname.startsWith('/api/')) return;

  const isStatic = url.pathname.startsWith('/_next/static/')
    || /\.(png|svg|ico|woff2?|css|js)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
        return res;
      })),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
