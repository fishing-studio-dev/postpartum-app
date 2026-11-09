// 画面。DOM は createElement / textContent だけで作る（HTML 文字列は使わない）。
// R9：下の5つのタブ（きょう／1週間／まだ未定／やること／アルバム・設定）。1つのタブに1つの画面。
import {CATEGORIES, DUE_DATE, itemDate, computeDue, conditionLabel, isOverdue, doneLabel, formatShort, formatMD, toDate, shortName,
  todayLocal, planOf, assigneeLabel, resolveRole, wordContext, birthCard, msUntilMidnight, hhmm, upcoming, addDays, isValidDate,
  deadlineLabel, planWhenLabel, assigneeText, stateText, todayGroups, attentionItems, weekDays, WEEKDAY, dayEntries,
  REASON_TEXT, undecidedItems, undecidedReason, todoSections, PERIOD_TEXT, SOON_AHEAD, formatMonthDay, isNoPlan, NO_PLAN_TEXT} from './logic.js';
import {buildIcs, gcalUrl, calendarEvent, icsFileName} from './calendar.js';
import {dailyWord, wordPool, WORD_TITLE} from './words.js';
import {createBackGuard} from './history.js';
import {createNotifier, NOTIFY_NOTE} from './notify.js';
import {OFFLINE_TEXT, QUEUED_TEXT} from './offline.js';
import {MAX_FILES, photoFailText} from './photo.js';
import {errText} from './data.js';
import {CHARACTERS, getCharacter} from './chars/registry.js';
import {createMotion} from './motion.js';
import {resolvePrefs, readLocalPrefs, writeLocalPrefs, cleanPrefs} from './prefs.js';

export const DENIED_TEXT = 'このアプリは使えません';
export const TABS = Object.freeze(['today', 'week', 'undecided', 'todo', 'more']);
export const TAB_LABELS = Object.freeze({today: 'きょう', week: '1週間', undecided: 'まだ未定', todo: 'やること', more: 'アルバム・設定'});
export const PANELS = Object.freeze(['detail', 'planner', 'editor', 'setup', 'birth', 'viewer']);
// パネルごとの「← もどる」（上）と「とじる」（下）
export const PANEL_BUTTONS = Object.freeze({
  detail: ['d-back', 'd-close'], planner: ['p-back', 'p-close'], editor: ['e-back', 'e-cancel'],
  setup: ['f-back', 'f-close'], birth: ['b-back', 'b-close'], viewer: ['v-back', 'v-close']
});
// 保存の表示。「保存しました」は Firestore の書き込みが終わった（Promise が解決した）後だけ。
export const SAVE_TEXT = Object.freeze({
  saving: '保存中…',
  saved: '保存しました',
  queued: 'つながったら保存します',
  failed: '保存できませんでした。入力はそのまま残っています。もう一度「保存」を押してください',
  unchanged: '変更はありません'
});
// R9.1：「予定は不要」の印（項目の画面のボタンと、まだ未定の各行のボタン）
export const NOPLAN = Object.freeze({
  on: '予定は不要にする',
  off: '予定は不要を外す',
  note: '印を付けると『まだ未定』に出なくなり、通知とカレンダー追加の対象から外れます。期限が近い・過ぎたときは『きょう』に出ます。外せば元に戻ります',
  calNote: '『予定は不要』の印があるので、カレンダーには追加しません（印を外すと追加できます）',
  rowBtn: '予定は不要',
  toastRow: '『予定は不要』にしました（やることで外せます）',
  toastOn: '『予定は不要』にしました',
  toastOff: '『予定は不要』を外しました',
  failed: '保存できませんでした。印は変わっていません。もう一度押してください'
});
export const NOTIFY_LINE = 'お知らせ：アプリを開いている間のみ';
export const GROUP_MAX = 3;
export const ATTENTION_FIRST = 2;
export const MOTION_NOTE = Object.freeze({
  standard: 'キャラクターは、きょうを開いたときや触れたときなどに1回だけ動いて、止まります',
  reduce: 'キャラクターは動きません（止まった絵のまま）。画面の動きも少なくします',
  stop: 'キャラクターも画面の動きも、すべて止めます',
  os: 'この端末は「動きを減らす」設定なので、キャラクターは止まった絵のままです'
});
const NOTIFY_TICK_MS = 5 * 60 * 1000;
const FORM_FIELDS = Object.freeze({
  editor: ['e-title', 'e-date', 'e-category', 'e-place', 'e-docs', 'e-memo', 'e-link'],
  setup: ['f-husband', 'f-wife', 'f-big', 'f-bignote', 'f-baby'],
  birth: ['b-date', 'b-time']
});

