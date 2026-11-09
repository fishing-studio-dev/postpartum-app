/* R9.1 service worker（R9 と同じしくみ。キャッシュの名前だけ新しくした）。アプリのファイル（相対パス）と、firebase-config.js で固定した
   Firebase SDK の3ファイルだけをキャッシュする。Firestore / Auth / googleapis への通信と
   GET 以外のリクエストには一切さわらない。利用者のデータは保存しない。
   キャラクターの画像は、最初のうさぎだけを先に入れる。ほかの子（chars/ の中）は、選んで初めて使うときに
   取りに行き、そのときキャッシュに入れる（同じ場所の GET だけ。次からはキャッシュから出す）。
   通知は「アプリを開いている間」にページから出すものだけ（Push は使わない）。 */
'use strict';
importScripts('./firebase-config.js');
// R9.1：キャッシュ名は postpartum-r9-r9-1-2026-11-10-1。R9 の postpartum-r9-r9-2026-11-10-1 は PREFIX が同じなので activate で消える。
const VERSION = 'r9-1-2026-11-10-1';
const PREFIX = 'postpartum-r9-';
const LEGACY_PREFIXES = ['postpartum-r8-', 'postpartum-r7-', 'postpartum-r6-', 'postpartum-r5-'];
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
  './words-210.js',
  './history.js',
  './notify.js',
  './motion.js',
  './prefs.js',
  './chars/registry.js',
  './chars/rabbit.svg',
  './style.css',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png'
];
const SCOPE = new URL('./', self.location.href).href;
const INDEX = new URL('./index.html', self.location.href).href;
const CHARS = new URL('./chars/', self.location.href).href;

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
  // キャラクター画像（chars/）：キャッシュにあればそれ、無ければ取りに行って入れる。
  if (url.href.startsWith(CHARS)) {
    const key = url.origin + url.pathname;
    event.respondWith(caches.open(CACHE).then(cache => cache.match(key).then(hit => hit || fetch(request).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    }))));
    return;
  }
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
