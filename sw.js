const CACHE_NAME = 'planum-vita-v3';
const BASE_PATH = '/Planum-Vita/';

const APP_SHELL = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.webmanifest`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Sadece GET isteklerini ele al.
  if (request.method !== 'GET') return;

  // HTTP/HTTPS dışındaki istekleri ele alma.
  const requestURL = new URL(request.url);
  if (
    requestURL.protocol !== 'http:' &&
    requestURL.protocol !== 'https:'
  ) {
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Önce internetten güncel içeriği almaya çalış.
    const response = await fetch(request);

    // Başarısız HTTP cevaplarını cache'e yazma.
    // Opaque cevapların durum kodu okunamadığı için onlar da cache'lenebilir.
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // İnternet yoksa mevcut cache'i dene.
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // Sayfa açılışı başarısızsa uygulamanın ana shell'ini kullan.
    if (request.mode === 'navigate') {
      const shell = await cache.match(`${BASE_PATH}index.html`);

      if (shell) {
        return shell;
      }
    }

    // Hiçbir şey yoksa gerçek hatayı tarayıcıya bırak.
    throw error;
  }
}
