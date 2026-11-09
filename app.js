// 起動。Firebase SDK は firebase-config.js で固定した URL だけを読み込む。
import {createStore} from './data.js';
import {mountUI} from './ui.js';
import {preparePhoto} from './photo.js';
import {watchOnline, isOnline} from './offline.js';
import {todayLocal} from './logic.js';

const F = globalThis.SANGO_FIREBASE;

export async function boot(win, loadModule = url => import(url)) {
  const doc = win.document;
  const ui = mountUI(doc, {
    confirm: text => win.confirm(text),
    today: () => todayLocal(new Date()),
    isOnline: () => isOnline(win),
    preparePhoto: file => preparePhoto(file, {createImageBitmap: win.createImageBitmap && win.createImageBitmap.bind(win), document: doc, URL: win.URL})
  });
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
  const store = createStore({auth, db, authSdk, fs});
  ui.attach(store);
  store.start();
  return store;
}

if (typeof window !== 'undefined' && window.document && F) boot(window);
