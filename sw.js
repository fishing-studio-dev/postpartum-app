/* R10-6 service worker（R9 と同じしくみ）。
   いま：餅の家族10体（art/char_mochi_v4_*.webp）・きょうの背景・アイコン、タブ／アプリのアイコン（はなっぱ、icons/*-hana-*.png）は最初から入れる。
   うさぎ・くま などの古い絵（chars/*.svg、art/ の古い WebP）は画面では使わない。万一使われたときだけ、使うときに入れる。
   アプリのファイル（相対パス）と、firebase-config.js で固定した
   Firebase SDK の3ファイルだけをキャッシュする。Firestore / Auth / googleapis への通信と
   GET 以外のリクエストには一切さわらない。利用者のデータは保存しない。
   画像（chars/ と art/ の中）で先に入れていないものは、初めて使うときに
   取りに行き、そのときキャッシュに入れる（同じ場所の GET だけ。次からはキャッシュから出す）。
   通知は「アプリを開いている間」にページから出すものだけ（Push は使わない）。 */
'use strict';
importScripts('./firebase-config.js');
// R10-2：キャッシュ名は postpartum-r9-r10-2-2026-11-10-1（全タブの見た目・アイコン5枚・item-icons.js を足したので上げた）。
//   アイコン5枚（art/icon_*.webp、合計 140,284 バイト）は最初から入れる。くま・ハムスターは今までどおり使うときに入れる。
// R10：キャッシュ名は postpartum-r9-r10-2026-11-10-2（R10 追補1 で -1 から上げた。PREFIX は R9 のまま）。
// R10 の -1・-2 と R9.2 / R9.1 / R9 の古い名前は PREFIX が同じなので activate で消える。
// R10-2 追補1：style.css を直したので -1 → -2。
// R10-3 プレビュー：キャラの絵を最後のZIP（餅の家族）の3枚に替えたので r10-3-preview-2026-11-10-1 に上げた。
//   しくみは今までと同じ：主役（art/char_mochi_flower.webp）は最初から入れ、仲間2体
//   （art/char_mochi_raincloud.webp・art/char_mochi_pear.webp）は使うときに入れる。
//   使わなくなった R10 の char_rabbit_apricot.webp は最初から入れる一覧から外した（ファイルは art/ に残る）。
// R10-4：餅の家族10体（art/char_mochi_v4_*.webp、合計 361,012 バイト）と placement.js を足したので r10-4-2026-11-10-1 に上げた。
//   しくみは今までと同じ（FILES は最初から入れる。art/ の絵は同じ経路でキャッシュから出す）。
//   日によって「きょう」の子が10体を回るので、10枚とも最初から入れる（オフラインでもどの日の子も出るように）。
//   使わなくなった R10-3 の char_mochi_flower.webp は最初から入れる一覧から外した（ファイルは art/ に残る。万一使っても art/ の経路で入る）。
// R10-5：タブ・アプリのアイコンをうさぎから はなっぱ に替えたので r10-5-2026-11-10-1 に上げた。
//   最初から入れる一覧から ./chars/rabbit.svg と古いアイコン（icons/icon-192.png・icon-512.png・apple-touch-icon-180.png）を外し、
//   はなっぱ のアイコン4枚（icons/icon-hana-192.png・icon-hana-512.png・apple-touch-icon-hana-180.png・favicon-hana-48.png）を入れた。
//   古いファイル自体は site/ に残している（使っていない）。chars/ の SVG は、万一使われても chars/ の経路（使うときに入れる）で出る。
// R10-6：名言調のことば（words.js）・ふたりのことば（gifts.js）・キャラのシリーズ（chars/series.js）・きょうの3体の動き（stroll.js）を足したので
//   r10-6-2026-11-10-1 に上げた。新しい3ファイルを最初から入れる一覧に足した。しくみ（install・activate・fetch）は変えていない。
//   words-210.js はもう画面では使わないが、ファイルも一覧もそのまま残している。
// R10-6 見出しの直し：雲の見出し（きょう・1週間・まだ未定・やること・アルバム・設定）の字を、同じオリジンに置いた
//   Kiwi Maru Medium（SIL OFL 1.1・見出しの字だけに絞った WOFF）にしたので r10-6-2026-11-10-2 に上げ、そのファイルとライセンス文を最初から入れる一覧に足した。
// R10-7：キャラのシリーズ2〜5（フェルト・ドット絵・刺しゅう・編みぐるみ、各10体）を足したので r10-7-2026-11-11-1 に上げた。
//   chars/series-art.js と40枚の絵（art/char_felt_* / char_pixel_* / char_embroidery_* / char_crochet_*）を最初から入れる一覧に足した（シリーズ1と同じ扱い）。
//   しくみ（install・activate・fetch）は変えていない。
// R10-7-2：キャラの名前が途中で折れないように直した（ui.js・style.css）。絵の大きさを面積でそろえ直した。しくみは同じ。
const VERSION = 'r10-7-2026-11-11-2';
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
  './placement.js',
  './chars/series.js',
  './chars/series-art.js',
  './art/char_felt_01_penguin.webp',
  './art/char_felt_02_bear.webp',
  './art/char_felt_03_seal.webp',
  './art/char_felt_04_rabbit.webp',
  './art/char_felt_05_fox.webp',
  './art/char_felt_06_otter.webp',
  './art/char_felt_07_sparrow.webp',
  './art/char_felt_08_cat.webp',
  './art/char_felt_09_dog.webp',
  './art/char_felt_10_owl.webp',
  './art/char_pixel_01_sprout_heart.webp',
  './art/char_pixel_02_clover.webp',
  './art/char_pixel_03_cactus.webp',
  './art/char_pixel_04_acorn.webp',
  './art/char_pixel_05_bellflower.webp',
  './art/char_pixel_06_mushroom.webp',
  './art/char_pixel_07_fern.webp',
  './art/char_pixel_08_radish.webp',
  './art/char_pixel_09_sunflower.webp',
  './art/char_pixel_10_peapod.webp',
  './art/char_embroidery_01_hedgehog.webp',
  './art/char_embroidery_02_squirrel.webp',
  './art/char_embroidery_03_fawn.webp',
  './art/char_embroidery_04_rabbit.webp',
  './art/char_embroidery_05_mouse.webp',
  './art/char_embroidery_06_robin.webp',
  './art/char_embroidery_07_fox.webp',
  './art/char_embroidery_08_badger.webp',
  './art/char_embroidery_09_frog.webp',
  './art/char_embroidery_10_owl.webp',
  './art/char_crochet_01_lamb.webp',
  './art/char_crochet_02_bunny.webp',
  './art/char_crochet_03_bear.webp',
  './art/char_crochet_04_duck.webp',
  './art/char_crochet_05_puppy.webp',
  './art/char_crochet_06_cat.webp',
  './art/char_crochet_07_alpaca.webp',
  './art/char_crochet_08_dinosaur.webp',
  './art/char_crochet_09_whale.webp',
  './art/char_crochet_10_pony.webp',
  './stroll.js',
  './gifts.js',
  './art/char_mochi_v4_01_flower.webp',
  './art/char_mochi_v4_02_raincloud.webp',
  './art/char_mochi_v4_03_pear.webp',
  './art/char_mochi_v4_04_nightstar.webp',
  './art/char_mochi_v4_05_shell.webp',
  './art/char_mochi_v4_06_acorn.webp',
  './art/char_mochi_v4_07_owl.webp',
  './art/char_mochi_v4_08_fern.webp',
  './art/char_mochi_v4_09_ripple.webp',
  './art/char_mochi_v4_10_fox.webp',
  './art/bg_sky.webp',
  './art/bg_cloud_header.webp',
  './art/bg_cloud_small_01.webp',
  './art/bg_cloud_small_02.webp',
  './art/bg_grass_flowers.webp',
  './art/bg_ribbon_pink.webp',
  './art/icon_basket.webp',
  './art/icon_toilet_paper.webp',
  './art/icon_pump_bottle.webp',
  './art/icon_photo.webp',
  './art/icon_documents.webp',
  './item-icons.js',
  './style.css',
  './fonts/KiwiMaru-Medium-title.woff',
  './fonts/OFL-KiwiMaru.txt',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-hana-192.png',
  './icons/icon-hana-512.png',
  './icons/apple-touch-icon-hana-180.png',
  './icons/favicon-hana-48.png'
];
const SCOPE = new URL('./', self.location.href).href;
const INDEX = new URL('./index.html', self.location.href).href;
const CHARS = new URL('./chars/', self.location.href).href;
const ART = new URL('./art/', self.location.href).href;

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

// 同じ場所の画像（chars/ と art/）：キャッシュにあればそれ、無ければ取りに行って入れる（GET だけ）。
function cacheOnUse(request, url) {
  const key = url.origin + url.pathname;
  return caches.open(CACHE).then(cache => cache.match(key).then(hit => hit || fetch(request).then(res => {
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  })));
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
    event.respondWith(cacheOnUse(request, url));
    return;
  }
  // R10：art/ の絵も同じ（先に入れたものはキャッシュから、先に入れていない古い絵は初めて使うときに入れる）。
  if (url.href.startsWith(ART)) {
    event.respondWith(cacheOnUse(request, url));
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
