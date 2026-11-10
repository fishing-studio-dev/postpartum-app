// 画面。DOM は createElement / textContent だけで作る（HTML 文字列は使わない）。
// R9：下の5つのタブ（きょう／1週間／まだ未定／やること／アルバム・設定）。1つのタブに1つの画面。
import {CATEGORIES, DUE_DATE, itemDate, computeDue, conditionLabel, isOverdue, doneLabel, formatShort, formatMD, toDate, shortName,
  todayLocal, planOf, resolveRole, wordContext, birthCard, msUntilMidnight, hhmm, upcoming, addDays, isValidDate,
  deadlineLabel, planWhenLabel, stateText, todayGroups, attentionItems, weekDays, WEEKDAY, dayEntries,
  REASON_TEXT, undecidedItems, undecidedReason, todoSections, PERIOD_TEXT, SOON_AHEAD, formatMonthDay, isNoPlan, NO_PLAN_TEXT, daysBetween} from './logic.js';
import {iconFor} from './item-icons.js';
import {buildIcs, gcalUrl, calendarEvent, icsFileName} from './calendar.js';
import {dailyWord, wordPool, WORD_TITLE} from './words.js';
import {createBackGuard} from './history.js';
import {createNotifier, NOTIFY_NOTE} from './notify.js';
import {OFFLINE_TEXT, QUEUED_TEXT} from './offline.js';
import {MAX_FILES, photoFailText} from './photo.js';
import {errText} from './data.js';
import {CHARACTERS, getCharacter} from './chars/registry.js';
import {placementFor, placeOf, PLACE_TEXT} from './placement.js';
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
// R10：きょうの「今日と明日」で、日時か担当が決まっていない行に出す「日時・担当を決める」と、その場で開く「いつ・誰が」の欄。
// 保存は詳細の「保存」と同じ store.saveDetail（変わった いつ・誰が だけを1回の update で書く）。担当は自動で入れない。
export const QUICK_PLAN = Object.freeze({
  open: '日時・担当を決める',
  legend: 'いつ・誰が',
  date: '日付',
  time: '時刻',
  untimed: '時刻未定',
  undated: '日付未定',
  other: 'ほかの日・時刻を入れる',
  otherDate: 'ほかの日を選ぶ',
  otherTime: '時刻を入れる',
  who: '担当',
  save: '保存する',
  cancel: 'キャンセル',
  more: 'くわしい画面で決める'
});
export const WHO_TEXT = Object.freeze({husband: '夫', wife: '妻', both: '2人'});
// R10-2：担当の札は 夫／妻／2人 だけ（家族の名前は設定の画面の中だけで使う）。読み上げは「担当：夫」。
export const whoWord = a => WHO_TEXT[a] || '未定';
export const whoSpeech = a => '担当：' + whoWord(a);
export const whoSummary = a => '担当 ' + whoWord(a);
// R10-2：「日時・担当を決める」の日付と時刻の選択（今日から60日分・15分きざみ）
export const DATE_CHOICES = 60;
export const TIME_STEP_MIN = 15;
// R10-2：日付の書き方（11月15日（土）。今日と年が違うときは年も）
export function jaDate(d, today) {
  if (!isValidDate(d)) return '';
  const [y, m, day] = d.split('-').map(Number);
  const year = isValidDate(today) && today.slice(0, 4) !== d.slice(0, 4) ? y + '年' : '';
  return year + m + '月' + day + '日（' + WEEKDAY(d) + '）';
}
export function jaMonthDay(d, today) {
  if (!isValidDate(d)) return '';
  const [y, m, day] = d.split('-').map(Number);
  return (isValidDate(today) && today.slice(0, 4) !== d.slice(0, 4) ? y + '年' : '') + m + '月' + day + '日';
}
// 「先に確認」の1行目の前置き（短く。題名が見えるように）
export function attentionLead(e, today) {
  if (!e || e.kind === 'error') return '保存できませんでした：';
  if (e.kind === 'overdue') return '期限切れ：';
  const n = isValidDate(e.date) && isValidDate(today) ? daysBetween(today, e.date) : null;
  return n === 0 ? '今日まで：' : n === 1 ? '明日まで：' : n > 1 ? 'あと' + n + '日：' : '締切が近い：';
}
export function dateChoices(today, n = DATE_CHOICES) {
  const out = [];
  if (!isValidDate(today)) return out;
  for (let i = 0; i < n; i++) { const d = addDays(today, i); if (d >= '2025-01-01' && d <= '2030-12-31') out.push(d); }
  return out;
}
export function timeChoices(step = TIME_STEP_MIN) {
  const out = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  return out;
}
export const GROUP_MAX = 3;
export const ATTENTION_FIRST = 2;
export const MOTION_NOTE = Object.freeze({
  // R10-4（意図した変更）：ご本人の指示で常時の動き（ゆっくり浮く）を入れた
  standard: 'キャラクターは、ゆっくり浮かんでいます。触れると小さく動きます',
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
  let attentionAll = false, wordFull = false, attentionOpen = false;
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
  // R10-4：どの子をどこに出すかは、その日のローカルの日付だけで決まる（placement.js）。prefs.character は使わない。
  const place = () => placementFor(today());
  const currentChar = () => place().today;
  // 常時の動き（CSS）：動かしてよいときだけ。文字入力中・パネル表示中・画面外・裏・動きを減らす／停止では .app に data-idle="off"。
  //   OS の「動きを減らす」は CSS の @media で止める。motion の止める条件を変えたところでは、続けて syncIdle() を呼ぶ。
  function syncIdle() { const a = $('app'); if (a) a.setAttribute('data-idle', motion.canMove() ? 'on' : 'off'); }
  const blockMotion = (reason, on) => { motion.block(reason, on); syncIdle(); };
  // いま画面に出ている子（img の data-char）。触ったときの反応はこの子のもの。
  const shownChar = imgId => getCharacter(($(imgId) && $(imgId).getAttribute('data-char')) || currentChar().id);

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
    blockMotion('panel', true);
    focus($(PANEL_BUTTONS[id][0]));
  }
  // 見た目だけ閉じる（戻る操作で閉じたとき）。
  function hidePanel(id) {
    const p = $(id);
    if (!p || p.hidden) return;
    p.hidden = true;
    if (CLEANUP[id]) CLEANUP[id]();
    if (!anyPanelOpen()) blockMotion('panel', false);
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
  const anyDirty = () => PANELS.some(isDirty) || quickDirty();

  // ---- screens ----
  function renderScreens() {
    const a = state.auth;
    $('loading').hidden = a !== 'loading';
    $('login').hidden = !(a === 'signedOut' || a === 'denied' || a === 'error');
    $('app').hidden = a !== 'ready';
    $('login-msg').textContent = a === 'denied' ? DENIED_TEXT : (a === 'ready' ? '' : state.error || '');
    $('login-btn').disabled = false;
    if (a !== 'ready') { for (const id of PANELS) if (!$(id).hidden) forceClose(id); setupShown = false; $('discard-dialog').hidden = true; quick = null; }
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
    $('app').setAttribute('data-tab', tab);   // R10：空の背景（R10-2：どのタブも。色合いはタブごと。CSS）
    // R10-4：右上の飾りの子は、その日の配置（placement.js）。そのタブを開いたときに読み込む（日付が変わっていれば新しい日の子）。
    const p = place();
    if (tab === 'week') showHeadChara('w-chara', p.week);
    if (tab === 'undecided') showHeadChara('u-chara', p.undecided);
    if (tab === 'todo') showHeadChara('t-chara', p.todo);
    if (tab === 'more' && morePane === 'album') showHeadChara('a-chara', p.album);
    // 画面外で止めるのは、きょうの主役が見えなくなったとき（ほかのタブの子は見出しにいる）。
    motion.setVisible(tab !== 'today' || charaInView);
    syncIdle();
  }
  function showHeadChara(id, c) {
    const img = $(id);
    if (!img) return;
    setCharImg(img, c);
    img.hidden = img.getAttribute('data-broken') === c.id;
  }
  // R10-2：キャラの絵を入れる。絵が読み込めなかったとき（ファイルが無い等）は、その子の SVG に一度だけ戻す。
  // R10-4：10体には SVG が無い（fallback: null）。読み込めなかったら絵を隠す（文字や押す所は変わらない）。
  function setCharImg(img, c) {
    if (img.getAttribute('data-char') === c.id) return;
    img.setAttribute('data-char', c.id);
    img.removeAttribute('data-fallback');
    if (img.getAttribute('data-broken')) { img.removeAttribute('data-broken'); img.hidden = false; }
    img.onerror = () => {
      if (img.getAttribute('data-char') !== c.id) return;
      if (!c.fallback) { img.setAttribute('data-broken', c.id); img.hidden = true; return; }
      if (img.getAttribute('data-fallback') === c.id || c.fallback === c.src) return;
      img.setAttribute('data-fallback', c.id);
      img.src = c.fallback;
    };
    img.src = c.src;
  }
  function setTab(t, o = {}) {
    if (!TABS.includes(t)) return;
    if (t !== tab) motion.stop();   // R10-4：ほかのタブに移ったら、前のタブの子の反応は止める（見えなくなるため）
    tab = t;
    if (o.pane) morePane = o.pane;
    renderTabs();
    if (t === 'more' && morePane === 'settings') renderSettings();
    if (t === 'today') maybeWelcome();
  }
  function maybeWelcome() { if (state.auth === 'ready' && tab === 'today') motion.welcome($('chara-wrap'), currentChar(), today()); }

  // ---- 共通：担当の札・アイコン・予定の行 ----
  // R10-2：担当の札は「夫」「妻」「2人」（未定は「未定」）。読み上げ用に「担当：」を見えない文字で前に付ける。
  // 色（夫＝水色／妻＝ラベンダー〜ピンク／2人＝黄色）に加えて、文字でも分かる。
  function whoChip(cls, assignee) {
    const a = WHO_TEXT[assignee] ? assignee : 'none';
    const s = el('span', cls + ' who-' + a);
    s.append(el('span', 'visually-hidden', '担当：'), el('span', 'who-text', whoWord(assignee)));
    return s;
  }
  // R10-2：項目のアイコン（item-icons.js の対応表）。合うものが無ければ付けない。飾りなので alt=""。
  function iconImg(item, cls = 'item-icon') {
    const src = iconFor(item);
    if (!src) return null;
    const img = el('img', cls);
    img.alt = ''; img.width = 36; img.height = 36;
    img.setAttribute('decoding', 'async');
    img.src = src;
    return img;
  }
  // R10-2：見本どおり1行の低い行（札・時刻・アイコン・題名・担当の札）。予定日時・締切・未完了は読み上げ（aria-label）と詳細で伝える。
  //   o.day：行の頭の札（今日／明日／11/22）、o.dayKey：札の色、o.planned：予定日がある（無ければ時刻の所は「締切」）
  function compactRow(item, o = {}) {
    const p = planOf(item);
    const b = btn('agenda-row is-compact' + (item.done ? ' is-done' : ''), null, () => openDetail(item.id));
    b.setAttribute('data-id', item.id);
    if (o.day) b.append(el('span', 'day-chip is-' + (o.dayKey || 'soon'), o.day));
    const when = o.planned === false ? '締切' : (o.time || '時刻未定');
    b.append(el('span', 'ag-time' + (o.time ? '' : ' is-untimed'), when));
    const ic = iconImg(item);
    if (ic) b.append(ic);
    b.append(el('span', 'ag-title', item.title));
    if (item.done) b.append(el('span', 'badge state is-done', stateText(item)));
    if (isNoPlan(item)) b.append(el('span', 'badge noplan', NO_PLAN_TEXT));
    b.append(whoChip('ag-who', p.assignee));
    b.setAttribute('aria-label', [o.day, when, item.title, whoSpeech(p.assignee), planWhenLabel(item), deadlineLabel(item, settings()) || '締切 なし',
      stateText(item), ...(isNoPlan(item) ? [NO_PLAN_TEXT] : [])].filter(Boolean).join('、'));
    return b;
  }
  // R10-2：1週間の「締切だけ決まっていること」の行（アイコン・題名・11月13日まで・›）
  function deadlineRow(x) {
    const item = x.item;
    const b = btn('deadline-row' + (item.done ? ' is-done' : ''), null, () => openDetail(item.id));
    b.setAttribute('data-id', item.id);
    const ic = iconImg(item);
    if (ic) b.append(ic);
    b.append(el('span', 'ag-title', item.title));
    b.append(el('span', 'dl-date', jaMonthDay(x.date, today()) + (x.kind === 'from' ? 'から' : 'まで')));
    if (item.done) b.append(el('span', 'badge state is-done', stateText(item)));
    b.setAttribute('aria-label', [item.title, planWhenLabel(item), deadlineLabel(item, settings()) || '締切 なし', whoSpeech(planOf(item).assignee), stateText(item)].join('、'));
    return b;
  }

  // ---- きょう ----
  function myRoleInfo() { return resolveRole(family(), state.myHash); }
  function myRole() { return myRoleInfo().role; }
  function renderTodayHead() {
    $('today-date').textContent = longDate(today());
    const r = myRole();
    $('role-label').textContent = r === 'wife' ? '妻のアカウント' : r === 'husband' ? '夫のアカウント' : '夫か妻か まだ選んでいません';
    // R10 追補1：帯の札は短く（妻／夫）。読み上げは role-label（今までと同じ文）が読む。
    $('role-short').textContent = r === 'wife' ? '妻' : r === 'husband' ? '夫' : '未選択';
  }
  function renderBirth() {
    const c = birthCard(settings(), today());
    $('birth-before').hidden = c.state !== 'before';
    $('birth-after').hidden = c.state !== 'after';
    $('birth-card').className = 'birth-card ' + (c.state === 'before' ? 'is-before' : 'is-after');
    $('date-band').className = 'date-band ' + (c.state === 'before' ? 'is-before' : 'is-after');   // R10 追補1：生まれた後は1本の帯
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
    $('attention-count').textContent = list.length + '件';
    // R10 追補1：最初は1行の要約（最初の項目だけ）。押すと下の一覧（全件・予定は不要・すべて見る）が開く。
    // R10-2：前置きは短く（期限切れ：／今日まで：／明日まで：／あと2日：）。題名が見えるように。
    const first = list[0];
    $('attention-first').textContent = !first ? '' : attentionLead(first, today()) + (first.kind === 'error' ? (first.title || '変更') : first.item.title);
    $('attention-body').hidden = !attentionOpen;
    $('attention-toggle').setAttribute('aria-expanded', String(attentionOpen));
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
    // R10-4：きょうの主役＝その日の配置の rotated[0]（src は実行時に入れる）。読み込めなければ絵を隠す。
    setCharImg($('chara-img'), c);
    $('chara-wrap').setAttribute('data-char', c.id);
    $('app').setAttribute('data-motion-mode', prefs.motion);
    syncIdle();
  }
  // R10-4：ログイン／読み込み中の絵も、その日の「きょう」の子（HTML の初期値は はなっぱ）。
  function renderLoginChara() {
    const c = currentChar();
    for (const id of ['loading-chara', 'login-chara']) { const img = $(id); if (img) setCharImg(img, c); }
  }
  function renderDayGroups() {
    const t = today();
    const g = todayGroups(state.items, settings(), t);
    const defs = [
      ['today', '今日', g.today, '今日の予定は登録されていません', t],
      ['tomorrow', '明日', g.tomorrow, '明日の予定は登録されていません', addDays(t, 1)],
      ['soon', 'もうすぐ（' + SOON_AHEAD + '日以内）', g.soon, 'もうすぐの予定は登録されていません', addDays(t, 2)]
    ];
    if (quick && !findItem(quick.id)) quick = null;   // 項目が消えたときだけ閉じる
    const active = document.activeElement;
    const shown = new Set();
    const mine = quick && quick.where === 'today' ? quick : null;
    clearQuickButtons('today');
    // R10-2：まとまりの見出し（今日（1件）など）は見せず、行ごとに「今日／明日」の札を付ける。
    // 見出しは読み上げ用に残す（件数も）。並びは 今日 → 明日 → もうすぐ、それぞれ時刻順（logic.js の順のまま）。
    const boxes = defs.map(([key, label, list, empty, date]) => {
      const box = el('div', 'day-group is-' + key);
      box.setAttribute('data-group', key);
      box.append(el('h4', 'day-group-head visually-hidden', label + '（' + list.length + '件）'));
      if (!list.length && key !== 'soon') box.append(el('p', 'empty-text', empty));
      for (const e of list.slice(0, GROUP_MAX)) {
        const day = key === 'soon' ? formatMonthDay(e.date) : label;
        box.append(compactRow(e.item, {day, dayKey: key, time: e.time || '', planned: e.planned}));
        shown.add(e.item.id);
        // R10：日時か担当が決まっていない行には「日時・担当を決める」（開いているときは いつ・誰が の欄）
        if ((mine && mine.id === e.item.id) || needsPlan(e.item)) box.append(quickSlot(e.item, 'today'));
      }
      if (list.length > GROUP_MAX) box.append(btn('link-more', 'ほか ' + (list.length - GROUP_MAX) + '件を1週間で見る', () => goWeek(date)));
      return box;
    });
    // 開いている欄の項目が今日・明日・もうすぐから外れた（日付が変わったなど）ときも、入力は消さずに最後に出す。
    if (mine && !shown.has(mine.id)) boxes.push(quickSlot(findItem(mine.id), 'today'));
    $('day-groups').replaceChildren(...boxes);
    if (mine && mine.node && active && within(mine.node, active)) focus(active);
    return g;
  }

  // ---- R10：その場で開く「いつ・誰が」 ----
  // R10-2：同じ欄を「まだ未定」でも使う（where: 'today' | 'undecided'）。開けるのは一度に1つだけ。
  let quick = null;   // {id, where, planDate, planTime, assignee, other, node, parts}
  const quickButtons = new Map();   // key: where + ':' + id
  const QUICK_STATUS = {today: 'today-plan-status', undecided: 'u-status'};
  function clearQuickButtons(where) { for (const k of [...quickButtons.keys()]) if (k.startsWith(where + ':')) quickButtons.delete(k); }
  function renderQuickHosts() { renderDayGroups(); renderUndecided(); }
  // R10 追補1：本物の DOM の children は HTMLCollection（配列ではない）。Node.contains を使い、
  // contains の無い偽 DOM のときだけ Array.from で子をたどる。
  const within = (root, x) => {
    if (!root || !x) return false;
    if (typeof root.contains === 'function') return root.contains(x);
    return root === x || Array.from(root.children || []).some(c => within(c, x));
  };
  // 済んでいない・「予定は不要」の印がない・日付か担当が未定（まだ未定と同じ条件）
  const needsPlan = it => Boolean(it) && !it.done && !isNoPlan(it) && undecidedReason(it) !== null;
  // 保存する中身の形は今までと同じ（planDate "YYYY-MM-DD" か ''、planTime "HH:MM" か ''（＝時刻未定）、assignee）。
  function quickValues() { return {planDate: quick.planDate, planTime: quick.planTime, assignee: quick.assignee}; }
  function quickDirty() {
    if (!quick) return false;
    const it = findItem(quick.id);
    return Boolean(it) && !same(quickValues(), planFromItem(it));
  }
  // R10-2：ボタンの文字。日付が決まっていれば「担当を決める」、担当だけ決まっていれば「日時を決める」。
  function decideText(item) {
    const r = undecidedReason(item);
    return r === 'assignee' ? '担当を決める' : r === 'date' ? '日時を決める' : QUICK_PLAN.open;
  }
  function quickSlot(item, where) {
    const slot = el('div', 'quick-slot');
    if (quick && quick.id === item.id && quick.where === where) { slot.append(quickForm(item)); return slot; }
    const b = btn('decide-pill', QUICK_PLAN.open, () => openQuick(item.id, where));
    b.setAttribute('aria-label', '「' + item.title + '」の' + QUICK_PLAN.open);
    b.setAttribute('aria-expanded', 'false');
    quickButtons.set(where + ':' + item.id, b);
    slot.append(b);
    return slot;
  }
  function openQuick(id, where = 'today') {
    if (quick && quick.id === id && quick.where === where) return;
    const go = () => {
      const it = findItem(id);
      if (!it) return;
      const p = planFromItem(it);
      quick = {id, where, planDate: p.planDate, planTime: p.planTime, assignee: p.assignee, other: false, node: null, parts: null};
      for (const sid of Object.values(QUICK_STATUS)) { const st = $(sid); st.textContent = ''; st.className = 'save-status'; }
      renderQuickHosts();
      if (quick && quick.parts) focus(quick.parts.dateSel);
    };
    if (quickDirty()) askDiscard(go); else go();
  }
  // then：閉じたあとにすること（まだ未定の「くわしい画面で決める」）
  function closeQuick(ask, then) {
    if (!quick) return;
    const {id, where} = quick;
    const go = () => {
      if (!quick || quick.id !== id) return;
      quick = null;
      renderQuickHosts();
      focus(quickButtons.get(where + ':' + id));
      if (then) then();
    };
    if (ask && quickDirty()) askDiscard(go); else go();
  }
  // R10-2：select に無い値（60日より先の日付・15分きざみでない時刻）は、その値の選択肢を足してから選ぶ（本物の select は無い値を選べないため）。
  //   ch = {sel, values: Set, optionFor, first}（選択肢は配列とSetで持ち、DOM の options はたどらない）
  function choiceSelect(cls, first, values, labelOf) {
    const sel = el('select', cls);
    const cache = new Map();
    const optionFor = v => { if (!cache.has(v)) { const o = el('option', '', labelOf(v)); o.value = v; cache.set(v, o); } return cache.get(v); };
    const firstOpt = el('option', '', first);
    firstOpt.value = '';
    sel.replaceChildren(firstOpt, ...values.map(optionFor));
    return {sel, values: new Set(values), optionFor, first: firstOpt};
  }
  function ensureChoice(ch, value) {
    if (!value || ch.values.has(value)) return;
    ch.values.add(value);
    ch.sel.replaceChildren(ch.first, ...[...ch.values].sort().map(ch.optionFor));
  }
  function syncQuick() {
    const q = quick, p = q.parts;
    ensureChoice(p.dateCh, q.planDate);
    p.dateSel.value = q.planDate;
    p.date.value = q.planDate;
    ensureChoice(p.timeCh, q.planTime);
    p.timeSel.value = q.planTime;
    p.time.value = q.planTime;
    p.otherBtn.setAttribute('aria-expanded', String(q.other));
    p.otherBox.hidden = !q.other;
    for (const [v, b] of p.who) b.setAttribute('aria-pressed', String(q.assignee === v));
  }
  // 欄は開いたときに1回だけ作り、画面を作り直すときは同じ要素を使う（入力とフォーカスを失わない）。
  function quickForm(item) {
    if (quick.node) { syncQuick(); return quick.node; }
    const where = quick.where;
    const box = el('fieldset', 'quick-plan');
    box.setAttribute('data-for', item.id);
    box.append(el('legend', 'quick-legend', QUICK_PLAN.legend + '：' + item.title));
    // R10-2：見本の「11月15日 ▾」「時刻未定 ▾」。日付は今日から60日分（先頭に「日付未定」）、時刻は15分きざみ（先頭に「時刻未定」）。
    const t = today();
    const dateLabel = d => jaDate(d, t) + (d === t ? '・今日' : d === addDays(t, 1) ? '・明日' : '');
    const dateCh = choiceSelect('quick-date-select', QUICK_PLAN.undated, dateChoices(t), dateLabel);
    const timeCh = choiceSelect('quick-time-select', QUICK_PLAN.untimed, timeChoices(), v => v);
    const dateSel = dateCh.sel, timeSel = timeCh.sel;
    dateSel.oninput = dateSel.onchange = () => { quick.planDate = String(dateSel.value || ''); syncQuick(); };
    timeSel.oninput = timeSel.onchange = () => { quick.planTime = String(timeSel.value || ''); syncQuick(); };
    const ds = el('label', 'field quick-pick is-date'); ds.append(el('span', 'visually-hidden', QUICK_PLAN.date), dateSel);
    const ts = el('label', 'field quick-pick is-time'); ts.append(el('span', 'visually-hidden', QUICK_PLAN.time), timeSel);
    const row = el('div', 'plan-row quick-when');
    row.append(ds, ts);
    // 標準の日付・時刻の入力も残す（「ほかの日を選ぶ」。どちらで選んでも同じ planDate / planTime に入る）。
    const date = el('input', 'quick-date');
    date.type = 'date'; date.min = '2025-01-01'; date.max = '2030-12-31';
    date.oninput = date.onchange = () => { quick.planDate = String(date.value || ''); syncQuick(); };
    const time = el('input', 'quick-time');
    time.type = 'time';
    time.oninput = time.onchange = () => { quick.planTime = String(time.value || ''); syncQuick(); };
    const otherBox = el('div', 'plan-row quick-other-box');
    const dl = el('label', 'field', QUICK_PLAN.otherDate); dl.append(date);
    const tl = el('label', 'field', QUICK_PLAN.otherTime); tl.append(time);
    otherBox.append(dl, tl);
    const otherBtn = btn('link-more quick-other', QUICK_PLAN.other, () => { quick.other = !quick.other; syncQuick(); if (quick.other) focus(date); });
    const whoRow = el('div', 'quick-who-row');
    whoRow.setAttribute('role', 'group');
    whoRow.setAttribute('aria-label', QUICK_PLAN.who);
    whoRow.append(el('span', 'quick-who-label', QUICK_PLAN.who));
    const who = new Map();
    for (const v of ['husband', 'wife', 'both']) {
      // 押した人が選ぶまで、どれも選ばない（自動で入れない）。同じものをもう一度押すと未定にもどる。
      const b = btn('chip quick-who who-' + v, WHO_TEXT[v], () => { quick.assignee = quick.assignee === v ? '' : v; syncQuick(); });
      who.set(v, b);
      whoRow.append(b);
    }
    const err = el('p', 'error quick-error');
    err.setAttribute('role', 'alert');
    const save = btn('big quick-save', QUICK_PLAN.save, saveQuick);
    const cancel = btn('soft-btn quick-cancel', QUICK_PLAN.cancel, () => closeQuick(true));
    const actions = el('div', 'row-actions quick-actions');
    actions.append(save, cancel);
    box.append(row, otherBtn, otherBox, whoRow, err, actions);
    // まだ未定では、今までの「決める」の画面（理由・締切つき）も開ける。
    let more = null;
    if (where === 'undecided') {
      const id = item.id;
      more = btn('link-more quick-more', QUICK_PLAN.more, () => closeQuick(true, () => openPlanner(id)));
      box.append(more);
    }
    quick.node = box;
    quick.parts = {dateSel, timeSel, dateCh, timeCh, date, time, otherBtn, otherBox, who, err, save, cancel, more};
    syncQuick();
    return box;
  }
  function saveQuick() {
    if (!quick || !store) return;
    const it = findItem(quick.id);
    if (!it) return;
    // 詳細の「保存」と同じ処理。メモは今の値をそのまま渡すので書かれない（変わった いつ・誰が だけ）。
    const res = store.saveDetail(it.id, {memo: it.memo || '', ...quickValues()}, it);
    const err = quick.parts.err;
    if (!res.ok) { err.textContent = res.errors[0]; return; }
    err.textContent = '';
    const statusId = QUICK_STATUS[quick.where];
    const st = $(statusId);
    if (res.unchanged) { st.textContent = SAVE_TEXT.unchanged; st.className = 'save-status'; closeQuick(false); return; }
    const id = it.id;
    submit('quick:' + id, res.write, {
      statusId, title: it.title,
      isCurrent: () => Boolean(quick) && quick.id === id,
      onOk: () => { closeQuick(false); toast(SAVE_TEXT.saved); }
    });
  }
  // R10：日付の帯は「11月20日(金)」の形
  function longDate(d) {
    if (!isValidDate(d)) return '';
    const [, m, day] = d.split('-').map(Number);
    return m + '月' + day + '日(' + WEEKDAY(d) + ')';
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
    // R10-2：見本の中央。「‹ 11月20日〜26日 ›」、7日のボタン（日にちを大きく・曜日を下に。土＝青・日＝赤の文字、選んだ日はピンク）。
    const last = days[days.length - 1] || weekStart;
    const sameMonth = weekStart.slice(0, 7) === last.slice(0, 7);
    $('w-range').textContent = jaMonthDay(weekStart, t) + '〜' + (sameMonth ? Number(last.slice(8)) + '日' : jaMonthDay(last, t));
    $('w-tag').textContent = weekStart === t ? '今日から7日間' : jaMonthDay(weekStart, t) + 'から7日間';
    $('w-strip').replaceChildren(...days.map(d => {
      const n = dayEntries(state.items, settings(), d, weekFilter).count;
      const li = el('li', 'day-cell-li');
      const sel = d === weekSel;
      const wd = WEEKDAY(d);
      const b = btn('day-cell' + (sel ? ' is-selected' : '') + (d === t ? ' is-today' : '') + (wd === '土' ? ' is-sat' : wd === '日' ? ' is-sun' : '') + (n ? ' has-items' : ''),
        null, () => { weekSel = d; renderWeek(); });
      b.setAttribute('data-date', d);
      b.setAttribute('aria-pressed', String(sel));
      b.setAttribute('aria-label', jaDate(d, t) + (d === t ? '・今日' : '') + '、' + n + '件');
      b.append(el('span', 'dc-num', String(Number(d.slice(8)))));
      b.append(el('span', 'dc-wd', wd));
      b.append(el('span', 'dc-count visually-hidden', n + '件'));
      if (d === t) b.append(el('span', 'dc-mark visually-hidden', '今日'));
      if (sel) b.append(el('span', 'dc-sel visually-hidden', '選択中'));
      li.append(b);
      return li;
    }));
    for (const f of ['husband', 'wife', 'both']) $('wf-' + f).setAttribute('aria-pressed', String(weekFilter === f));
    $('w-filter-bar').hidden = !weekFilter;
    $('w-filter-state').textContent = weekFilter ? '絞り込み中：担当が「' + {husband: '夫', wife: '妻', both: '2人'}[weekFilter] + '」の項目だけ' : '';
    $('w-day-title').textContent = jaDate(weekSel, t) + (weekSel === t ? '・今日' : '');
    const e = dayEntries(state.items, settings(), weekSel, weekFilter);
    const nodes = [];
    const plans = [...e.timed, ...e.untimed];
    if (!plans.length) nodes.push(el('p', 'empty-text', 'この日の予定は登録されていません'));
    else {
      // 時刻の決まっている予定（時刻順）→ 時刻未定。行は「アイコン・時刻・題名・担当の札」の1行。
      const g = el('div', 'day-sec is-plans');
      g.append(el('h4', 'day-sec-head visually-hidden', 'この日の予定（' + plans.length + '件）'));
      for (const x of plans) g.append(compactRow(x.item, {time: x.time || ''}));
      nodes.push(g);
    }
    if (e.deadlines.length) {
      const g = el('div', 'day-sec is-deadline');
      g.append(el('h4', 'day-sec-head', '締切だけ決まっていること'));
      g.append(el('p', 'small', '予定ではありません。この日が期限（または開始日）の項目です'));
      for (const x of e.deadlines) g.append(deadlineRow(x));
      nodes.push(g);
    }
    $('w-day').replaceChildren(...nodes);
    $('w-decide').hidden = undecidedItems(state.items, settings()).length === 0;
  }

  // ---- まだ未定 ----
  function renderUndecided() {
    const list = undecidedItems(state.items, settings());
    $('u-count').textContent = list.length + '件（期限の近い順、期限なしは最後）';
    $('u-empty').hidden = list.length > 0;
    // R10-2：見本の右。項目ごとのカード：アイコン・題名・札（日付未定／11月15日、担当未定／夫）、ピンクのボタン。
    // ボタンを押すと、その場に「いつ・誰が」（きょうと同じ欄・同じ保存）が開く。
    const t = today();
    if (quick && !findItem(quick.id)) quick = null;   // 項目が消えたときだけ閉じる
    const mine = quick && quick.where === 'undecided' ? quick : null;
    const active = document.activeElement;
    clearQuickButtons('undecided');
    const shown = new Set();
    const rows = list.map(({item, reason}) => {
      shown.add(item.id);
      const li = el('li', 'u-row u-card');
      li.setAttribute('data-id', item.id);
      const main = btn('u-main', null, () => openDetail(item.id));
      const head = el('span', 'u-head');
      const ic = iconImg(item, 'item-icon is-big');
      if (ic) head.append(ic);
      head.append(el('span', 'u-title', item.title));
      main.append(head);
      const meta = el('span', 'u-meta');
      const p = planOf(item);
      meta.append(el('span', 'tag-chip is-date' + (p.planDate ? '' : ' is-open'), p.planDate ? jaMonthDay(p.planDate, t) + (p.planTime ? ' ' + p.planTime : '') : '日付未定'));
      const who = p.assignee ? whoChip('tag-chip is-who', p.assignee) : el('span', 'tag-chip is-who is-open', '担当未定');
      meta.append(who);
      meta.append(el('span', 'u-deadline', deadlineLabel(item, settings()) || '締切 なし'));
      main.append(meta);
      main.setAttribute('aria-label', item.title + '、' + REASON_TEXT[reason] + '、' + (p.planDate ? planWhenLabel(item) : '日付未定') + '、' + whoSpeech(p.assignee) + '、' + (deadlineLabel(item, settings()) || '締切 なし'));
      const open = Boolean(mine) && mine.id === item.id;
      const decide = btn('decide-pill u-decide', decideText(item), () => (open ? closeQuick(true) : openQuick(item.id, 'undecided')));
      decide.setAttribute('aria-label', '「' + item.title + '」の' + decideText(item));
      decide.setAttribute('aria-expanded', String(open));
      quickButtons.set('undecided:' + item.id, decide);
      // R9.1：「決める」の隣に「予定は不要」。押すと印を付ける（行は、印が付いたデータが届いたときに消える）。
      const np = btn('soft-btn noplan-row-btn', NOPLAN.rowBtn, () => setNoPlan(item.id, true, 'row'));
      np.setAttribute('aria-label', '「' + item.title + '」を' + NOPLAN.on);
      if (rowBusy.has(item.id)) np.disabled = true;
      li.append(main, decide, np);
      if (open) li.append(quickSlot(item, 'undecided'));
      return li;
    });
    // 開いている欄の項目が一覧から外れたとき（ほかの端末で決まった等）も、入力は消さずに最後に出す。
    if (mine && !shown.has(mine.id)) {
      const li = el('li', 'u-row u-card is-orphan');
      li.append(quickSlot(findItem(mine.id), 'undecided'));
      rows.push(li);
    }
    $('u-list').replaceChildren(...rows);
    if (mine && mine.node && active && within(mine.node, active)) focus(active);
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
    if (!item.done && p.assignee) meta.append(whoChip('badge who', p.assignee));   // R10-2：夫／妻／2人（名前は出さない）
    const head = el('span', 'row-head');
    const ic = iconImg(item);
    if (ic) head.append(ic);
    head.append(el('span', 'row-title', item.title));
    main.append(head, meta);
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
  // R10-2：担当の選択肢も 夫／妻／2人（家族の名前は設定の画面の中だけで使う）
  function fillAssignee(sel, value) {
    sel.replaceChildren(...[['', '未定'], ['husband', WHO_TEXT.husband], ['wife', WHO_TEXT.wife], ['both', WHO_TEXT.both]]
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
    $('d-summary').textContent = [deadlineLabel(it, s) || '締切 なし', planWhenLabel(it), whoSummary(planOf(it).assignee), stateText(it), ...(noPlan ? [NO_PLAN_TEXT] : [])].join('　');
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
  // キャラクターの一覧は、設定を開いたときに初めて作る。
  // 一度だけ作り、あとはその日の役の札だけを更新する（作り直すとフォーカスが外れ、画像も読み直すため）。
  // R10-4：10体全部を、絵・名前・モチーフで出す（R10-5：名前は確定（2026-11-10 ご本人承認））。「選ぶ」しくみはやめ、その日の役（きょうの主役・1週間 など）を小さく添える。
  //   一覧の子を触ると、その子が反応する（一覧の絵は常時は動かない）。
  const charButtons = new Map();
  function renderCharList() {
    if (tab !== 'more' || morePane !== 'settings') return;
    if (!charListBuilt) {
      charListBuilt = true;
      $('char-list').replaceChildren(...CHARACTERS.map(c => {
        const li = el('li', 'char-li');
        const wrap = el('span', 'char-thumb-wrap');
        const b = btn('char-opt', null, () => motion.tap(wrap, c));
        b.setAttribute('data-char', c.id);
        const img = el('img', 'char-thumb');
        img.alt = ''; img.width = 56; img.height = 56;
        setCharImg(img, c);
        wrap.append(img);
        const parts = [wrap, el('span', 'char-name', c.name), el('span', 'char-item', c.motif)];
        charButtons.set(c.id, {b, parts, role: el('span', 'char-role', ''), c});
        li.append(b);
        return li;
      }));
    }
    const p = place();
    for (const [, {b, parts, role, c}] of charButtons) {
      const where = placeOf(p, c.id);
      role.textContent = where ? PLACE_TEXT[where] : '';
      b.className = 'char-opt' + (where === 'today' ? ' is-today' : '');
      b.setAttribute('aria-label', c.name + '（' + c.motif + '）' + (where ? '、きょうは' + PLACE_TEXT[where] : ''));
      b.replaceChildren(...parts, ...(where ? [role] : []));
    }
  }
  function applyPrefs() {
    prefs = {...resolvePrefs(localPrefs, state.prefs), ...cleanPrefs(prefOverride)};
    motion.setMode(prefs.motion);
    syncIdle();
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
    renderLoginChara();
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
  // R10-4：右上の飾りの子も触れる（いま出ている子の反応を1回）。読み上げでは今までどおり飾り扱い（aria-hidden）。
  for (const k of ['w', 'u', 't', 'a']) { const w = $(k + '-chara-wrap'); if (w) w.onclick = () => { if (!$(k + '-chara').hidden) motion.tap(w, shownChar(k + '-chara')); }; }
  $('more-settings').onclick = () => { morePane = 'settings'; renderTabs(); renderSettings(); };
  $('search-entry').onclick = () => { setTab('todo'); focus($('q')); };
  $('attention-toggle').onclick = () => { attentionOpen = !attentionOpen; renderAttention(); };
  $('attention-more').onclick = () => { attentionAll = !attentionAll; renderAttention(); if (attentionAll) motion.play($('chara-wrap'), 'guide', currentChar()); };
  $('word-full').onclick = () => { wordFull = !wordFull; renderWord(); };
  $('chara-rest').onclick = () => motion.play($('chara-wrap'), 'rest', currentChar());
  $('chara-wrap').onclick = () => motion.tap($('chara-wrap'), shownChar('chara-img'));
  for (const key of ['todo', 'later', 'undated', 'done']) $(key + '-toggle').onclick = () => { expanded[key] = !expanded[key]; renderTodo(); };
  $('q').oninput = () => { query = $('q').value || ''; renderTodo(); };
  $('q-clear').onclick = () => { query = ''; $('q').value = ''; renderTodo(); focus($('q')); };
  $('todo-filter-clear').onclick = () => { query = ''; $('q').value = ''; cat = 'すべて'; todoView = 'all'; renderTodo(); };
  for (const v of ['all', 'open', 'done']) $('v-' + v).onclick = () => { todoView = v; renderTodo(); };
  $('add-btn').onclick = () => openEditor(null);
  $('w-prev').onclick = () => { weekFollow = false; weekStart = addDays(weekStart, -7); weekSel = weekStart; renderWeek(); };
  $('w-next').onclick = () => { weekFollow = false; weekStart = addDays(weekStart, 7); weekSel = weekStart; renderWeek(); };
  $('w-next-more').onclick = () => $('w-next').onclick();   // R10-2：「次の7日を見る」
  $('w-decide').onclick = () => setTab('undecided');        // R10-2：1週間の「日時・担当を決める」→ まだ未定
  $('u-to-week').onclick = () => setTab('week');            // R10-2：「決まった予定は『1週間』で確認」
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
    document.addEventListener('visibilitychange', () => { syncIdle(); if (document.visibilityState !== 'hidden') refreshDay(); });
    // 文字入力中はキャラクターを動かさない。
    document.addEventListener('focusin', e => { if (isField(e && e.target)) blockMotion('typing', true); });
    document.addEventListener('focusout', e => { if (isField(e && e.target)) blockMotion('typing', false); });
  }
  // 画面の外に出たら止める（IntersectionObserver がある端末だけ）。
  if (typeof opts.IntersectionObserver === 'function') {
    try {
      const io = new opts.IntersectionObserver(entries => {
        for (const en of entries) charaInView = Boolean(en.isIntersecting);
        motion.setVisible(tab !== 'today' || charaInView);   // R10-4：ほかのタブの右上の子も触れるように
        syncIdle();
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
    get quickPlanId() { return quick ? quick.id : null; },
    get saveErrors() { return saveErrors.slice(); }
  };
}
