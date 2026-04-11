const CACHE_NAME = 'focusstep-v1';
const APP_BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const STATIC_ASSETS = [
  `${APP_BASE || ''}/`,
  `${APP_BASE || ''}/index.html`,
  `${APP_BASE || ''}/manifest.json`,
];

const API_PATH_PREFIXES = [
  '/translate',
  '/refine',
  '/help-step',
  '/usage',
  '/pro-status',
  '/create-checkout',
  '/billing-portal',
  '/webhook',
  '/referral',
  '/user',
  '/cache-stats',
  '/admin/',
  '/api/',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fall back to cache
self.addEventListener('fetch', event => {
  // Skip non-GET, non-http(s), and API requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  const requestUrl = new URL(event.request.url);
  if (event.request.url.includes('onrender.com')) return;
  if (API_PATH_PREFIXES.some(prefix => requestUrl.pathname.startsWith(prefix))) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
