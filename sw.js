// Service worker Gamelle & Panier : fonctionne hors-ligne (magasin, sous-sol…)
const VERSION = 'v30';
const APP_CACHE = `gamelle-app-${VERSION}`;
const IMG_CACHE = 'gamelle-images-v1';
const IMG_MAX = 250;
const ASSETS = [
  './', './index.html', './styles.css', './tailwind.css', './app.js', './recipes.js',
  './manifest.json', './logo.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimImages() {
  const cache = await caches.open(IMG_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - IMG_MAX; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Photos de recettes : cache d'abord, puis réseau (mémorisées pour le hors-ligne)
  if (req.destination === 'image' && url.origin !== location.origin) {
    e.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()); trimImages(); }
          return res;
        } catch (err) {
          return Response.error();
        }
      })
    );
    return;
  }

  if (url.origin !== location.origin) return; // synchro ntfy, QR : réseau uniquement

  // Pages : réseau d'abord (toujours à jour), cache en secours hors-ligne
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Fichiers de l'app : cache d'abord, mise à jour discrète en arrière-plan
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) caches.open(APP_CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
