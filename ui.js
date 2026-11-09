// 画面。DOM は createElement / textContent だけで作る（HTML 文字列は使わない）。
import {CATEGORIES, DUE_DATE, itemDate, computeDue, dateLabel, conditionLabel, isOverdue, doneLabel, formatShort, formatMD, toDate, shortName,
  todayLocal, planOf, planLabel, assigneeLabel, upcoming, sectionItems, resolveRole, wordContext, birthCard, msUntilMidnight, hhmm} from './logic.js';
import {buildIcs, gcalUrl, calendarEvent, icsFileName} from './calendar.js';
import {dailyWord} from './words.js';
import {createBackGuard} from './history.js';
import {createNotifier, NOTIFY_NOTE} from './notify.js';
import {OFFLINE_TEXT, QUEUED_TEXT} from './offline.js';
import {MAX_FILES, photoFailText} from './photo.js';
import {errText} from './data.js';

export const DENIED_TEXT = 'このアプリは使えません';
export const PANELS = Object.freeze(['detail', 'editor', 'settings', 'setup', 'birth', 'viewer']);
// パネルごとの「← もどる」（上）と「とじる」（下）
export const PANEL_BUTTONS = Object.freeze({
  detail: ['d-back', 'd-close'], editor: ['e-back', 'e-cancel'], settings: ['s-back', 's-close'],
  setup: ['f-back', 'f-close'], birth: ['b-back', 'b-close'], viewer: ['v-back', 'v-close']
});
const SOON_OVERDUE_MAX = 3;
const NOTIFY_TICK_MS = 5 * 60 * 1000;

