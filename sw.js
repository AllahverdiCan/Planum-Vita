const CACHE_NAME = 'planum-vita-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Sadece GET isteklerini yakala (dışarıya veri gönderen POST isteklerini bozmamak için)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // İnternet var, site güncel açıldı. Bu güncel hali arka planda cihaza da kaydet.
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // İnternet yok (veya çöktü). Hemen cihazdaki kayıtlı kopyayı ekrana ver.
        return caches.match(event.request);
      })
  );
});