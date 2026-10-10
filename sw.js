// Incrémenter VERSION à chaque livraison modifiant une ressource de l’application.
const VERSION = '2.0.0-step2.4';
const CACHE_PREFIX = `ipcalc:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const ASSETS = [
  './', './index.html', './styles.css', './print.css', './manifest.webmanifest',
  './js/ipv6.js', './js/pdf-a4.js', './js/pdf-a3-flsm.js', './js/ipv4.js', './js/exports.js', './js/app.js', './js/pwa.js', './js/report-profiles.js',
  './icons/Logo_CyberNet_blanc_transparent.svg', './icons/Logo_CyberNet_bleu_marine_transparent.svg',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
];
const assetURLs = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const cleanURL = new URL(url);
  cleanURL.search = '';
  if (!assetURLs.has(cleanURL.href)) return;
  // Le cache représente une version cohérente. Une nouvelle version est
  // entièrement préparée à l’installation et activée après choix de l’utilisateur.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(cleanURL.href);
    return response ?? fetch(request);
  })());
});
