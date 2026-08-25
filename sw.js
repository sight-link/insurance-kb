const CACHE_NAME = 'insurance-kb-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css',
  '/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => 
      response || fetch(e.request)
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});