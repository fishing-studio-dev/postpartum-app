// 起動。Firebase SDK は firebase-config.js で固定した URL だけを読み込む。
import {createStore} from './data.js';
import {mountUI} from './ui.js';
import {preparePhoto} from './photo.js';
import {watchOnline, isOnline} from './offline.js';
import {todayLocal} from './logic.js';

const F = globalThis.SANGO_FIREBASE;

// ホーム画面アプリ（iPhone の navigator.standalone / display-mode: standalone）として開いているか。
export function isStandalone(win) {
  try {
    if (win.navigator && win.navigator.standalone === true) return true;
    return Boolean(win.matchMedia && win.matchMedia('(display-mode: standalone)').matches);
  } catch { return false; }
}
// .ics を端末の中で作って保存する（通信しない。Blob + a[download]）。
export function downloadText(win, text, fileName, type = 'text/calendar;charset=utf-8') {
  const doc = win.document;
  const url = win.URL.createObjectURL(new win.Blob([text], {type}));
  const a = doc.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  doc.body.append(a);
  a.click();
  a.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 10000);
}
// アプリを開いている間の通知。Android の Chrome は new Notification() が使えないので、
// 登録済みの Service Worker の showNotification を先に使う（Push API は使わない）。
// R10-5：通知のアイコンもアプリのアイコン（はなっぱ）に合わせた（古い icons/icon-192.png は最初から入れる一覧から外したため）。
export async function showNotification(win, title, options) {
  const o = {icon: './icons/icon-hana-192.png', badge: './icons/icon-hana-192.png', ...options};
  try {
    const sw = win.navigator && win.navigator.serviceWorker;
    const reg = sw && typeof sw.getRegistration === 'function' ? await sw.getRegistration() : null;
    if (reg && typeof reg.showNotification === 'function') { await reg.showNotification(title, o); return 'sw'; }
  } catch { /* fall through */ }
  try { new win.Notification(title, o); return 'page'; } catch { return 'none'; }
}

export async function boot(win, loadModule = url => import(url)) {
  const doc = win.document;
  let storage = null;
  try { storage = win.localStorage || null; } catch { storage = null; }
  const ui = mountUI(doc, {
    confirm: text => win.confirm(text),
    setTimeout: (fn, ms) => win.setTimeout(fn, ms),
    clearTimeout: t => (typeof win.clearTimeout === 'function' ? win.clearTimeout(t) : undefined),
    // R9: キャラクターの動き（OS の「動きを減らす」・画面外）。無い端末では使わない。
    matchMedia: typeof win.matchMedia === 'function' ? q => win.matchMedia(q) : undefined,
    IntersectionObserver: typeof win.IntersectionObserver === 'function' ? win.IntersectionObserver : undefined,
    clock: () => Date.now(),
    now: () => new Date(),
    today: () => todayLocal(new Date()),
    isOnline: () => isOnline(win),
    history: win.history,
    storage,
    Notification: win.Notification,
    showNotification: (title, options) => showNotification(win, title, options),
    download: (text, name) => downloadText(win, text, name),
    preparePhoto: file => preparePhoto(file, {createImageBitmap: win.createImageBitmap && win.createImageBitmap.bind(win), document: doc, URL: win.URL})
  });
  if (typeof win.addEventListener === 'function') {
    win.addEventListener('popstate', () => ui.guard.handlePop());
    win.addEventListener('pageshow', e => { if (e && e.persisted) { ui.guard.resume(); ui.refreshDay(); } });
  }
  watchOnline(win, on => ui.setOnline(on));
  if (win.navigator && win.navigator.serviceWorker && win.isSecureContext) {
    win.navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  let mods;
  try {
    mods = await Promise.all([loadModule(F.sdk.app), loadModule(F.sdk.auth), loadModule(F.sdk.firestore)]);
  } catch {
    ui.render({auth: 'error', items: [], photos: [], settings: null, error: 'つながったら開けます'});
    return null;
  }
  const [appSdk, authSdk, fs] = mods;
  const app = appSdk.initializeApp(F.config);
  const auth = authSdk.getAuth(app);
  const db = fs.initializeFirestore(app, {localCache: fs.persistentLocalCache({tabManager: fs.persistentMultipleTabManager()})});
  const store = createStore({auth, db, authSdk, fs, isStandalone: () => isStandalone(win)});
  ui.attach(store);
  store.start();
  return store;
}

if (typeof window !== 'undefined' && window.document && F) boot(window);