export function mountUI(document, opts = {}) {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const confirmFn = opts.confirm || (() => true);
  const nowFn = opts.now || (() => new Date());
  const today = opts.today || (() => todayLocal(nowFn()));
  const online = opts.isOnline || (() => true);
  const later = opts.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const focus = e => { if (e && typeof e.focus === 'function') { try { e.focus(); } catch { /* ignore */ } } };
  let store = null;
  let state = {auth: 'loading', items: [], photos: [], settings: null, family: null, familyLoaded: false, myHash: ''};
  let cat = 'すべて', tab = 'todo', query = '';
  const expanded = {later: false, undated: false, done: false};
  let detailId = null, editId = null, viewerId = null, chosenRole = null, setupShown = false;
  let netOnline = true, toastSeq = 0, lastDay = today();
  const opener = {};

  const settings = () => state.settings || {birthDate: null, dueDate: DUE_DATE};
  const family = () => state.family || null;
  const findItem = id => state.items.find(i => i.id === id) || null;
  const notifier = createNotifier({Notification: opts.Notification, storage: opts.storage, show: opts.showNotification});
  const guard = createBackGuard({history: opts.history, onBack: id => hidePanel(id), onExitAsk: showExit});

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

  // ---- panels（開く・閉じる・戻る） ----
  const CLEANUP = {
    detail: () => { detailId = null; },
    editor: () => { editId = null; },
    viewer: () => { viewerId = null; }
  };
  function showPanel(id, replaceFrom) {
    if (!$(id).hidden && guard.has(id)) return;
    if (replaceFrom && guard.has(replaceFrom)) {
      opener[id] = opener[replaceFrom];
      guard.replace(replaceFrom, id);
      $(replaceFrom).hidden = true;
      if (CLEANUP[replaceFrom] && replaceFrom !== id) CLEANUP[replaceFrom]();
    } else {
      opener[id] = document.activeElement || null;
      guard.open(id);
    }
    $(id).hidden = false;
    focus($(PANEL_BUTTONS[id][0]));
  }
  // 見た目だけ閉じる（戻る操作で閉じたとき）。
  function hidePanel(id) {
    const p = $(id);
    if (!p || p.hidden) return;
    p.hidden = true;
    if (CLEANUP[id]) CLEANUP[id]();
    focus(opener[id]);
    opener[id] = null;
  }
  // 画面のボタン・背景・Esc で閉じたとき。
  function closePanel(id) {
    const wasOpen = !$(id).hidden;
    hidePanel(id);
    guard.close(id);
    return wasOpen;
  }
  function closeTop() {
    const top = guard.top;
    if (top) return closePanel(top);
    for (const id of [...PANELS].reverse()) if (!$(id).hidden) return closePanel(id);
    return false;
  }
  function showExit() { $('exit-dialog').hidden = false; focus($('x-stay')); }
  function exitStay() { $('exit-dialog').hidden = true; guard.stay(); }
  function exitLeave() { $('exit-dialog').hidden = true; guard.leave(); }

  // ---- screens ----
  function renderScreens() {
    const a = state.auth;
    $('loading').hidden = a !== 'loading';
    $('login').hidden = !(a === 'signedOut' || a === 'denied' || a === 'error');
    $('app').hidden = a !== 'ready';
    $('login-msg').textContent = a === 'denied' ? DENIED_TEXT : (a === 'ready' ? '' : state.error || '');
    $('login-btn').disabled = false;
    if (a !== 'ready') { for (const id of PANELS) if (!$(id).hidden) closePanel(id); setupShown = false; }
  }
  function renderPill() {
    const off = !netOnline || (online() === false);
    const pill = $('offline-pill');
    pill.hidden = !off;
    pill.textContent = off ? OFFLINE_TEXT : '';
  }

  // ---- home cards ----
  function renderBirth() {
    const c = birthCard(settings(), today());
    $('birth-before').hidden = c.state !== 'before';
    $('birth-after').hidden = c.state !== 'after';
    $('birth-card').className = 'birth-card ' + (c.state === 'before' ? 'is-before' : 'is-after');
    if (c.state === 'before') {
      $('birth-due').textContent = '予定日 ' + c.due;
    } else {
      $('birth-days').textContent = c.day ? '生まれて ' + c.day + '日目' : c.date + ' 生まれ';
      $('birth-note').textContent = c.day ? '（生まれた日が1日目）' : '';
    }
  }
  function soonMeta(e) {
    const parts = [];
    if (e.time) parts.push(e.time);
    const who = assigneeLabel(e.assignee, family());
    if (who) parts.push(who);
    if (!e.planned) parts.push(e.kind === 'from' ? formatShort(e.date) + 'から' : formatShort(e.date) + 'まで');
    return parts.join('・');
  }
  function renderSoon() {
    const up = upcoming(state.items, settings(), today());
    const groups = [['期限切れ', up.overdue, 'overdue'], ['今日', up.today, 'today'], ['明日', up.tomorrow, 'tomorrow'], ['もうすぐ（3日以内）', up.soon, 'soon']];
    const nodes = [];
    for (const [label, list, key] of groups) {
      if (!list.length) continue;
      const g = el('div', 'soon-group is-' + key);
      g.append(el('h3', 'soon-head', label));
      const shown = key === 'overdue' ? list.slice(0, SOON_OVERDUE_MAX) : list;
      for (const e of shown) {
        const b = el('button', 'soon-item');
        b.type = 'button';
        b.setAttribute('data-id', e.id);
        b.append(el('span', 'soon-item-title', e.title));
        const meta = soonMeta(e);
        if (meta) b.append(el('span', 'soon-item-meta', meta));
        b.onclick = () => openDetail(e.id);
        g.append(b);
      }
      if (list.length > shown.length) g.append(el('p', 'small', 'ほか ' + (list.length - shown.length) + '件'));
      nodes.push(g);
    }
    $('soon-list').replaceChildren(...nodes);
    $('soon-empty').hidden = up.today.length + up.tomorrow.length + up.soon.length > 0;
    const st = notifier.status();
    const btn = $('notify-btn');
    btn.hidden = st === 'unsupported';
    btn.setAttribute('aria-pressed', String(notifier.enabled()));
    $('notify-note').textContent = st === 'unsupported' ? 'この端末では通知を使えません。「カレンダーに追加」を使ってください'
      : (st === 'denied' ? '通知が許可されていません。' : '') + NOTIFY_NOTE;
    return up;
  }
  function runNotify(up) {
    if (state.auth !== 'ready') return [];
    return notifier.check(up || upcoming(state.items, settings(), today()), today(), hhmm(nowFn()));
  }
  function myRole() { return resolveRole(family(), state.myHash).role; }
  function renderWord() {
    const role = myRole();
    $('word-setup').hidden = Boolean(role);
    $('word-title').textContent = role === 'husband' ? '今日の気づかい' : '今日のことば';
    $('word-text').textContent = role ? dailyWord(role, today(), wordContext(family(), settings(), today())) : '夫か妻かを選ぶと、毎日ちがうことばが出ます';
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
    const plan = item.done ? '' : planLabel(item, family());
    if (plan) meta.append(el('span', 'badge plan', plan));
    main.append(title, meta);
    li.append(check, main);
    return li;
  }
  function group(key, label, list, s, t) {
    const toggle = $(key + '-toggle'), box = $(key + '-list');
    const open = expanded[key] || Boolean(query.trim());
    toggle.textContent = label + ' ' + list.length;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.hidden = list.length === 0;
    box.hidden = !open || list.length === 0;
    box.replaceChildren(...(open ? list.map(i => row(i, s, t)) : []));
  }
  function renderTodo() {
    renderChips();
    const s = settings(), t = today();
    const g = sectionItems(state.items, s, t, {category: cat, query});
    $('todo-list').replaceChildren(...[...g.overdue, ...g.soon].map(i => row(i, s, t)));
    group('later', '先の予定', g.later, s, t);
    group('undated', '日付なし', g.undated, s, t);
    group('done', '完了', g.done, s, t);
    $('todo-empty').hidden = g.overdue.length + g.soon.length + g.later.length + g.undated.length > 0;
  }
  function toggleDone(id) {
    const it = findItem(id);
    if (!it || !store) return;
    track(store.setDone(id, !it.done));
  }

  // ---- detail ----
  function openDetail(id) { detailId = id; renderDetail(); showPanel('detail'); }
  function fillAssignee(sel, value) {
    const f = family();
    sel.replaceChildren(...[['', '未定'], ['husband', assigneeLabel('husband', f)], ['wife', assigneeLabel('wife', f)], ['both', assigneeLabel('both', f)]]
      .map(([v, t]) => { const o = el('option', '', t); o.value = v; return o; }));
    sel.value = value;
  }
  function renderDetail(keepInputs) {
    if (!detailId) return;
    const it = findItem(detailId);
    if (!it) { closePanel('detail'); return; }
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
    const p = planOf(it);
    if (!keepInputs) {
      $('d-memo').value = it.memo || '';
      $('d-plan-date').value = p.planDate || '';
      $('d-plan-time').value = p.planTime || '';
      $('d-plan-error').textContent = '';
    }
    fillAssignee($('d-assignee'), keepInputs ? $('d-assignee').value : (p.assignee || ''));
    const ev = calendarEvent(it, s, family());
    $('d-ics').hidden = !ev;
    const g = $('d-gcal');
    if (ev) { g.href = gcalUrl(ev); g.hidden = false; } else { g.hidden = true; g.removeAttribute('href'); }
    $('d-cal-note').textContent = ev ? '「カレンダーに追加」のファイルには、前の日 9:00 と当日 8:00 の通知が入っています。Googleカレンダーはいつもの通知になります'
      : '日付を入れると、カレンダーに追加できます';
    const link = $('d-link');
    if (it.sourceUrl && /^https:\/\//.test(it.sourceUrl)) { link.href = it.sourceUrl; link.hidden = false; }
    else { link.hidden = true; link.removeAttribute('href'); }
    $('d-done').textContent = it.done ? '完了を取り消す' : '完了にする';
    $('d-done').setAttribute('aria-pressed', String(Boolean(it.done)));
    $('d-done-by').textContent = doneLabel(it);
  }
  function savePlan() {
    const it = findItem(detailId);
    if (!it || !store) return;
    const res = store.setPlan(it.id, {planDate: $('d-plan-date').value, planTime: $('d-plan-time').value, assignee: $('d-assignee').value});
    if (!res.ok) { $('d-plan-error').textContent = res.errors[0]; return; }
    $('d-plan-error').textContent = '';
    track(res.write);
    toast('保存しました');
  }
  function downloadIcs() {
    const it = findItem(detailId);
    if (!it) return;
    const ev = calendarEvent(it, settings(), family());
    if (!ev || typeof opts.download !== 'function') return;
    opts.download(buildIcs(ev, nowFn()), icsFileName(ev.title));
  }

  // ---- editor ----
  function openEditor(id, fromDetail) {
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
    showPanel('editor', fromDetail ? 'detail' : null);
    editId = id || null;
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
    closePanel('editor');
  }

  // ---- settings / family / birth ----
  function openSettings() {
    const s = settings();
    $('s-due').textContent = s.birthDate ? '出生日 ' + formatShort(s.birthDate) : '予定日 ' + formatShort(s.dueDate || DUE_DATE) + '（出生日が未入力なら予定日で計算）';
    showPanel('settings');
  }
  function setRoleButtons() {
    $('f-role-husband').setAttribute('aria-pressed', String(chosenRole === 'husband'));
    $('f-role-wife').setAttribute('aria-pressed', String(chosenRole === 'wife'));
  }
  function openSetup() {
    const f = family() || {};
    $('f-husband').value = f.husbandName || '';
    $('f-wife').value = f.wifeName || '';
    $('f-big').value = f.bigName || '';
    $('f-bignote').value = f.bigNote || '';
    $('f-baby').value = f.babyName || '';
    chosenRole = myRole();
    setRoleButtons();
    $('f-error').textContent = '';
    setupShown = true;
    showPanel('setup');
  }
  function saveSetup() {
    if (!store) return;
    const res = store.saveFamily({husbandName: $('f-husband').value, wifeName: $('f-wife').value, bigName: $('f-big').value,
      bigNote: $('f-bignote').value, babyName: $('f-baby').value, role: chosenRole});
    if (!res.ok) { $('f-error').textContent = res.errors[0]; return; }
    track(res.write);
    closePanel('setup');
  }
  function openBirth() {
    const s = settings();
    $('b-date').value = s.birthDate || '';
    $('b-time').value = s.birthTime || '';
    $('b-date').setAttribute('max', today() || '2028-12-31');
    $('b-error').textContent = '';
    showPanel('birth');
  }
  function saveBirth(date, time) {
    if (!store) return;
    const res = store.setBirth(date, time, today());
    if (!res.ok) { $('b-error').textContent = res.errors[0]; return; }
    track(res.write);
    closePanel('birth');
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
    showPanel('viewer');
    store.loadFull(id).then(data => { if (viewerId === id && data) $('v-img').src = data; }).catch(() => {});
  }
  async function addPhotos(files) {
    if (!store || !opts.preparePhoto) return;
    const list = Array.from(files || []).slice(0, MAX_FILES);
    const status = $('photo-status');
    let decodeFails = 0, otherFails = 0;
    for (let i = 0; i < list.length; i++) {
      status.textContent = '準備中 ' + (i + 1) + '/' + list.length;
      try { track(store.addPhoto(await opts.preparePhoto(list[i])).write); } catch (e) { if (e && e.code === 'decode') decodeFails++; else otherFails++; }
    }
    status.textContent = photoFailText(decodeFails, otherFails);
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
    renderBirth();
    const up = renderSoon();
    renderWord();
    renderTodo();
    renderPhotos();
    renderDetail(true);
    if (viewerId && !state.photos.some(p => p.id === viewerId)) closePanel('viewer');
    if (editId && !findItem(editId)) closePanel('editor');
    // 初回：家族の設定が無い、またはこのアカウントの役割が分からないとき、1回だけ開く。
    if (!setupShown && state.familyLoaded && (!state.family || !myRole())) openSetup();
    runNotify(up);
  }

  // 日付が変わったら作り直す（0:00 のタイマー・画面に戻ったとき）。
  function refreshDay() {
    const t = today();
    if (t !== lastDay) { lastDay = t; render(); return true; }
    runNotify();
    return false;
  }
  function scheduleMidnight() { later(() => { refreshDay(); scheduleMidnight(); }, msUntilMidnight(nowFn()) + 1000); }
  function scheduleNotifyTick() { later(() => { if (notifier.enabled()) runNotify(); scheduleNotifyTick(); }, NOTIFY_TICK_MS); }

  // ---- wiring ----
  $('login-btn').onclick = () => { if (store) { $('login-btn').disabled = true; store.signIn().finally(() => { $('login-btn').disabled = false; }); } };
  $('gear').onclick = openSettings;
  $('tab-btn-todo').onclick = () => { tab = 'todo'; renderTab(); };
  $('tab-btn-photos').onclick = () => { tab = 'photos'; renderTab(); };
  for (const key of ['later', 'undated', 'done']) $(key + '-toggle').onclick = () => { expanded[key] = !expanded[key]; renderTodo(); };
  $('q').oninput = () => { query = $('q').value || ''; renderTodo(); };
  $('add-btn').onclick = () => openEditor(null);
  $('birth-before').onclick = openBirth;
  $('birth-change').onclick = openBirth;
  $('word-setup').onclick = openSetup;
  $('notify-btn').onclick = async () => {
    if (notifier.enabled()) notifier.disable();
    else {
      const r = await notifier.enable();
      if (r === 'denied') toast('通知が許可されていません');
      else if (r === 'unsupported') toast('この端末では通知を使えません');
    }
    if (state.auth === 'ready') runNotify(renderSoon());
  };
  for (const id of PANELS) {
    const [back, close] = PANEL_BUTTONS[id];
    $(back).onclick = () => closePanel(id);
    $(close).onclick = () => closePanel(id);
    $(id).onclick = e => { if (e && e.target === $(id)) closePanel(id); };
  }
  $('d-done').onclick = () => { if (detailId) toggleDone(detailId); };
  $('d-edit').onclick = () => { if (detailId) openEditor(detailId, true); };
  $('d-delete').onclick = () => {
    const it = findItem(detailId);
    if (!it || !store || !confirmFn('「' + it.title + '」を削除しますか？')) return;
    track(store.deleteItem(it.id));
    closePanel('detail');
  };
  $('d-memo-save').onclick = () => {
    const it = findItem(detailId);
    if (!it || !store) return;
    const res = store.setMemo(it.id, $('d-memo').value, it);
    if (!res.ok) { toast(res.errors[0]); return; }
    track(res.write);
    toast('保存しました');
  };
  $('d-plan-save').onclick = savePlan;
  $('d-ics').onclick = downloadIcs;
  $('e-save').onclick = saveEditor;
  $('s-family').onclick = openSetup;
  $('s-birth-open').onclick = openBirth;
  $('s-logout').onclick = () => { closePanel('settings'); if (store) store.signOut().catch(() => {}); };
  $('f-role-husband').onclick = () => { chosenRole = 'husband'; setRoleButtons(); };
  $('f-role-wife').onclick = () => { chosenRole = 'wife'; setRoleButtons(); };
  $('f-save').onclick = saveSetup;
  $('b-save').onclick = () => saveBirth($('b-date').value || null, $('b-time').value || null);
  $('b-clear').onclick = () => saveBirth(null, null);
  $('photo-input').onchange = () => { const input = $('photo-input'); const files = Array.from(input.files || []); input.value = ''; return addPhotos(files); };
  $('v-delete').onclick = () => {
    if (!viewerId || !store || !confirmFn('この写真を削除しますか？')) return;
    track(store.deletePhoto(viewerId));
    closePanel('viewer');
  };
  $('x-stay').onclick = exitStay;
  $('x-leave').onclick = exitLeave;
  $('exit-dialog').onclick = e => { if (e && e.target === $('exit-dialog')) exitStay(); };
  function onKey(e) {
    if (!e || e.key !== 'Escape') return;
    if (!$('exit-dialog').hidden) { exitStay(); return; }
    if (closeTop() && typeof e.preventDefault === 'function') e.preventDefault();
  }
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'hidden') refreshDay(); });
  }

  guard.start();
  scheduleMidnight();
  scheduleNotifyTick();
  render();
  return {
    attach(s) { store = s; return s.subscribe(render); },
    render,
    setOnline(v) { netOnline = v; renderPill(); },
    toast,
    refreshDay,
    onKey,
    guard,
    notifier,
    get openDetailId() { return detailId; }
  };
}
