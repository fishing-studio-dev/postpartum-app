/* R6 service worker. Caches every file of this app (relative paths only, so it works
   under a sub-path such as /repo-name/). Handles only same-origin GET requests inside
   its own scope. Never contacts any other origin. Does not store user data. */
'use strict';
const VERSION = 'r6-2026-11-09-1';
const PREFIX = 'postpartum-r6-';
// R6 replaces R5 at the same address, so the R5 file caches are no longer needed.
const LEGACY_PREFIX = 'postpartum-r5-';
const CACHE = PREFIX + VERSION;
const FILES = [
  './',
  './index.html',
  './offline.js',
  './ui.js',
  './app.js',
  './style.css',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png'
];
const SCOPE = new URL('./', self.location.href).href;
const INDEX = new URL('./index.html', self.location.href).href;

// Navigation responses must not be marked as redirected (Safari refuses them).
function clean(response) {
  if (!response || !response.redirected) return response;
  return response.blob().then(body => new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers}));
}

self.addEventListener('install', event => {
  // New versions wait until every open window of the old version is closed,
  // so a page never mixes files from two versions.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new Request(path, {cache: 'reload'})))));
});

self.addEventListener('activate', event => {
  // Remove older R6 caches and the legacy R5 caches; other apps on the same origin are left alone.
  const old = key => (key.startsWith(PREFIX) && key !== CACHE) || key.startsWith(LEGACY_PREFIX);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(old).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  const navigate = request.mode === 'navigate';
  // Cache first. A page navigation not in the list (e.g. ./?source=x or an unknown path)
  // falls back to the cached index.html. Only a cache miss goes to the same origin.
  event.respondWith(caches.open(CACHE)
    .then(cache => cache.match(request, {ignoreSearch: true}).then(hit => hit || (navigate ? cache.match(INDEX) : undefined)))
    .then(hit => hit ? (navigate ? clean(hit) : hit) : fetch(request)));
});
