const CACHE_NAME = 'monitoring-v1';
const FIREBASE_SDK_URLS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js',
];
const FONT_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];
// File inti aplikasi — di-cache saat install supaya halaman tetap bisa
// dibuka walau offline (App Shell).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Cache Firebase SDK, font, & app shell saat install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled([
        ...FIREBASE_SDK_URLS.map(url => cache.add(url)),
        ...APP_SHELL.map(url => cache.add(url)),
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'PRELOAD') {
    caches.open(CACHE_NAME).then(cache => {
      Promise.allSettled(FIREBASE_SDK_URLS.map(url => cache.add(url)));
    });
  }
});

// Strategi: Cache-first untuk Firebase SDK, font, & app shell.
// Network-first (dengan fallback cache) untuk halaman utama.
// Untuk request lain (Firebase Realtime DB/Storage API): network-first, diam kalau offline.
self.addEventListener('fetch', event => {
  const url = event.request.url;

  const isCacheable = FIREBASE_SDK_URLS.includes(url) ||
    FONT_PATTERNS.some(p => url.includes(p));

  if (isCacheable) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  if (url.includes('firebasedatabase.app') || url.includes('firebasestorage')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('{}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Halaman HTML utama (navigasi) → network-first, fallback ke cache kalau offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
    );
  }
});
