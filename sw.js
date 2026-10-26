/* Jeff's — service worker
   Keeps the app shell available offline. Bump CACHE_NAME whenever any of the
   precached files change so installed clients pick up the new versions. */

const CACHE_NAME = 'jeff-shell-v1';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith('jeff-shell-') || key.startsWith('aurora-shell-')) &&
                key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Navigations: try the network first so updates arrive, then fall back to
     the cached shell when offline. */
  if (request.mode === 'navigate') {
    const scope = new URL(self.registration.scope);
    const indexPath = new URL('./index.html', scope).pathname;
    const requestUrl = new URL(request.url);

    event.respondWith(
      fetch(request)
        .then((response) => {
          /* Only cache the shell itself, not arbitrary pages. */
          if (
            response &&
            response.ok &&
            (requestUrl.pathname === scope.pathname || requestUrl.pathname === indexPath)
          ) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match('./index.html')) || (await caches.match('./'));
          if (!cached) return Response.error();

          /* Relative assets resolve against the page URL, so serve the cached
             shell only at its real location and redirect other routes to it. */
          if (requestUrl.pathname === scope.pathname || requestUrl.pathname === indexPath) {
            return cached;
          }
          return Response.redirect(scope.href, 302);
        })
    );
    return;
  }

  /* Other same-origin assets: stale-while-revalidate. */
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
