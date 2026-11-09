// データ層。Firebase の関数は外から渡す（テストでは偽物を渡す）。
//   deps.auth / deps.db             : getAuth() / initializeFirestore() の結果
//   deps.authSdk                    : firebase-auth.js の関数
//   deps.fs                         : firebase-firestore.js の関数
//   deps.hashFn, deps.newId         : 省略可
import {DUE_DATE, isAllowedUser, sha256Hex, validateItem, validateBirthDate, buildSeed, newId as defaultNewId, shortName} from './logic.js';
import {SEED_ITEMS} from './seed-data.js';

const FALLBACK_CODES = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];
const QUIET_CODES = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

export function createStore(deps) {
  const {auth, db, authSdk: A, fs: F} = deps;
  const hashFn = deps.hashFn || sha256Hex;
  const makeId = deps.newId || (() => defaultNewId());
  let state = {auth: 'loading', user: null, settings: null, items: [], photos: [], fromCache: false, error: ''};
  let user = null;
  let unsubs = [];
  let denied = false;
  const listeners = new Set();
  const loaded = {settings: false, items: false, photos: false};

  function set(patch) { state = {...state, ...patch}; for (const fn of listeners) fn(state); }
  function stopWatching() { for (const u of unsubs) { try { u(); } catch { /* ignore */ } } unsubs = []; }
  const ref = (col, id) => F.doc(db, col, id);
  const stamp = () => ({updatedAt: F.serverTimestamp(), updatedBy: user ? user.uid : ''});
  const who = () => ({uid: user.uid, name: shortName(user.displayName)});
  const readData = d => (typeof d.data === 'function' ? d.data({serverTimestamps: 'estimate'}) : d.data);
  const cacheFlag = snap => Boolean(snap && snap.metadata && snap.metadata.fromCache);

  function watch() {
    stopWatching();
    const onErr = e => set({error: errText(e)});
    unsubs.push(F.onSnapshot(ref('meta', 'settings'), snap => {
      loaded.settings = true;
      set({settings: snap.exists() ? readData(snap) : null, fromCache: cacheFlag(snap)});
    }, onErr));
    unsubs.push(F.onSnapshot(F.collection(db, 'items'), snap => {
      loaded.items = true;
      set({items: snap.docs.map(d => ({id: d.id, ...readData(d)})), fromCache: cacheFlag(snap)});
    }, onErr));
    unsubs.push(F.onSnapshot(F.collection(db, 'photos'), snap => {
      loaded.photos = true;
      const photos = snap.docs.map(d => ({id: d.id, ...readData(d)}));
      photos.sort((a, b) => time(b.addedAt) - time(a.addedAt) || (a.id < b.id ? -1 : 1));
      set({photos, fromCache: cacheFlag(snap)});
    }, onErr));
  }

  // 初回だけ、トランザクションの中で meta/settings と項目をまとめて作る（2人同時でも1回）。
  async function ensureSeeded() {
    const settingsRef = ref('meta', 'settings');
    return F.runTransaction(db, async tx => {
      const snap = await tx.get(settingsRef);
      if (snap.exists()) return false;
      tx.set(settingsRef, {birthDate: null, dueDate: DUE_DATE, seeded: true, ...stamp()});
      for (const s of buildSeed(SEED_ITEMS)) tx.set(ref('items', s.id), {...s.data, ...stamp()});
      return true;
    });
  }

  async function onUser(u) {
    if (!u) {
      user = null;
      stopWatching();
      set({auth: denied ? 'denied' : 'signedOut', user: null, settings: null, items: [], photos: []});
      return;
    }
    let ok = false;
    try { ok = await isAllowedUser(u, hashFn); } catch { ok = false; }
    if (!ok) {
      // Firestore を読む前にログアウトする。
      denied = true;
      user = null;
      stopWatching();
      set({auth: 'denied', user: null, settings: null, items: [], photos: []});
      try { await A.signOut(auth); } catch { /* ignore */ }
      return;
    }
    denied = false;
    user = u;
    set({auth: 'ready', user: {uid: u.uid, name: shortName(u.displayName)}, error: ''});
    watch();
    try { await ensureSeeded(); } catch (e) { set({error: state.items.length ? '' : errText(e)}); }
  }

  function start() {
    if (A.getRedirectResult) A.getRedirectResult(auth).catch(e => set({error: errText(e)}));
    return A.onAuthStateChanged(auth, u => { onUser(u); });
  }

  async function signIn() {
    denied = false;
    set({error: '', auth: state.auth === 'denied' ? 'signedOut' : state.auth});
    const provider = new A.GoogleAuthProvider();
    if (provider.setCustomParameters) provider.setCustomParameters({prompt: 'select_account'});
    try {
      await A.signInWithPopup(auth, provider);
      return 'popup';
    } catch (e) {
      const code = e && e.code;
      if (FALLBACK_CODES.includes(code)) { await A.signInWithRedirect(auth, provider); return 'redirect'; }
      if (QUIET_CODES.includes(code)) return 'cancelled';
      set({error: errText(e)});
      return 'error';
    }
  }
  async function signOut() { denied = false; await A.signOut(auth); }

  function need() { if (!user) throw new Error('not-signed-in'); }
  // 書き込みはオフラインでも Firestore が順番待ちにして、つながったら送る。
  // そのため戻り値の Promise は待たなくてよい。
  function setDone(id, done) {
    need();
    const patch = done ? {done: true, doneBy: who(), doneAt: F.serverTimestamp()} : {done: false, doneBy: null, doneAt: null};
    return F.updateDoc(ref('items', id), {...patch, ...stamp()});
  }
  function addItem(input) {
    need();
    const v = validateItem(input);
    if (!v.ok) return {ok: false, errors: v.errors};
    const id = makeId();
    const data = {...v.value, calc: null, note: '', rule: '', confidence: '', tag: '', ifReturnAfter: null, order: 100000,
      done: false, doneBy: null, doneAt: null, custom: true, ...stamp()};
    return {ok: true, id, write: F.setDoc(ref('items', id), data)};
  }
  function editItem(id, input) {
    need();
    const v = validateItem(input);
    if (!v.ok) return {ok: false, errors: v.errors};
    return {ok: true, id, write: F.updateDoc(ref('items', id), {...v.value, ...stamp()})};
  }
  function setMemo(id, memo, current) {
    const v = validateItem({...current, memo});
    if (!v.ok) return {ok: false, errors: v.errors};
    need();
    return {ok: true, write: F.updateDoc(ref('items', id), {memo: v.value.memo, ...stamp()})};
  }
  function deleteItem(id) { need(); return F.deleteDoc(ref('items', id)); }
  function setBirthDate(date) {
    need();
    const v = validateBirthDate(date);
    if (!v.ok) return {ok: false};
    return {ok: true, write: F.setDoc(ref('meta', 'settings'), {birthDate: v.value, dueDate: DUE_DATE, seeded: true, ...stamp()})};
  }
  function addPhoto(p) {
    need();
    const id = makeId();
    const batch = F.writeBatch(db);
    const by = who();
    batch.set(ref('photos', id), {thumb: p.thumb, w: p.w, h: p.h, bytes: p.bytes, addedBy: by, addedAt: F.serverTimestamp()});
    batch.set(ref('photoFull', id), {data: p.full, addedBy: by.uid, addedAt: F.serverTimestamp()});
    return {id, write: batch.commit()};
  }
  function deletePhoto(id) {
    need();
    const batch = F.writeBatch(db);
    batch.delete(ref('photos', id));
    batch.delete(ref('photoFull', id));
    return batch.commit();
  }
  async function loadFull(id) {
    need();
    const snap = await F.getDoc(ref('photoFull', id));
    return snap.exists() ? readData(snap).data : null;
  }

  return {
    start, signIn, signOut, ensureSeeded, setDone, addItem, editItem, setMemo, deleteItem, setBirthDate, addPhoto, deletePhoto, loadFull,
    subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    get state() { return state; }
  };
}

function time(v) { if (!v) return Infinity; if (v instanceof Date) return v.getTime(); if (typeof v.toMillis === 'function') return v.toMillis(); if (typeof v.toDate === 'function') return v.toDate().getTime(); return 0; }
export function errText(e) {
  const code = (e && e.code) || '';
  if (code === 'permission-denied') return 'このアプリは使えません';
  if (code === 'unavailable' || code === 'auth/network-request-failed') return 'つながったらもう一度';
  return 'うまくいきませんでした';
}
