// 画面。DOM は createElement / textContent だけで作る（HTML 文字列は使わない）。
import {CATEGORIES, DUE_DATE, groupItems, itemDate, computeDue, dateLabel, conditionLabel, isOverdue, doneLabel, formatShort, formatMD, toDate, shortName} from './logic.js';
import {OFFLINE_TEXT, QUEUED_TEXT} from './offline.js';
import {MAX_FILES} from './photo.js';
import {errText} from './data.js';

export const DENIED_TEXT = 'このアプリは使えません';

export function mountUI(document, opts = {}) {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const confirmFn = opts.confirm || (() => true);
  const today = opts.today || (() => '');
  const online = opts.isOnline || (() => true);
  const later = opts.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  let store = null;
  let state = {auth: 'loading', items: [], photos: [], settings: null};
  let cat = 'すべて', showDone = false, tab = 'todo';
  let detailId = null, editId = null, viewerId = null;
  let netOnline = true, toastSeq = 0;

  const settings = () => state.settings || {birthDate: null, dueDate: DUE_DATE};
  const findItem = id => state.items.find(i => i.id === id) || null;

  function toast(text) {
    const t = $('toast');
    t.textContent = text; t.hidden = !text;
    const seq = ++toastSeq;
    if (text) later(() => { if (seq === toastSeq) { t.hidden = true; t.textContent = ''; } }, 3000);
  }
  // 書き込みの結果は待たない（オフラインでも順番待ちにされる）。失敗だけ知らせる。
  function track(write) {
    if (!online() || !netOnline) toast(QUEUED_TEXT);
    if (write && typeof write.catch === 'function') write.catch(e => toast(errText(e)));
  }

  // ---- screens ----
  function renderScreens() {
    const a = state.auth;
    $('loading').hidden = a !== 'loading';
    $('login').hidden = !(a === 'signedOut' || a === 'denied' || a === 'error');
    $('app').hidden = a !== 'ready';
    $('login-msg').textContent = a === 'denied' ? DENIED_TEXT : (a === 'ready' ? '' : state.error || '');
    $('login-btn').disabled = false;
    if (a !== 'ready') for (const id of ['detail', 'editor', 'settings', 'viewer']) $(id).hidden = true;
  }
  function renderPill() {
    const off = !netOnline || (online() === false);
    const pill = $('offline-pill');
    pill.hidden = !off;
    pill.textContent = off ? OFFLINE_TEXT : '';
  }

  // ---- todo ----
  function renderChips() {
    const box = $('chips');
    box.replaceChildren(...['すべて', ...CATEGORIES].map(c => {
      const b = el('button', 'chip', c);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(c === cat));
      b.onclick = () => { cat = c; renderTodo(); };
      return b;
    }));
  }
  function row(item, s, t) {
    const li = el('li', 'row' + (item.done ? ' is-done' : '') + (isOverdue(item, s, t) ? ' is-overdue' : ''));
    li.setAttribute('data-id', item.id);
    const check = el('button', 'check', item.done ? '✓' : '');
    check.type = 'button';
    check.setAttribute('aria-pressed', String(Boolean(item.done)));
    check.setAttribute('aria-label', item.done ? '完了を取り消す' : '完了にする');
    check.onclick = () => toggleDone(item.id);
    const main = el('button', 'row-main');
    main.type = 'button';
    main.onclick = () => openDetail(item.id);
    const title = el('span', 'row-title', item.title);
    const meta = el('span', 'row-meta');
    if (isOverdue(item, s, t)) meta.append(el('span', 'badge overdue', '期限切れ'));
    const label = item.done ? doneLabel(item) : dateLabel(item, s);
    if (label) meta.append(el('span', 'row-date', label));
    meta.append(el('span', 'badge cat', item.category));
    if (item.tag) meta.append(el('span', 'badge tag', item.tag));
    main.append(title, meta);
    li.append(check, main);
    return li;
  }
  function renderTodo() {
    renderChips();
    const s = settings(), t = today();
    const g = groupItems(state.items, s, t, cat);
    const list = $('todo-list');
    const nodes = [...g.overdue, ...g.dated].map(i => row(i, s, t));
    if (g.undated.length) {
      nodes.push(el('li', 'group-head', '日付なし'));
      for (const i of g.undated) nodes.push(row(i, s, t));
    }
    list.replaceChildren(...nodes);
    $('todo-empty').hidden = nodes.length > 0;
    const toggle = $('done-toggle');
    toggle.textContent = '完了 ' + g.done.length;
    toggle.setAttribute('aria-expanded', String(showDone));
    toggle.hidden = g.done.length === 0;
    const dl = $('done-list');
    dl.hidden = !showDone || g.done.length === 0;
    dl.replaceChildren(...(showDone ? g.done.map(i => row(i, s, t)) : []));
  }
  function toggleDone(id) {
    const it = findItem(id);
    if (!it || !store) return;
    track(store.setDone(id, !it.done));
  }

  // ---- detail ----
  function openDetail(id) { detailId = id; renderDetail(); $('detail').hidden = false; }
  function closeDetail() { detailId = null; $('detail').hidden = true; }
  function renderDetail(keepMemo) {
    if (!detailId) return;
    const it = findItem(detailId);
    if (!it) { closeDetail(); return; }
    const s = settings();
    $('d-title').textContent = it.title;
    const lab = dateLabel(it, s);
    $('d-date').textContent = lab ? lab + (isOverdue(it, s, today()) ? '（期限切れ）' : '') : '日付なし';
    const cond = conditionLabel(it, s);
    $('d-cond').hidden = !cond; $('d-cond').textContent = cond;
    $('d-rule').textContent = it.rule || '';
    $('d-place').textContent = it.place || '－';
    const docs = (it.documents || []).map(d => el('li', '', d));
    $('d-docs').replaceChildren(...(docs.length ? docs : [el('li', 'muted', '－')]));
    $('d-note').textContent = it.note || '';
    if (!keepMemo) $('d-memo').value = it.memo || '';
    const link = $('d-link');
    if (it.sourceUrl && /^https:\/\//.test(it.sourceUrl)) { link.href = it.sourceUrl; link.hidden = false; }
    else { link.hidden = true; link.removeAttribute('href'); }
    $('d-done').textContent = it.done ? '完了を取り消す' : '完了にする';
    $('d-done').setAttribute('aria-pressed', String(Boolean(it.done)));
    $('d-done-by').textContent = doneLabel(it);
  }

  // ---- editor ----
  function openEditor(id) {
    editId = id || null;
    const it = id ? findItem(id) : null;
    $('e-heading').textContent = it ? '編集' : '追加';
    $('e-category').replaceChildren(...CATEGORIES.map(c => { const o = el('option', '', c); o.value = c; return o; }));
    $('e-title').value = it ? it.title : '';
    $('e-category').value = it ? it.category : (cat !== 'すべて' ? cat : '準備');
    $('e-date').value = it ? (itemDate(it, settings()) || '') : '';
    $('e-place').value = it ? it.place || '' : '';
    $('e-docs').value = it ? (it.documents || []).join('\n') : '';
    $('e-memo').value = it ? it.memo || '' : '';
    $('e-link').value = it ? it.sourceUrl || '' : '';
    $('e-error').textContent = '';
    $('editor').hidden = false;
  }
  function saveEditor() {
    if (!store) return;
    const it = editId ? findItem(editId) : null;
    const date = $('e-date').value || '';
    const auto = it ? computeDue(it.calc, settings()) : null;
    const input = {
      title: $('e-title').value,
      category: $('e-category').value,
      dateOverride: date === '' || date === auto ? null : date,
      place: $('e-place').value,
      documents: $('e-docs').value.split('\n'),
      memo: $('e-memo').value,
      sourceUrl: $('e-link').value
    };
    const res = it ? store.editItem(it.id, input) : store.addItem(input);
    if (!res.ok) { $('e-error').textContent = res.errors[0]; return; }
    track(res.write);
    $('editor').hidden = true;
    editId = null;
  }

  // ---- settings ----
  function openSettings() {
    const s = settings();
    $('s-birth').value = s.birthDate || '';
    $('s-due').textContent = '予定日 ' + formatShort(s.dueDate || DUE_DATE) + (s.birthDate ? '' : '（出生日が未入力なら予定日で計算）');
    $('settings').hidden = false;
  }
  function saveBirth(value) {
    if (!store) return;
    const res = store.setBirthDate(value);
    if (!res.ok) { toast('日付が正しくありません'); return; }
    track(res.write);
    $('settings').hidden = true;
  }

  // ---- photos ----
  function renderPhotos() {
    const grid = $('photo-grid');
    grid.replaceChildren(...state.photos.map(p => {
      const li = el('li', 'cell');
      const b = el('button', 'thumb');
      b.type = 'button';
      b.setAttribute('aria-label', '写真を開く');
      const img = el('img');
      img.src = p.thumb; img.alt = '';
      b.append(img);
      b.onclick = () => openViewer(p.id);
      li.append(b);
      return li;
    }));
    $('photo-empty').hidden = state.photos.length > 0;
  }
  function photoBy(p) {
    const at = toDate(p.addedAt);
    return shortName(p.addedBy && p.addedBy.name) + 'さん' + (at ? ' ' + formatMD(at) : '');
  }
  function openViewer(id) {
    const p = state.photos.find(x => x.id === id);
    if (!p || !store) return;
    viewerId = id;
    $('v-img').src = p.thumb;
    $('v-by').textContent = photoBy(p);
    $('viewer').hidden = false;
    store.loadFull(id).then(data => { if (viewerId === id && data) $('v-img').src = data; }).catch(() => {});
  }
  async function addPhotos(files) {
    if (!store || !opts.preparePhoto) return;
    const list = Array.from(files || []).slice(0, MAX_FILES);
    const status = $('photo-status');
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      status.textContent = '準備中 ' + (i + 1) + '/' + list.length;
      try { track(store.addPhoto(await opts.preparePhoto(list[i])).write); } catch { failed++; }
    }
    status.textContent = failed ? failed + '枚は追加できませんでした' : '';
  }

  function renderTab() {
    $('tab-todo').hidden = tab !== 'todo';
    $('tab-photos').hidden = tab !== 'photos';
    $('tab-btn-todo').setAttribute('aria-selected', String(tab === 'todo'));
    $('tab-btn-photos').setAttribute('aria-selected', String(tab === 'photos'));
  }

  function render(next) {
    if (next) state = next;
    renderScreens();
    renderPill();
    if (state.auth !== 'ready') return;
    renderTab();
    renderTodo();
    renderPhotos();
    renderDetail(true);
    if (viewerId && !state.photos.some(p => p.id === viewerId)) { viewerId = null; $('viewer').hidden = true; }
    if (editId && !findItem(editId)) { editId = null; $('editor').hidden = true; }
  }

  // ---- wiring ----
  $('login-btn').onclick = () => { if (store) { $('login-btn').disabled = true; store.signIn().finally(() => { $('login-btn').disabled = false; }); } };
  $('gear').onclick = openSettings;
  $('tab-btn-todo').onclick = () => { tab = 'todo'; renderTab(); };
  $('tab-btn-photos').onclick = () => { tab = 'photos'; renderTab(); };
  $('done-toggle').onclick = () => { showDone = !showDone; renderTodo(); };
  $('add-btn').onclick = () => openEditor(null);
  $('d-close').onclick = closeDetail;
  $('d-done').onclick = () => { if (detailId) toggleDone(detailId); };
  $('d-edit').onclick = () => { const id = detailId; closeDetail(); openEditor(id); };
  $('d-delete').onclick = () => {
    const it = findItem(detailId);
    if (!it || !store || !confirmFn('「' + it.title + '」を削除しますか？')) return;
    track(store.deleteItem(it.id));
    closeDetail();
  };
  $('d-memo-save').onclick = () => {
    const it = findItem(detailId);
    if (!it || !store) return;
    const res = store.setMemo(it.id, $('d-memo').value, it);
    if (!res.ok) { toast(res.errors[0]); return; }
    track(res.write);
    toast('保存しました');
  };
  $('e-save').onclick = saveEditor;
  $('e-cancel').onclick = () => { $('editor').hidden = true; editId = null; };
  $('s-save').onclick = () => saveBirth($('s-birth').value || null);
  $('s-clear').onclick = () => saveBirth(null);
  $('s-close').onclick = () => { $('settings').hidden = true; };
  $('s-logout').onclick = () => { $('settings').hidden = true; if (store) store.signOut().catch(() => {}); };
  $('photo-input').onchange = () => { const input = $('photo-input'); const files = Array.from(input.files || []); input.value = ''; return addPhotos(files); };
  $('v-close').onclick = () => { viewerId = null; $('viewer').hidden = true; };
  $('v-delete').onclick = () => {
    if (!viewerId || !store || !confirmFn('この写真を削除しますか？')) return;
    track(store.deletePhoto(viewerId));
    viewerId = null;
    $('viewer').hidden = true;
  };

  render();
  return {
    attach(s) { store = s; return s.subscribe(render); },
    render,
    setOnline(v) { netOnline = v; renderPill(); },
    toast,
    get openDetailId() { return detailId; }
  };
}
