// データ層。Firebase の関数は外から渡す（テストでは偽物を渡す）。
//   deps.auth / deps.db             : getAuth() / initializeFirestore() の結果
//   deps.authSdk                    : firebase-auth.js の関数
//   deps.fs                         : firebase-firestore.js の関数
//   deps.hashFn, deps.newId         : 省略可
//   deps.isStandalone               : 省略可。ホーム画面アプリとして開いているか
import {DUE_DATE, SEED_VERSION, isAllowedUser, sha256Hex, validateItem, validateBirth, validatePlan, validateFamily, buildSeed, newId as defaultNewId, shortName, planOf as planOfItem} from './logic.js';
import {cleanPrefs} from './prefs.js';
import {SEED_ITEMS} from './seed-data.js';
import {SEED_V2_ITEMS} from './seed-v2.js';
import {validateGift, sortGifts} from './gifts.js';

const FALLBACK_CODES = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];
const QUIET_CODES = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];
export const STANDALONE_LOGIN_TEXT = 'ホーム画面のアプリでログインできないときは、Safariでこのページを開いてログインしてください';
// R7 までの項目（seedVersion 1）と、R8 で増えた項目（seedVersion 2）。
export const ALL_SEED = buildSeed([...SEED_ITEMS, ...SEED_V2_ITEMS]);
export const V2_IDS = Object.freeze(SEED_V2_ITEMS.map(s => s.id));

