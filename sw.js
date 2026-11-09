/* R8 service worker. アプリのファイル（相対パス）と、firebase-config.js で固定した
   Firebase SDK の3ファイルだけをキャッシュする。Firestore / Auth / googleapis への通信と
   GET 以外のリクエストには一切さわらない。利用者のデータは保存しない。
   通知は「アプリを開いている間」にページから出すものだけ（Push は使わない）。 */
'use strict';
importScripts('./firebase-config.js');
const VERSION = 'r8-2026-11-09-1';
const PREFIX = 'postpartum-r8-';
const LEGACY_PREFIXES = ['postpartum-r7-', 'postpartum-r6-', 'postpartum-r5-'];
const CACHE = PREFIX + VERSION;
const SDK_URLS = self.SANGO_FIREBASE.sdkUrls.slice();
const FILES = [
  './',
  './index.html',
  './firebase-config.js',
  './app.js',
  './data.js',
  './logic.js',
  './seed-data.js',
  './seed-v2.js',
  './photo.js',
  './ui.js',
  './offline.js',
  './calendar.js',
  './words.js',
  './history.js',
  './notify.js',
  './style.css',
  './mascot.svg',
  './chara-fuwari.svg',
  './chara-katappo.svg',
  './chara-tebukko.svg',
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
// SDK は取れなくてもインストールは成功させる（アプリの画面だけは開けるように）。
function cacheSdk(cache) {
  return Promise.all(SDK_URLS.map(url => fetch(new Request(url, {mode: 'cors', credentials: 'omit'}))
    .then(res => (res && res.ok ? cache.put(url, res) : undefined))
    .catch(() => undefined)));
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(FILES.map(path => new Request(path, {cache: 'reload'}))).then(() => cacheSdk(cache))));
});

self.addEventListener('activate', event => {
  const old = key => (key.startsWith(PREFIX) && key !== CACHE) || LEGACY_PREFIXES.some(p => key.startsWith(p));
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
  if (SDK_URLS.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.href).then(hit => hit || fetch(request).then(res => {
      if (res && res.ok) cache.put(url.href, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  const navigate = request.mode === 'navigate';
  event.respondWith(caches.open(CACHE)
    .then(cache => cache.match(request, {ignoreSearch: true}).then(hit => hit || (navigate ? cache.match(INDEX) : undefined)))
    .then(hit => hit ? (navigate ? clean(hit) : hit) : fetch(request)));
});

// 通知を押したら、開いているアプリの画面に戻る。
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const mine = list.find(c => c.url.startsWith(SCOPE));
    if (mine && typeof mine.focus === 'function') return mine.focus();
    return self.clients.openWindow ? self.clients.openWindow(SCOPE) : undefined;
  }));
});