export function mountUI(document, opts = {}) {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (cls, text, onclick) => { const b = el('button', cls, text); b.type = 'button'; if (onclick) b.onclick = onclick; return b; };
  const confirmFn = opts.confirm || (() => true);
  const nowFn = opts.now || (() => new Date());
  const today = opts.today || (() => todayLocal(nowFn()));
  const online = opts.isOnline || (() => true);
  const later = opts.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const focus = e => { if (e && typeof e.focus === 'function') { try { e.focus(); } catch { /* ignore */ } } };
  let store = null;
  let state = {auth: 'loading', items: [], photos: [], settings: null, family: null, familyLoaded: false, myHash: '', prefs: null};
  let tab = 'today', morePane = 'album';
  let cat = 'すべて', query = '', todoView = 'all';
  const expanded = {todo: true, later: false, undated: false, done: false};
  let attentionAll = false, wordFull = false;
  let weekStart = today(), weekSel = weekStart, weekFollow = true, weekFilter = null;
  let detailId = null, editId = null, viewerId = null, plannerId = null, chosenRole = null, setupShown = false;
  let netOnline = true, toastSeq = 0, lastDay = today();
  let charListBuilt = false, charaInView = true, discardThen = null, discardKeep = null;
  const opener = {};
  const baselines = {};
  const saveSeq = {};
  const drafts = {};
  let saveErrors = [];
  let localPrefs = readLocalPrefs(opts.storage);
  let prefOverride = {};
  let prefs = resolvePrefs(localPrefs, null);

  const settings = () => state.settings || {birthDate: null, dueDate: DUE_DATE};
  const family = () => state.family || null;
  const findItem = id => state.items.find(i => i.id === id) || null;
  const isOffline = () => !netOnline || online() === false;
  const notifier = createNotifier({Notification: opts.Notification, storage: opts.storage, show: opts.showNotification});
  const motion = opts.motion || createMotion({setTimeout: opts.setTimeout, clearTimeout: opts.clearTimeout, matchMedia: opts.matchMedia, document, now: opts.clock});
  const guard = createBackGuard({history: opts.history, onBack, onExitAsk: showExit});
  const currentChar = () => getCharacter(prefs.character);

  function toast(text) {
    const t = $('toast');
    t.textContent = text; t.hidden = !text;
    const seq = ++toastSeq;
    if (text) later(() => { if (seq === toastSeq) { t.hidden = true; t.textContent = ''; } }, 3000);
  }
  // すぐ保存するもの（済みのチェック・写真・削除）：失敗だけ知らせる。つながっていなければ「つながったら保存します」。
  function track(write, title) {
    if (isOffline()) toast(QUEUED_TEXT);
    if (write && typeof write.catch === 'function') write.catch(e => { toast(errText(e)); addSaveError('quick:' + Date.now(), title || '', errText(e)); });
  }
  function addSaveError(key, title, text) {
    saveErrors = [...saveErrors.filter(e => e.key !== key), {key, title: title || '', text: text || SAVE_TEXT.failed}];
    if (state.auth === 'ready') renderAttention();
  }
  function clearSaveError(key) {
    const n = saveErrors.length;
    saveErrors = saveErrors.filter(e => e.key !== key);
    if (n !== saveErrors.length && state.auth === 'ready') renderAttention();
  }
  // 「保存」ボタンの共通処理。key ごとに番号を振り、古い結果は表示しない（後から古い成功を出さない）。
  //   o.statusId：状態を出す要素、o.isCurrent()：まだ同じ画面か、o.onOk / o.onFail、o.panel：成功したら閉じるパネル
  //   o.failText：失敗の文（省略時は SAVE_TEXT.failed）、o.reportFail：画面が開いたままでも失敗を「確認が必要なこと」に出す（R9.1）
  function submit(key, write, o = {}) {
    const seq = (saveSeq[key] = (saveSeq[key] || 0) + 1);
    const status = $(o.statusId);
    const current = () => seq === saveSeq[key] && (!o.isCurrent || o.isCurrent());
    const show = (text, cls) => { if (status && current()) { status.textContent = text; status.className = 'save-status is-' + cls; } };
    const queued = isOffline();
    show(queued ? SAVE_TEXT.queued : SAVE_TEXT.saving, queued ? 'queued' : 'saving');
    // つながっていないとき：Firestore が端末に順番待ちで残し、つながったら送る。パネルは閉じてよい（入力は失われない）。
    if (queued && o.panel) { forceClose(o.panel); toast(QUEUED_TEXT); }
    Promise.resolve(write).then(() => {
      if (seq !== saveSeq[key]) return;
      clearSaveError(key);
      show(SAVE_TEXT.saved, 'saved');
      if (o.onOk) o.onOk();
      if (o.panel && !$(o.panel).hidden && (!o.isCurrent || o.isCurrent())) { forceClose(o.panel); toast(SAVE_TEXT.saved); }
      playSaved();
    }, e => {
      if (seq !== saveSeq[key]) return;
      const failText = o.failText || SAVE_TEXT.failed;
      show(failText, 'failed');
      if (o.onFail) o.onFail(e);
      const stillOpen = o.panel ? !$(o.panel).hidden && (!o.isCurrent || o.isCurrent()) : (!o.isCurrent || o.isCurrent());
      if (!stillOpen || o.reportFail) { addSaveError(key, o.title, failText); toast('保存できませんでした：' + (o.title || '')); }
    });
  }
  function playSaved() { motion.play($('chara-wrap'), 'saved', currentChar()); }

  // ---- panels（開く・閉じる・戻る・保存していない入力の確認） ----
  const CLEANUP = {
    detail: () => { detailId = null; },
    editor: () => { editId = null; },
    viewer: () => { viewerId = null; },
    planner: () => { plannerId = null; }
  };
  const anyPanelOpen = () => PANELS.some(id => !$(id).hidden);
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
    motion.block('panel', true);
    focus($(PANEL_BUTTONS[id][0]));
  }
  // 見た目だけ閉じる（戻る操作で閉じたとき）。
  function hidePanel(id) {
    const p = $(id);
    if (!p || p.hidden) return;
    p.hidden = true;
    if (CLEANUP[id]) CLEANUP[id]();
    if (!anyPanelOpen()) motion.block('panel', false);
    focus(opener[id]);
    opener[id] = null;
  }
  // 確認なしで閉じる（保存できた・削除した・ログアウトなど）。
  function forceClose(id) {
    const wasOpen = !$(id).hidden;
    hidePanel(id);
    guard.close(id);
    return wasOpen;
  }
  // 画面のボタン・背景・Esc で閉じるとき。保存していない入力があれば先に聞く。
  function requestClose(id) {
    if ($(id).hidden) { guard.close(id); return false; }
    if (isDirty(id)) { askDiscard(() => { if (id === 'detail') delete drafts[detailId]; forceClose(id); }); return false; }
    return forceClose(id);
  }
  // Android の戻る（popstate）。false を返すと history.js がパネルを残して履歴を積み直す。
  function onBack(id) {
    if (!$(id).hidden && isDirty(id)) {
      if ($('discard-dialog').hidden) askDiscard(() => forceClose(id));
      return false;
    }
    hidePanel(id);
    return true;
  }
  function closeTop() {
    const top = guard.top;
    if (top) return requestClose(top);
    for (const id of [...PANELS].reverse()) if (!$(id).hidden) return requestClose(id);
    return false;
  }
  function askDiscard(then, keep) {
    discardThen = then; discardKeep = keep || null;
    $('discard-dialog').hidden = false;
    focus($('dc-keep'));
  }
  function discardChoice(leave) {
    $('discard-dialog').hidden = true;
    const fn = leave ? discardThen : discardKeep;
    discardThen = null; discardKeep = null;
    if (fn) fn();
  }
  function showExit() { $('exit-dialog').hidden = false; focus($('x-stay')); }
  function exitStay() { $('exit-dialog').hidden = true; guard.stay(); }
  function exitLeave() {
    $('exit-dialog').hidden = true;
    if (anyDirty()) { askDiscard(() => guard.leave(), () => guard.stay()); return; }
    guard.leave();
  }

  // ---- 保存していない入力 ----
  const val = id => String($(id).value == null ? '' : $(id).value);
  function formValues(id) {
    const v = {};
    for (const f of FORM_FIELDS[id] || []) v[f] = val(f);
    if (id === 'setup') v.role = chosenRole || '';
    return v;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function planInputs(prefix) {
    return prefix === 'd' ? {planDate: val('d-plan-date'), planTime: val('d-plan-time'), assignee: val('d-assignee')}
      : {planDate: val('p-date'), planTime: val('p-time'), assignee: val('p-assignee')};
  }
  function planFromItem(it) { const p = planOf(it); return {planDate: p.planDate || '', planTime: p.planTime || '', assignee: p.assignee || ''}; }
  function isDirty(id) {
    if ($(id).hidden) return false;
    if (id === 'detail') {
      const it = findItem(detailId);
      if (!it) return false;
      return val('d-memo') !== (it.memo || '') || !same(planInputs('d'), planFromItem(it));
    }
    if (id === 'planner') {
      const it = findItem(plannerId);
      return Boolean(it) && !same(planInputs('p'), planFromItem(it));
    }
    if (FORM_FIELDS[id]) return Boolean(baselines[id]) && !same(formValues(id), baselines[id]);
    return false;
  }
  const anyDirty = () => PANELS.some(isDirty);

  // ---- screens ----
  function renderScreens() {
    const a = state.auth;
    $('loading').hidden = a !== 'loading';
    $('login').hidden = !(a === 'signedOut' || a === 'denied' || a === 'error');
    $('app').hidden = a !== 'ready';
    $('login-msg').textContent = a === 'denied' ? DENIED_TEXT : (a === 'ready' ? '' : state.error || '');
    $('login-btn').disabled = false;
    if (a !== 'ready') { for (const id of PANELS) if (!$(id).hidden) forceClose(id); setupShown = false; $('discard-dialog').hidden = true; }
  }
  function renderPill() {
    const off = isOffline();
    const pill = $('offline-pill');
    pill.hidden = !off;
    pill.textContent = off ? OFFLINE_TEXT : '';
  }
  function renderTabs() {
    for (const t of TABS) {
      $('tab-' + t).hidden = tab !== t;
      $('tab-btn-' + t).setAttribute('aria-selected', String(tab === t));
    }
    $('pane-album').hidden = morePane !== 'album';
    $('pane-settings').hidden = morePane !== 'settings';
    $('more-album').setAttribute('aria-pressed', String(morePane === 'album'));
    $('more-settings').setAttribute('aria-pressed', String(morePane === 'settings'));
    motion.setVisible(tab === 'today' && charaInView);
  }
  function setTab(t, o = {}) {
    if (!TABS.includes(t)) return;
    tab = t;
    if (o.pane) morePane = o.pane;
    renderTabs();
    if (t === 'more' && morePane === 'settings') renderSettings();
    if (t === 'today') maybeWelcome();
  }
  function maybeWelcome() { if (state.auth === 'ready' && tab === 'today') motion.welcome($('chara-wrap'), currentChar(), today()); }

  // ---- 共通：予定の行（題名・予定日時・期限・担当・未完了／済み） ----
  function agendaRow(item, o = {}) {
    const b = btn('agenda-row' + (item.done ? ' is-done' : ''), null, () => openDetail(item.id));
    b.setAttribute('data-id', item.id);
    if (o.time) b.append(el('span', 'ag-time', o.time));
    b.append(el('span', 'ag-title', item.title));
    const meta = el('span', 'ag-meta');
    meta.append(el('span', 'ag-plan', planWhenLabel(item)));
    meta.append(el('span', 'ag-deadline', deadlineLabel(item, settings()) || '締切 なし'));
    meta.append(el('span', 'ag-who', assigneeText(item, family())));
    meta.append(el('span', 'badge state ' + (item.done ? 'is-done' : 'is-open'), stateText(item)));
    if (isNoPlan(item)) meta.append(el('span', 'badge noplan', NO_PLAN_TEXT));
    b.append(meta);
    return b;
  }

  // ---- きょう ----
  function myRoleInfo() { return resolveRole(family(), state.myHash); }
  function myRole() { return myRoleInfo().role; }
  function renderTodayHead() {
    $('today-date').textContent = formatShort(today());
    const r = myRole();
    $('role-label').textContent = r === 'wife' ? '妻のアカウント' : r === 'husband' ? '夫のアカウント' : '夫か妻か まだ選んでいません';
  }
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
  function attentionEntries() {
    const errs = saveErrors.map(e => ({kind: 'error', key: e.key, title: e.title, text: e.text}));
    return [...errs, ...attentionItems(state.items, settings(), today())];
  }
  function renderAttention() {
    const list = attentionEntries();
    $('attention').hidden = list.length === 0;
    $('attention-title').textContent = '確認が必要なこと（' + list.length + '件）';
    const shown = attentionAll ? list : list.slice(0, ATTENTION_FIRST);
    $('attention-list').replaceChildren(...shown.map(e => {
      const li = el('li', 'att-row is-' + e.kind);
      if (e.kind === 'error') {
        li.append(el('span', 'badge att-badge is-error', '保存できませんでした'));
        li.append(el('span', 'att-title', e.title || '変更'));
        li.append(btn('soft-btn small-btn', '確認しました', () => clearSaveError(e.key)));
        return li;
      }
      const b = btn('att-main', null, () => openDetail(e.item.id));
      b.setAttribute('data-id', e.item.id);
      b.append(el('span', 'badge att-badge is-' + e.kind, e.kind === 'overdue' ? '締切を過ぎています' : '締切が近い'));
      b.append(el('span', 'att-title', e.item.title));
      b.append(el('span', 'att-date', deadlineLabel(e.item, settings())));
      if (isNoPlan(e.item)) b.append(el('span', 'badge noplan', NO_PLAN_TEXT));   // R9.2
      li.append(b);
      return li;
    }));
    const more = $('attention-more');
    more.hidden = list.length <= ATTENTION_FIRST;
    more.textContent = attentionAll ? '最初の' + ATTENTION_FIRST + '件だけ表示' : 'すべて見る（' + list.length + '件）';
    more.setAttribute('aria-expanded', String(attentionAll));
  }
  function renderWord() {
    const role = myRole();
    $('word-setup').hidden = Boolean(role);
    $('word-title').textContent = role === 'husband' ? WORD_TITLE.husband : WORD_TITLE.wife;
    const pool = wordPool(role, settings(), today());
    const text = role ? dailyWord(pool, today(), wordContext(family(), settings(), today())) : '夫か妻かを選ぶと、毎日ちがうことばが出ます';
    $('word-text').textContent = text;
    $('word-text').className = 'word-text' + (wordFull ? '' : ' is-clamped');
    $('word-full').hidden = !role;
    $('word-full').textContent = wordFull ? '短く表示' : '全文';
    $('word-full').setAttribute('aria-expanded', String(wordFull));
    // 動かさない設定のときは「ひと休み」ボタンを出さない（押しても何も起きないため）。
    $('chara-rest').hidden = prefs.motion !== 'standard' || motion.reducedOS();
  }
  function renderChara() {
    const c = currentChar();
    const img = $('chara-img');
    // 選んだ1体の画像だけを読み込む（src は実行時に入れる）。
    if (img.getAttribute('data-char') !== c.id) { img.src = c.src; img.setAttribute('data-char', c.id); }
    $('chara-wrap').setAttribute('data-char', c.id);
    $('app').setAttribute('data-motion-mode', prefs.motion);
  }
  function renderDayGroups() {
    const t = today();
    const g = todayGroups(state.items, settings(), t);
    const defs = [
      ['today', '今日', g.today, '今日の予定は登録されていません', t],
      ['tomorrow', '明日', g.tomorrow, '明日の予定は登録されていません', addDays(t, 1)],
      ['soon', 'もうすぐ（' + SOON_AHEAD + '日以内）', g.soon, 'もうすぐの予定は登録されていません', addDays(t, 2)]
    ];
    $('day-groups').replaceChildren(...defs.map(([key, label, list, empty, date]) => {
      const box = el('div', 'day-group is-' + key);
      box.setAttribute('data-group', key);
      box.append(el('h4', 'day-group-head', label + '（' + list.length + '件）'));
      if (!list.length) box.append(el('p', 'empty-text', empty));
      for (const e of list.slice(0, GROUP_MAX)) box.append(agendaRow(e.item, {time: e.time || ''}));
      if (list.length > GROUP_MAX) box.append(btn('link-more', 'ほか ' + (list.length - GROUP_MAX) + '件を1週間で見る', () => goWeek(date)));
      return box;
    }));
    return g;
  }
  function renderNotifyLine() {
    $('notify-line').textContent = NOTIFY_LINE + (notifier.enabled() ? '（いまはオン）' : '（いまはオフ）');
  }
  function runNotify() {
    if (state.auth !== 'ready') return [];
    return notifier.check(upcoming(state.items, settings(), today()), today(), hhmm(nowFn()));
  }

  // ---- 1週間 ----
  function goWeek(date) {
    if (isValidDate(date)) { weekStart = date; weekSel = date; weekFollow = date === today(); }
    renderWeek();
    setTab('week');
  }
  function renderWeek() {
    const t = today();
    if (weekFollow) { weekStart = t; if (!weekSel || weekSel < t || weekSel > addDays(t, 6)) weekSel = t; }
    const days = weekDays(weekStart);
    if (!days.includes(weekSel)) weekSel = days[0];
    $('w-date').value = weekSel;
    $('w-strip').replaceChildren(...days.map(d => {
      const n = dayEntries(state.items, settings(), d, weekFilter).count;
      const li = el('li', 'day-cell-li');
      const sel = d === weekSel;
      const b = btn('day-cell' + (sel ? ' is-selected' : '') + (d === t ? ' is-today' : ''), null, () => { weekSel = d; renderWeek(); });
      b.setAttribute('data-date', d);
      b.setAttribute('aria-pressed', String(sel));
      b.append(el('span', 'dc-date', formatMonthDay(d)));
      b.append(el('span', 'dc-wd', '(' + WEEKDAY(d) + ')'));
      b.append(el('span', 'dc-count', n + '件'));
      if (d === t) b.append(el('span', 'dc-mark', '今日'));
      if (sel) b.append(el('span', 'dc-sel', '選択中'));
      li.append(b);
      return li;
    }));
    for (const f of ['husband', 'wife', 'both']) $('wf-' + f).setAttribute('aria-pressed', String(weekFilter === f));
    $('w-filter-bar').hidden = !weekFilter;
    $('w-filter-state').textContent = weekFilter ? '絞り込み中：担当が「' + {husband: '夫', wife: '妻', both: '2人'}[weekFilter] + '」の項目だけ' : '';
    $('w-day-title').textContent = formatShort(weekSel) + (weekSel === t ? '（今日）' : '') + 'の予定';
    const e = dayEntries(state.items, settings(), weekSel, weekFilter);
    const nodes = [];
    if (!e.timed.length && !e.untimed.length) nodes.push(el('p', 'empty-text', 'この日の予定は登録されていません'));
    if (e.timed.length) {
      const g = el('div', 'day-sec is-timed');
      g.append(el('h4', 'day-sec-head', '時刻が決まっている予定'));
      for (const x of e.timed) g.append(agendaRow(x.item, {time: x.time}));
      nodes.push(g);
    }
    if (e.untimed.length) {
      const g = el('div', 'day-sec is-untimed');
      g.append(el('h4', 'day-sec-head', '時刻未定'));
      for (const x of e.untimed) g.append(agendaRow(x.item));
      nodes.push(g);
    }
    if (e.deadlines.length) {
      const g = el('div', 'day-sec is-deadline');
      g.append(el('h4', 'day-sec-head', '締切'));
      g.append(el('p', 'small', '予定ではありません。この日が期限（または開始日）の項目です'));
      for (const x of e.deadlines) g.append(agendaRow(x.item));
      nodes.push(g);
    }
    $('w-day').replaceChildren(...nodes);
  }

  // ---- まだ未定 ----
  function renderUndecided() {
    const list = undecidedItems(state.items, settings());
    $('u-count').textContent = list.length + '件（期限の近い順、期限なしは最後）';
    $('u-empty').hidden = list.length > 0;
    $('u-list').replaceChildren(...list.map(({item, reason}) => {
      const li = el('li', 'u-row');
      li.setAttribute('data-id', item.id);
      const main = btn('u-main', null, () => openDetail(item.id));
      main.append(el('span', 'u-title', item.title));
      const meta = el('span', 'ag-meta');
      meta.append(el('span', 'reason-chip is-' + reason, REASON_TEXT[reason]));
      meta.append(el('span', 'ag-deadline', deadlineLabel(item, settings()) || '締切 なし'));
      const p = planOf(item);
      if (p.planDate) meta.append(el('span', 'ag-plan', planWhenLabel(item)));
      if (p.assignee) meta.append(el('span', 'ag-who', assigneeText(item, family())));
      main.append(meta);
      // R9.1：「決める」の隣に「予定は不要」。押すと印を付ける（行は、印が付いたデータが届いたときに消える）。
      const np = btn('soft-btn noplan-row-btn', NOPLAN.rowBtn, () => setNoPlan(item.id, true, 'row'));
      np.setAttribute('aria-label', '「' + item.title + '」を' + NOPLAN.on);
      if (rowBusy.has(item.id)) np.disabled = true;
      li.append(main, btn('soft-btn decide-btn', '決める', () => openPlanner(item.id)), np);
      return li;
    }));
  }

  // ---- R9.1：「予定は不要」の印 ----
  // 保存の流れは submit()（保存中… → 書き込みが終わってから 保存しました／失敗は「確認が必要なこと」にも出す）。
  // from: 'row'（まだ未定の行）| 'detail'（項目の画面）
  const rowBusy = new Set();
  function setNoPlan(id, on, from) {
    const it = findItem(id);
    if (!it || !store) return;
    if (from === 'row' && rowBusy.has(id)) return;
    let write;
    try { write = store.setNoPlanNeeded(id, on); } catch (e) { write = Promise.reject(e); }
    const fromRow = from === 'row';
    if (fromRow) { rowBusy.add(id); renderUndecided(); }
    if (isOffline()) toast(QUEUED_TEXT);
    const title = it.title;
    submit('noplan:' + id, write, {
      statusId: fromRow ? 'u-status' : 'd-noplan-status',
      title, failText: NOPLAN.failed, reportFail: true,
      isCurrent: fromRow ? () => tab === 'undecided' : () => detailId === id && !$('detail').hidden,
      onOk: () => toast(on ? (fromRow ? NOPLAN.toastRow : NOPLAN.toastOn) : NOPLAN.toastOff)
    });
    if (fromRow) Promise.resolve(write).catch(() => {}).then(() => { rowBusy.delete(id); if (state.auth === 'ready') renderUndecided(); });
  }
  function openPlanner(id) {
    const it = findItem(id);
    if (!it) return;
    plannerId = id;
    $('p-title').textContent = it.title;
    const reason = undecidedReason(it);
    $('p-reason').textContent = reason ? REASON_TEXT[reason] : '決まっています';
    $('p-deadline').textContent = deadlineLabel(it, settings()) || '締切 なし';
    const p = planFromItem(it);
    $('p-date').value = p.planDate; $('p-time').value = p.planTime;
    fillAssignee($('p-assignee'), p.assignee);
    $('p-error').textContent = ''; $('p-status').textContent = '';
    showPanel('planner');
  }
  function savePlanner() {
    const it = findItem(plannerId);
    if (!it || !store) return;
    const res = store.setPlan(it.id, planInputs('p'));
    if (!res.ok) { $('p-error').textContent = res.errors[0]; return; }
    $('p-error').textContent = '';
    const id = it.id;
    submit('plan:' + id, res.write, {statusId: 'p-status', panel: 'planner', title: it.title, isCurrent: () => plannerId === id});
  }

  // ---- やること ----
  function renderChips() {
    $('chips').replaceChildren(...['すべて', ...CATEGORIES].map(c => {
      const b = btn('chip', c, () => { cat = c; renderTodo(); });
      b.setAttribute('aria-pressed', String(c === cat));
      return b;
    }));
  }
  function row(item, s, t, period) {
    const over = isOverdue(item, s, t);
    const li = el('li', 'row' + (item.done ? ' is-done' : '') + (over ? ' is-overdue' : ''));
    li.setAttribute('data-id', item.id);
    const check = btn('check', item.done ? '✓' : '', () => toggleDone(item.id));
    check.setAttribute('aria-pressed', String(Boolean(item.done)));
    check.setAttribute('aria-label', item.done ? '済みを取り消す' : '済みにする');
    const main = btn('row-main', null, () => openDetail(item.id));
    const meta = el('span', 'row-meta');
    if (over) meta.append(el('span', 'badge overdue', '期限切れ'));
    if (period && query.trim()) meta.append(el('span', 'badge period', PERIOD_TEXT[period]));
    const label = item.done ? doneLabel(item) : deadlineLabel(item, s);
    if (label) meta.append(el('span', 'row-date', label));
    meta.append(el('span', 'badge cat', item.category));
    if (isNoPlan(item)) meta.append(el('span', 'badge noplan', NO_PLAN_TEXT));
    if (item.tag) meta.append(el('span', 'badge tag', item.tag));
    const p = planOf(item);
    if (!item.done && p.planDate) meta.append(el('span', 'badge plan', planWhenLabel(item)));
    if (!item.done && p.assignee) meta.append(el('span', 'badge who', assigneeText(item, family())));
    main.append(el('span', 'row-title', item.title), meta);
    li.append(check, main);
    return li;
  }
  function group(key, listId, list, s, t) {
    const toggle = $(key + '-toggle'), box = $(listId);
    const open = expanded[key] || Boolean(query.trim());
    const period = key === 'todo' ? 'near' : key;
    toggle.textContent = PERIOD_TEXT[period] + '　' + (key === 'done' ? list.length + '件' : '未完了 ' + list.filter(i => !i.done).length + '件');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.hidden = list.length === 0;
    box.hidden = !open || list.length === 0;
    box.replaceChildren(...(open ? list.map(i => row(i, s, t, period)) : []));
  }
  function renderTodo() {
    renderChips();
    const s = settings(), t = today();
    const sec = todoSections(state.items, s, t, {category: cat, query, view: todoView});
    group('todo', 'todo-list', sec.near, s, t);
    group('later', 'later-list', sec.later, s, t);
    group('undated', 'undated-list', sec.undated, s, t);
    group('done', 'done-list', sec.done, s, t);
    for (const v of ['all', 'open', 'done']) $('v-' + v).setAttribute('aria-pressed', String(todoView === v));
    const q = query.trim();
    $('q-clear').hidden = !q;
    const filters = [];
    if (q) filters.push('「' + q + '」');
    if (cat !== 'すべて') filters.push('分類：' + cat);
    if (todoView !== 'all') filters.push(todoView === 'open' ? '未完了だけ' : '済みだけ');
    $('todo-filter-bar').hidden = filters.length === 0;
    $('todo-filter-state').textContent = filters.length ? '絞り込み中：' + filters.join('・') : '';
    const loadError = Boolean(state.error) && state.items.length === 0;
    $('todo-empty').hidden = sec.total > 0;
    $('todo-empty-text').textContent = loadError ? '読み込めませんでした。つながったら、もう一度開いてください'
      : q || cat !== 'すべて' ? '該当なし' : todoView === 'done' ? '済みの項目はありません' : 'やることはありません';
  }
  function toggleDone(id) {
    const it = findItem(id);
    if (!it || !store) return;
    track(store.setDone(id, !it.done), it.title);
  }

  // ---- 詳細 ----
  function openDetail(id) {
    detailId = id;
    $('d-status').textContent = ''; $('d-status').className = 'save-status';
    $('d-noplan-status').textContent = ''; $('d-noplan-status').className = 'save-status';
    $('d-cal-status').textContent = '';
    renderDetail(true);
    if (drafts[id]) {
      const d = drafts[id];
      $('d-memo').value = d.memo; $('d-plan-date').value = d.planDate; $('d-plan-time').value = d.planTime;
      fillAssignee($('d-assignee'), d.assignee);
      $('d-status').textContent = SAVE_TEXT.failed; $('d-status').className = 'save-status is-failed';
    }
    showPanel('detail');
  }
  function fillAssignee(sel, value) {
    const f = family();
    sel.replaceChildren(...[['', '未定'], ['husband', assigneeLabel('husband', f)], ['wife', assigneeLabel('wife', f)], ['both', assigneeLabel('both', f)]]
      .map(([v, t]) => { const o = el('option', '', t); o.value = v; return o; }));
    sel.value = value;
  }
  function calNote(it, ev) {
    if (!ev) return '日付を入れると、カレンダーに追加できます';
    const p = planOf(it);
    const how = p.planDate ? (p.planTime ? '予定の日時で作ります。' : '時刻未定なので、終日の予定として作ります。') : '予定日が未定なので、期限の日の終日の予定として作ります（時刻は入りません）。';
    return how + '「カレンダー用のファイル」には、前の日 9:00 と当日 8:00 の通知が入っています。Googleカレンダーはいつもの通知になります。同じ予定を2回追加すると、2つ登録されることがあります';
  }
  function renderDetail(fresh) {
    if (!detailId) return;
    const it = findItem(detailId);
    if (!it) { forceClose('detail'); return; }
    const s = settings();
    const dirty = !fresh && isDirty('detail');
    $('d-title').textContent = it.title;
    const noPlan = isNoPlan(it);
    $('d-summary').textContent = [deadlineLabel(it, s) || '締切 なし', planWhenLabel(it), assigneeText(it, family()), stateText(it), ...(noPlan ? [NO_PLAN_TEXT] : [])].join('　');
    const lab = deadlineLabel(it, s);
    $('d-date').textContent = lab ? lab + (isOverdue(it, s, today()) ? '（期限切れ）' : '') : '期限なし';
    const cond = conditionLabel(it, s);
    $('d-cond').hidden = !cond; $('d-cond').textContent = cond;
    $('d-rule').textContent = it.rule || '';
    $('d-place').textContent = '場所：' + (it.place || '－');
    const docs = (it.documents || []).map(d => el('li', '', d));
    $('d-docs').replaceChildren(...(docs.length ? docs : [el('li', 'muted', '－')]));
    $('d-note').textContent = it.note || '';
    if (!dirty) {
      const p = planFromItem(it);
      $('d-memo').value = it.memo || '';
      $('d-plan-date').value = p.planDate;
      $('d-plan-time').value = p.planTime;
      $('d-plan-error').textContent = '';
      fillAssignee($('d-assignee'), p.assignee);
    } else fillAssignee($('d-assignee'), val('d-assignee'));
    // R9.1：「予定は不要」のボタン。印があるときはカレンダーのボタンとリンクを出さず、理由を書く。
    const npb = $('d-noplan');
    npb.textContent = noPlan ? NOPLAN.off : NOPLAN.on;
    npb.setAttribute('aria-pressed', String(noPlan));
    $('d-noplan-note').textContent = NOPLAN.note;
    const ev = noPlan ? null : calendarEvent(it, s, family());
    $('d-ics').hidden = !ev;
    const g = $('d-gcal');
    if (ev) { g.href = gcalUrl(ev); g.hidden = false; } else { g.hidden = true; g.removeAttribute('href'); }
    $('d-cal-note').textContent = noPlan ? NOPLAN.calNote : calNote(it, ev);
    if (noPlan) $('d-cal-status').textContent = '';
    const link = $('d-link');
    if (it.sourceUrl && /^https:\/\//.test(it.sourceUrl)) { link.href = it.sourceUrl; link.hidden = false; }
    else { link.hidden = true; link.removeAttribute('href'); }
    $('d-done').textContent = it.done ? '済みを取り消す' : '済みにする';
    $('d-done').setAttribute('aria-pressed', String(Boolean(it.done)));
    $('d-done-by').textContent = it.done ? doneLabel(it) : '未完了';
  }
  function saveDetail() {
    const it = findItem(detailId);
    if (!it || !store) return;
    const input = {memo: val('d-memo'), ...planInputs('d')};
    const res = store.saveDetail(it.id, input, it);
    if (!res.ok) { $('d-plan-error').textContent = res.errors[0]; return; }
    $('d-plan-error').textContent = '';
    if (res.unchanged) { $('d-status').textContent = SAVE_TEXT.unchanged; $('d-status').className = 'save-status'; return; }
    const id = it.id;
    submit('detail:' + id, res.write, {
      statusId: 'd-status', title: it.title, isCurrent: () => detailId === id && !$('detail').hidden,
      onOk: () => { delete drafts[id]; },
      onFail: () => { if (detailId !== id || $('detail').hidden) drafts[id] = input; }
    });
  }
  function downloadIcs() {
    const it = findItem(detailId);
    if (!it) return;
    // R9.1：印がある項目のファイルは作らない（ボタンは隠しているが、念のため）。
    if (isNoPlan(it)) { $('d-cal-note').textContent = NOPLAN.calNote; return; }
    const ev = calendarEvent(it, settings(), family());
    if (!ev || typeof opts.download !== 'function') return;
    opts.download(buildIcs(ev, nowFn()), icsFileName(ev.title));
    $('d-cal-status').textContent = 'ファイルを作りました。カレンダーのアプリで開くと登録できます（登録されたかは、カレンダーで確かめてください）';
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
    $('e-error').textContent = ''; $('e-status').textContent = '';
    showPanel('editor', fromDetail ? 'detail' : null);
    editId = id || null;
    baselines.editor = formValues('editor');
  }
  function saveEditor() {
    if (!store) return;
    const it = editId ? findItem(editId) : null;
    const date = val('e-date');
    const auto = it ? computeDue(it.calc, settings()) : null;
    const input = {
      title: val('e-title'), category: val('e-category'), dateOverride: date === '' || date === auto ? null : date,
      place: val('e-place'), documents: val('e-docs').split('\n'), memo: val('e-memo'), sourceUrl: val('e-link')
    };
    const res = it ? store.editItem(it.id, input) : store.addItem(input);
    if (!res.ok) { $('e-error').textContent = res.errors[0]; return; }
    $('e-error').textContent = '';
    const before = baselines.editor;
    baselines.editor = formValues('editor');
    const key = 'editor:' + (it ? it.id : res.id);
    submit(key, res.write, {statusId: 'e-status', panel: 'editor', title: input.title, isCurrent: () => editId === (it ? it.id : null),
      onFail: () => { baselines.editor = before; }});
  }

  // ---- settings / family / birth ----
  function openSettings() { setTab('more', {pane: 'settings'}); focus($('more-settings')); }
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
    $('f-error').textContent = ''; $('f-status').textContent = '';
    setupShown = true;
    showPanel('setup');
    baselines.setup = formValues('setup');
  }
  function saveSetup() {
    if (!store) return;
    const res = store.saveFamily({husbandName: val('f-husband'), wifeName: val('f-wife'), bigName: val('f-big'),
      bigNote: val('f-bignote'), babyName: val('f-baby'), role: chosenRole});
    if (!res.ok) { $('f-error').textContent = res.errors[0]; return; }
    $('f-error').textContent = '';
    const before = baselines.setup;
    baselines.setup = formValues('setup');
    submit('family', res.write, {statusId: 'f-status', panel: 'setup', title: '家族の名前', onFail: () => { baselines.setup = before; }});
  }
  function openBirth() {
    const s = settings();
    $('b-date').value = s.birthDate || '';
    $('b-time').value = s.birthTime || '';
    $('b-date').setAttribute('max', today() || '2028-12-31');
    $('b-error').textContent = ''; $('b-status').textContent = '';
    showPanel('birth');
    baselines.birth = formValues('birth');
  }
  function saveBirth(date, time) {
    if (!store) return;
    const res = store.setBirth(date, time, today());
    if (!res.ok) { $('b-error').textContent = res.errors[0]; return; }
    $('b-error').textContent = '';
    const before = baselines.birth;
    baselines.birth = {'b-date': date || '', 'b-time': time || ''};
    $('b-date').value = date || ''; $('b-time').value = time || '';
    submit('birth', res.write, {statusId: 'b-status', panel: 'birth', title: '出生日', onFail: () => { baselines.birth = before; }});
  }
  function familyText() {
    const f = family() || {};
    const n = v => (v && String(v).trim()) || '未入力';
    return '夫：' + n(f.husbandName) + '／妻：' + n(f.wifeName) + '／上の子：' + n(f.bigName) + (f.bigNote ? '（' + f.bigNote + '）' : '') + '／赤ちゃん：' + n(f.babyName);
  }
  function renderSettings() {
    $('s-family-text').textContent = familyText();
    const r = myRoleInfo();
    $('s-role-text').textContent = 'このアカウント：' + (r.role === 'husband' ? '夫' : r.role === 'wife' ? '妻' : 'まだ選んでいません') + (r.inferred ? '（もう1人の設定から）' : '');
    const s = settings();
    $('s-due').textContent = s.birthDate ? '出生日 ' + formatShort(s.birthDate) + (s.birthTime ? ' ' + s.birthTime : '') : '予定日 ' + formatShort(s.dueDate || DUE_DATE) + '（出生日が未入力なので予定日で計算しています）';
    const st = notifier.status();
    const nb = $('notify-btn');
    nb.hidden = st === 'unsupported';
    nb.setAttribute('aria-pressed', String(notifier.enabled()));
    $('notify-state').textContent = st === 'unsupported' ? '' : notifier.enabled() ? 'いまはオン（アプリを開いている間だけ、今日の予定をお知らせします）' : 'いまはオフ';
    $('notify-note').textContent = st === 'unsupported' ? 'この端末では通知を使えません。「カレンダーに追加」を使ってください'
      : (st === 'denied' ? '通知が許可されていません。' : '') + NOTIFY_NOTE;
    for (const m of ['standard', 'reduce', 'stop']) $('m-' + m).setAttribute('aria-pressed', String(prefs.motion === m));
    $('m-note').textContent = motion.reducedOS() ? MOTION_NOTE.os : MOTION_NOTE[prefs.motion];
    renderCharList();
  }
  // キャラクターの一覧は、設定を開いたときに初めて作る（ふだんは選んだ1体の画像しか読み込まない）。
  // 一度だけ作り、あとは選択の表示だけを更新する（作り直すとフォーカスが外れ、画像も読み直すため）。
  const charButtons = new Map();
  function renderCharList() {
    if (tab !== 'more' || morePane !== 'settings') return;
    if (!charListBuilt) {
      charListBuilt = true;
      $('char-list').replaceChildren(...CHARACTERS.map(c => {
        const li = el('li', 'char-li');
        const b = btn('char-opt', null, () => setPref({character: c.id}, '「' + c.name + '」にしました'));
        b.setAttribute('data-char', c.id);
        const img = el('img', 'char-thumb');
        img.alt = ''; img.width = 56; img.height = 56; img.src = c.src;
        const parts = [img, el('span', 'char-name', c.name), el('span', 'char-item', c.item)];
        charButtons.set(c.id, {b, parts, sel: el('span', 'char-sel', '選択中')});
        li.append(b);
        return li;
      }));
    }
    for (const [id, {b, parts, sel}] of charButtons) {
      const on = id === prefs.character;
      b.className = 'char-opt' + (on ? ' is-selected' : '');
      b.setAttribute('aria-pressed', String(on));
      b.replaceChildren(...parts, ...(on ? [sel] : []));
    }
  }
  function applyPrefs() {
    prefs = {...resolvePrefs(localPrefs, state.prefs), ...cleanPrefs(prefOverride)};
    motion.setMode(prefs.motion);
  }
  function setPref(patch, msg) {
    const clean = cleanPrefs(patch);
    localPrefs = {...localPrefs, ...clean};
    writeLocalPrefs(opts.storage, localPrefs);
    prefOverride = {...prefOverride, ...clean};
    applyPrefs();
    renderAll();
    const status = $('char-status');
    status.textContent = msg || '';
    if (!store) return;
    const res = store.setPrefs(clean);
    if (!res.ok) { status.textContent = (msg ? msg + '。' : '') + 'この端末にだけ保存しました'; return; }
    if (isOffline()) status.textContent = (msg ? msg + '。' : '') + QUEUED_TEXT;
    res.write.then(() => {
      for (const k of Object.keys(clean)) if (prefOverride[k] === clean[k] && state.prefs && state.prefs[k] === clean[k]) delete prefOverride[k];
    }, () => { status.textContent = (msg ? msg + '。' : '') + 'この端末にだけ保存しました（アカウントには保存できませんでした）'; });
  }

  // ---- photos ----
  function renderPhotos() {
    $('photo-grid').replaceChildren(...state.photos.map(p => {
      const li = el('li', 'cell');
      const b = btn('thumb', null, () => openViewer(p.id));
      b.setAttribute('aria-label', '写真を開く');
      const img = el('img');
      img.src = p.thumb; img.alt = '';
      b.append(img);
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
      try { track(store.addPhoto(await opts.preparePhoto(list[i])).write, '写真'); } catch (e) { if (e && e.code === 'decode') decodeFails++; else otherFails++; }
    }
    status.textContent = photoFailText(decodeFails, otherFails);
  }

  function renderAll() {
    if (state.auth !== 'ready') return;
    renderTabs();
    renderTodayHead();
    renderBirth();
    renderAttention();
    renderChara();
    renderWord();
    renderDayGroups();
    renderNotifyLine();
    renderWeek();
    renderUndecided();
    renderTodo();
    renderPhotos();
    renderSettings();
    renderDetail(false);
  }
  function render(next) {
    if (next) state = next;
    renderScreens();
    renderPill();
    if (state.auth !== 'ready') return;
    applyPrefs();
    renderAll();
    if (viewerId && !state.photos.some(p => p.id === viewerId)) forceClose('viewer');
    if (editId && !findItem(editId)) forceClose('editor');
    if (plannerId && !findItem(plannerId)) forceClose('planner');
    // 初回：家族の設定が無い、またはこのアカウントの役割が分からないとき、1回だけ開く。
    if (!setupShown && state.familyLoaded && (!state.family || !myRole())) openSetup();
    maybeWelcome();
    runNotify();
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
  for (const t of TABS) $('tab-btn-' + t).onclick = () => setTab(t);
  $('more-album').onclick = () => { morePane = 'album'; renderTabs(); };
  $('more-settings').onclick = () => { morePane = 'settings'; renderTabs(); renderSettings(); };
  $('search-entry').onclick = () => { setTab('todo'); focus($('q')); };
  $('attention-more').onclick = () => { attentionAll = !attentionAll; renderAttention(); if (attentionAll) motion.play($('chara-wrap'), 'guide', currentChar()); };
  $('word-full').onclick = () => { wordFull = !wordFull; renderWord(); };
  $('chara-rest').onclick = () => motion.play($('chara-wrap'), 'rest', currentChar());
  $('chara-wrap').onclick = () => motion.tap($('chara-wrap'), currentChar());
  for (const key of ['todo', 'later', 'undated', 'done']) $(key + '-toggle').onclick = () => { expanded[key] = !expanded[key]; renderTodo(); };
  $('q').oninput = () => { query = $('q').value || ''; renderTodo(); };
  $('q-clear').onclick = () => { query = ''; $('q').value = ''; renderTodo(); focus($('q')); };
  $('todo-filter-clear').onclick = () => { query = ''; $('q').value = ''; cat = 'すべて'; todoView = 'all'; renderTodo(); };
  for (const v of ['all', 'open', 'done']) $('v-' + v).onclick = () => { todoView = v; renderTodo(); };
  $('add-btn').onclick = () => openEditor(null);
  $('w-prev').onclick = () => { weekFollow = false; weekStart = addDays(weekStart, -7); weekSel = weekStart; renderWeek(); };
  $('w-next').onclick = () => { weekFollow = false; weekStart = addDays(weekStart, 7); weekSel = weekStart; renderWeek(); };
  $('w-today').onclick = () => { weekFollow = true; weekStart = today(); weekSel = weekStart; renderWeek(); };
  $('w-date').onchange = () => { const d = val('w-date'); if (isValidDate(d)) { weekFollow = false; weekStart = d; weekSel = d; renderWeek(); } };
  for (const f of ['husband', 'wife', 'both']) $('wf-' + f).onclick = () => { weekFilter = weekFilter === f ? null : f; renderWeek(); };
  $('w-filter-clear').onclick = () => { weekFilter = null; renderWeek(); };
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
    if (state.auth === 'ready') { renderSettings(); renderNotifyLine(); runNotify(); }
  };
  for (const m of ['standard', 'reduce', 'stop']) $('m-' + m).onclick = () => setPref({motion: m});
  for (const id of PANELS) {
    const [back, close] = PANEL_BUTTONS[id];
    $(back).onclick = () => requestClose(id);
    $(close).onclick = () => requestClose(id);
    $(id).onclick = e => { if (e && e.target === $(id)) requestClose(id); };
  }
  $('d-done').onclick = () => { if (detailId) toggleDone(detailId); };
  $('d-edit').onclick = () => {
    if (!detailId) return;
    const id = detailId;
    if (isDirty('detail')) askDiscard(() => openEditor(id, true)); else openEditor(id, true);
  };
  $('d-delete').onclick = () => {
    const it = findItem(detailId);
    if (!it || !store || !confirmFn('「' + it.title + '」を削除しますか？')) return;
    track(store.deleteItem(it.id), it.title);
    forceClose('detail');
  };
  $('d-save').onclick = saveDetail;
  $('d-noplan').onclick = () => { const it = findItem(detailId); if (it) setNoPlan(it.id, !isNoPlan(it), 'detail'); };
  $('d-ics').onclick = downloadIcs;
  $('d-gcal').onclick = () => {
    if (isNoPlan(findItem(detailId))) { $('d-cal-note').textContent = NOPLAN.calNote; return; }
    $('d-cal-status').textContent = 'Googleカレンダーを開きました。登録するには、開いた画面で保存してください';
  };
  $('p-save').onclick = savePlanner;
  $('p-later').onclick = () => requestClose('planner');
  $('e-save').onclick = saveEditor;
  $('s-family').onclick = openSetup;
  $('s-birth-open').onclick = openBirth;
  $('s-logout').onclick = () => { if (store) store.signOut().catch(() => {}); };
  $('f-role-husband').onclick = () => { chosenRole = 'husband'; setRoleButtons(); };
  $('f-role-wife').onclick = () => { chosenRole = 'wife'; setRoleButtons(); };
  $('f-save').onclick = saveSetup;
  $('b-save').onclick = () => saveBirth(val('b-date') || null, val('b-time') || null);
  $('b-clear').onclick = () => saveBirth(null, null);
  $('photo-input').onchange = () => { const input = $('photo-input'); const files = Array.from(input.files || []); input.value = ''; return addPhotos(files); };
  $('v-delete').onclick = () => {
    if (!viewerId || !store || !confirmFn('この写真を削除しますか？')) return;
    track(store.deletePhoto(viewerId), '写真');
    forceClose('viewer');
  };
  $('x-stay').onclick = exitStay;
  $('x-leave').onclick = exitLeave;
  $('exit-dialog').onclick = e => { if (e && e.target === $('exit-dialog')) exitStay(); };
  $('dc-keep').onclick = () => discardChoice(false);
  $('dc-discard').onclick = () => discardChoice(true);
  $('discard-dialog').onclick = e => { if (e && e.target === $('discard-dialog')) discardChoice(false); };
  function onKey(e) {
    if (!e || e.key !== 'Escape') return;
    if (!$('discard-dialog').hidden) { discardChoice(false); return; }
    if (!$('exit-dialog').hidden) { exitStay(); return; }
    if (closeTop() && typeof e.preventDefault === 'function') e.preventDefault();
  }
  const isField = t => Boolean(t && /^(INPUT|TEXTAREA|SELECT)$/.test(String(t.tagName || '').toUpperCase()));
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'hidden') refreshDay(); });
    // 文字入力中はキャラクターを動かさない。
    document.addEventListener('focusin', e => { if (isField(e && e.target)) motion.block('typing', true); });
    document.addEventListener('focusout', e => { if (isField(e && e.target)) motion.block('typing', false); });
  }
  // 画面の外に出たら止める（IntersectionObserver がある端末だけ）。
  if (typeof opts.IntersectionObserver === 'function') {
    try {
      const io = new opts.IntersectionObserver(entries => {
        for (const en of entries) charaInView = Boolean(en.isIntersecting);
        motion.setVisible(tab === 'today' && charaInView);
      });
      io.observe($('chara-wrap'));
    } catch { /* ignore */ }
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
    setTab,
    guard,
    notifier,
    motion,
    isDirty,
    get tab() { return tab; },
    get prefs() { return {...prefs}; },
    get openDetailId() { return detailId; },
    get saveErrors() { return saveErrors.slice(); }
  };
}