export function createStore(deps) {
  const {auth, db, authSdk: A, fs: F} = deps;
  const hashFn = deps.hashFn || sha256Hex;
  const makeId = deps.newId || (() => defaultNewId());
  const standalone = deps.isStandalone || (() => false);
  let state = {auth: 'loading', user: null, settings: null, family: null, familyLoaded: false, myHash: '', items: [], photos: [], prefs: null, gifts: [], giftsLoaded: false, fromCache: false, error: ''};
  let user = null;
  let unsubs = [];
  let denied = false;
  const listeners = new Set();

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
      set({settings: snap.exists() ? readData(snap) : null, fromCache: cacheFlag(snap)});
    }, onErr));
    unsubs.push(F.onSnapshot(ref('meta', 'family'), snap => {
      // キャッシュだけで「無い」と言われたときは、まだ分からないものとして扱う。
      const exists = snap.exists();
      set({family: exists ? readData(snap) : null, familyLoaded: exists || !cacheFlag(snap)});
    }, onErr));
    unsubs.push(F.onSnapshot(F.collection(db, 'items'), snap => {
      set({items: snap.docs.map(d => ({id: d.id, ...readData(d)})), fromCache: cacheFlag(snap)});
    }, onErr));
    unsubs.push(F.onSnapshot(F.collection(db, 'photos'), snap => {
      const photos = snap.docs.map(d => ({id: d.id, ...readData(d)}));
      photos.sort((a, b) => time(b.addedAt) - time(a.addedAt) || (a.id < b.id ? -1 : 1));
      set({photos, fromCache: cacheFlag(snap)});
    }, onErr));
    // R10-6：夫婦で贈り合うことば（gifts）。読めるのはログインできる2人だけ（firestore.rules）。
    unsubs.push(F.onSnapshot(F.collection(db, 'gifts'), snap => {
      set({gifts: sortGifts(snap.docs.map(d => ({id: d.id, ...readData(d)}))), giftsLoaded: state.giftsLoaded || !cacheFlag(snap) || snap.docs.length > 0});
    }, () => set({giftsLoaded: true})));
    // R9: 自分だけの設定（キャラクター・動き）。文書が無くてもよい（既定値を使う）。
    if (state.myHash) {
      unsubs.push(F.onSnapshot(ref('prefs', state.myHash), snap => {
        set({prefs: snap.exists() ? cleanPrefs(readData(snap)) : {}});
      }, () => set({prefs: state.prefs || {}})));
    }
  }

  // 最初の項目づくりと、版ごとの追加（移行）。トランザクションの中で行う（2人同時でも安全）。
  //   meta/settings が無い         → 設定と全項目を作る（seedVersion 2）
  //   seedVersion が無い（=1）/ <2 → R8 で増えた項目のうち、無いものだけ作る。既存の項目には触れない
  //   seedVersion >= 2             → 何もしない
  // 戻り値: 'seeded' | 'migrated' | false
  async function ensureSeeded() {
    const settingsRef = ref('meta', 'settings');
    return F.runTransaction(db, async tx => {
      const snap = await tx.get(settingsRef);
      if (!snap.exists()) {
        tx.set(settingsRef, {birthDate: null, dueDate: DUE_DATE, seeded: true, seedVersion: SEED_VERSION, ...stamp()});
        for (const s of ALL_SEED) tx.set(ref('items', s.id), {...s.data, ...stamp()});
        return 'seeded';
      }
      const cur = readData(snap) || {};
      const version = typeof cur.seedVersion === 'number' ? cur.seedVersion : 1;
      if (version >= SEED_VERSION) return false;
      const fresh = ALL_SEED.filter(s => V2_IDS.includes(s.id));
      const missing = [];
      for (const s of fresh) { const d = await tx.get(ref('items', s.id)); if (!d.exists()) missing.push(s); }
      for (const s of missing) tx.set(ref('items', s.id), {...s.data, ...stamp()});
      tx.update(settingsRef, {seedVersion: SEED_VERSION, ...stamp()});
      return 'migrated';
    });
  }

  async function onUser(u) {
    if (!u) {
      user = null;
      stopWatching();
      set({auth: denied ? 'denied' : 'signedOut', user: null, settings: null, family: null, familyLoaded: false, myHash: '', items: [], photos: [], prefs: null, gifts: [], giftsLoaded: false});
      return;
    }
    let ok = false;
    try { ok = await isAllowedUser(u, hashFn); } catch { ok = false; }
    if (!ok) {
      // Firestore を読む前にログアウトする。
      denied = true;
      user = null;
      stopWatching();
      set({auth: 'denied', user: null, settings: null, family: null, familyLoaded: false, myHash: '', items: [], photos: [], prefs: null, gifts: [], giftsLoaded: false});
      try { await A.signOut(auth); } catch { /* ignore */ }
      return;
    }
    denied = false;
    user = u;
    let myHash = '';
    try { myHash = await hashFn(String(u.email).trim().toLowerCase()); } catch { myHash = ''; }
    set({auth: 'ready', user: {uid: u.uid, name: shortName(u.displayName)}, myHash, error: ''});
    watch();
    try { await ensureSeeded(); } catch (e) { set({error: state.items.length ? '' : errText(e)}); }
  }

  function start() {
    if (A.getRedirectResult) A.getRedirectResult(auth).catch(e => set({error: loginErrText(e)}));
    return A.onAuthStateChanged(auth, u => { onUser(u); });
  }
  function loginErrText(e) { return standalone() ? STANDALONE_LOGIN_TEXT : errText(e); }

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
      if (FALLBACK_CODES.includes(code)) {
        try { await A.signInWithRedirect(auth, provider); return 'redirect'; } catch (e2) { set({error: loginErrText(e2)}); return 'error'; }
      }
      if (QUIET_CODES.includes(code)) {
        // ホーム画面アプリではポップアップがすぐ閉じてしまうことがある。
        if (standalone()) set({error: STANDALONE_LOGIN_TEXT});
        return 'cancelled';
      }
      set({error: loginErrText(e)});
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
    const p = validatePlan(input);
    if (!v.ok || !p.ok) return {ok: false, errors: [...v.errors, ...p.errors]};
    const id = makeId();
    const data = {...v.value, ...p.value, calc: null, note: '', rule: '', confidence: '', tag: '', ifReturnAfter: null, order: 100000,
      done: false, doneBy: null, doneAt: null, custom: true, ...stamp()};
    return {ok: true, id, write: F.setDoc(ref('items', id), data)};
  }
  function editItem(id, input) {
    need();
    const v = validateItem(input);
    if (!v.ok) return {ok: false, errors: v.errors};
    return {ok: true, id, write: F.updateDoc(ref('items', id), {...v.value, ...stamp()})};
  }
  // いつ・誰が。ほかの項目（完了・メモなど）には触れない。
  function setPlan(id, input) {
    need();
    const p = validatePlan(input);
    if (!p.ok) return {ok: false, errors: p.errors};
    return {ok: true, write: F.updateDoc(ref('items', id), {...p.value, ...stamp()})};
  }
  function setMemo(id, memo, current) {
    const v = validateItem({...current, memo});
    if (!v.ok) return {ok: false, errors: v.errors};
    need();
    return {ok: true, write: F.updateDoc(ref('items', id), {memo: v.value.memo, ...stamp()})};
  }
  // R9: 詳細の「保存」。メモと いつ・誰が のうち、変わったものだけを1回の update で書く（済み・期限などには触れない）。
  // current: 今の項目（変わったかどうかの比較用）。何も変わっていなければ書かない。
  function saveDetail(id, input, current) {
    const cur = current || {};
    const v = validateItem({...cur, title: cur.title || 'x', category: cur.category || '準備', memo: input.memo});
    const p = validatePlan(input);
    const errors = [...v.errors.filter(e => /メモ/.test(e)), ...p.errors];
    if (errors.length) return {ok: false, errors};
    need();
    const before = planOfItem(cur);
    const patch = {};
    if ((cur.memo || '') !== v.value.memo) patch.memo = v.value.memo;
    for (const k of ['planDate', 'planTime', 'assignee']) if (before[k] !== p.value[k]) patch[k] = p.value[k];
    if (!Object.keys(patch).length) return {ok: true, unchanged: true, write: Promise.resolve()};
    return {ok: true, unchanged: false, fields: Object.keys(patch), write: F.updateDoc(ref('items', id), {...patch, ...stamp()})};
  }
  // R9.1:「予定は不要」の印。書くのは noPlanNeeded（true / false）と、いつもの記録（updatedAt / updatedBy）だけ。
  // 外すときも false を書く（項目を消したり、ほかの値に触れたりしない）。利用者が押したときだけ呼ばれる。
  function setNoPlanNeeded(id, on) {
    need();
    return F.updateDoc(ref('items', id), {noPlanNeeded: Boolean(on), ...stamp()});
  }
  // R9: 自分だけの設定。prefs/{sha256(小文字メール)} に merge で書く。meta/* には書かない。
  function setPrefs(patch) {
    need();
    const clean = cleanPrefs(patch);
    if (!Object.keys(clean).length) return {ok: false, errors: ['うまくいきませんでした']};
    if (!state.myHash) return {ok: false, errors: ['うまくいきませんでした']};
    return {ok: true, write: F.setDoc(ref('prefs', state.myHash), {...clean, ...stamp()}, {merge: true})};
  }
  // R10-6：ことばを贈る。fromRole はこのアカウントの役割（はっきり選んだもの。推測した役割では贈らない）。
  //   書くのは text・from・to・createdAt・createdBy（uid）だけ。メール・表示名は書かない。書き換え・削除はしない。
  function sendGift(text, fromRole) {
    need();
    const v = validateGift(text, fromRole);
    if (!v.ok) return {ok: false, errors: v.errors};
    const id = makeId();
    return {ok: true, id, write: F.setDoc(ref('gifts', id), {...v.value, createdAt: F.serverTimestamp(), createdBy: user.uid})};
  }
  function deleteItem(id) { need(); return F.deleteDoc(ref('items', id)); }
  // 出生日と時刻。meta/settings のほかの値（seedVersion など）は残す（merge）。
  function setBirth(date, timeText, today) {
    need();
    const v = validateBirth(date, timeText, today);
    if (!v.ok) return {ok: false, errors: v.errors};
    return {ok: true, write: F.setDoc(ref('meta', 'settings'), {birthDate: v.value.birthDate, birthTime: v.value.birthTime, dueDate: DUE_DATE, ...stamp()}, {merge: true})};
  }
  function setBirthDate(date) { return setBirth(date, null); }
  // 家族の名前と、このアカウントの役割。roles はアカウントごと（merge なので、もう1人の分は残る）。
  function saveFamily(input) {
    need();
    const v = validateFamily(input);
    if (!v.ok) return {ok: false, errors: v.errors};
    if (!state.myHash) return {ok: false, errors: ['うまくいきませんでした']};
    const data = {...v.value, roles: {[state.myHash]: v.role}, ...stamp()};
    return {ok: true, write: F.setDoc(ref('meta', 'family'), data, {merge: true})};
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
    start, signIn, signOut, ensureSeeded, setDone, addItem, editItem, setPlan, setMemo, saveDetail, setNoPlanNeeded, setPrefs, sendGift, deleteItem, setBirth, setBirthDate, saveFamily,
    addPhoto, deletePhoto, loadFull,
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
