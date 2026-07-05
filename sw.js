const CACHE_NAME = 'bkd-dosen-shell-v7';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Google API / auth calls — those must always hit network.
  if (url.origin.includes('google') || url.origin.includes('gstatic')) {
    return;
  }

  // Network-first: always try to get the latest version first.
  // { cache: 'reload' } juga memaksa browser mengabaikan HTTP cache biasa,
  // supaya tidak ada 2 lapis cache (HTTP cache + Service Worker cache) yang bikin nyangkut.
  // Falls back to cache only when offline (no internet).
  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
