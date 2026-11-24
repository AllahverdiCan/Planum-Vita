
const CACHE_PREFIX = 'planum-vita-';
const CACHE_NAME = `${CACHE_PREFIX}v6`;
const BASE_PATH = '/Planum-Vita/';
const MAX_CACHE_ENTRIES = 50;

const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.webmanifest`
];

const EXTERNAL_ASSETS = [
  'https://unpkg.com/@phosphor-icons/web',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
];

const CACHEABLE_EXTENSIONS =
  /\.(?:html|js|css|webmanifest|png|jpg|jpeg|svg|webp|ico|woff2?)$/i;

function isCacheableRequest(request) {
  const url = new URL(request.url);

  if (!['http:', 'https:'].includes(url.protocol)) {
    return false;
  }

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(BASE_PATH)) {
      return false;
    }

    if (request.mode === 'navigate') {
      return true;
    }

    return (
      url.pathname === BASE_PATH ||
      CACHEABLE_EXTENSIONS.test(url.pathname)
    );
  }

  return EXTERNAL_ASSETS.some(asset => {
    const allowed = new URL(asset);
    return (
      url.origin === allowed.origin &&
      url.href === allowed.href
    );
  });
}

async function fetchExternalAsset(url) {
  try {
    const response = await fetch(url, {
      mode: 'cors'
    });

    if (response.ok) {
      return response;
    }
  } catch (_) {}

  return null;
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  const protectedUrls = new Set([
    ...APP_SHELL.map(path =>
      new URL(path, self.location.origin).href
    ),
    ...EXTERNAL_ASSETS
  ]);

  const removable = keys.filter(
    request => !protectedUrls.has(request.url)
  );

  const protectedCount = keys.length - removable.length;
  const allowedRemovable = Math.max(
    0,
    maxItems - protectedCount
  );

  const excess = removable.length - allowedRemovable;

  for (let i = 0; i < excess; i++) {
    await cache.delete(removable[i]);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await cache.addAll(APP_SHELL);

    await Promise.allSettled(
      EXTERNAL_ASSETS.map(async url => {
        const response = await fetchExternalAsset(url);

        if (response) {
          await cache.put(url, response);
        }
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith(CACHE_PREFIX) &&
          key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;
  if (!isCacheableRequest(request)) return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);
  const isExternal = url.origin !== self.location.origin;

  try {
    const response = await fetch(request);

    if (
      request.mode === 'navigate' &&
      !response.ok
    ) {
      const shell = await cache.match(
        `${BASE_PATH}index.html`
      );

      if (shell) return shell;
    }

    const shouldCache =
      response.ok ||
      (isExternal && response.type === 'opaque');

    if (shouldCache) {
      await cache.put(request, response.clone());
      await trimCache(CACHE_NAME, MAX_CACHE_ENTRIES);
    }

    return response;
  } catch (_) {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    if (request.mode === 'navigate') {
      const shell = await cache.match(
        `${BASE_PATH}index.html`
      );

      if (shell) return shell;
    }

    return new Response(
      'Çevrimdışısınız. Bu içerik şu anda kullanılamıyor.',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }
    );
  }
}
