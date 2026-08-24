/* sw.js — 離線快取 Service Worker */
const CACHE = 'eb-v1';
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/style.css',
  './js/services.js', './js/ocr.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  // Tesseract.js CDN（讓第二次以後可離線 OCR）
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // CDN 語言包等 → cache-first，失敗退回網路
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() =>
        e.request.mode === 'navigate'
          ? caches.match('./index.html')
          : Response.error()
      )
    )
  );
});
