// 純粋なロジック（DOM・Firebase なし。Node でもそのまま動く）。
export const DUE_DATE = '2026-11-17';
export const CATEGORIES = ['手続き', '健診', '予防接種', 'お金', '準備', '確認'];
export const LIMITS = {title: 80, memo: 2000, documents: 30, docText: 200, place: 200, url: 500};

// 小文字のメールアドレスの SHA-256（16進）。平文は置かない。
export const ALLOWED_EMAIL_SHA256 = Object.freeze([
  '7bca7d2d34dec8698539177eb655c73fc86378ef6752cc1fc1d802434e413914',
  'f018b77911425e9606f4a36c1637d9c8ebdf778e292e0f168116e676fa52013b'
]);

// 国民の祝日（振替休日・国民の休日を含む）2026–2027。月日 MMDD。
const HOLIDAYS = {
  2026: ['0101', '0112', '0211', '0223', '0320', '0429', '0503', '0504', '0505', '0506', '0720', '0811', '0921', '0922', '0923', '1012', '1103', '1123'],
  2027: ['0101', '0111', '0211', '0223', '0321', '0322', '0429', '0503', '0504', '0505', '0719', '0811', '0920', '0923', '1011', '1103', '1123']
};
const WEEK = '日月火水木金土';
const pad = n => String(n).padStart(2, '0');

// ---- dates ----
export function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 1900 || y > 2199 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return {y, m, d};
}
export const isValidDate = s => parseDate(s) !== null;
export function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function fromUTC(t) { const x = new Date(t); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); }
function toUTC(s) { const p = parseDate(s); return Date.UTC(p.y, p.m - 1, p.d); }
export function addDays(s, n) { return fromUTC(toUTC(s) + n * 86400000); }
// 年・月を足す。月末を超える日は月末にそろえる（例: 12/31 + 2か月 = 2/28）。
export function addMonths(s, n) {
  const p = parseDate(s);
  const idx = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(idx / 12), m = idx - y * 12 + 1;
  return y + '-' + pad(m) + '-' + pad(Math.min(p.d, daysInMonth(y, m)));
}
export function weekday(s) { return new Date(toUTC(s)).getUTCDay(); }
export function isHoliday(s) { const p = parseDate(s); return (HOLIDAYS[p.y] || []).includes(pad(p.m) + pad(p.d)); }
export function isClosedDay(s) {
  const p = parseDate(s), w = weekday(s);
  if (w === 0 || w === 6) return true;
  if ((p.m === 12 && p.d >= 29) || (p.m === 1 && p.d <= 3)) return true;
  return isHoliday(s);
}
export function rollToOpenDay(s) { let d = s; while (isClosedDay(d)) d = addDays(d, 1); return d; }
export function todayLocal(now = new Date()) { return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()); }
export function formatShort(s) { const p = parseDate(s); return p ? p.m + '/' + p.d + '(' + WEEK[weekday(s)] + ')' : ''; }
export function formatMD(date) { return (date.getMonth() + 1) + '/' + date.getDate(); }

// ---- calc → date ----
// calc: {base:'birth'|'due', years?, months?, days?, rollToOpenDay?, kind?:'by'|'from'} | {base:'fixed', date, kind?} | null
// 'birth' は出生日（未入力なら予定日）、'due' はいつも予定日。年→月→日の順に足す。
export function baseDate(settings) {
  const s = settings || {};
  return {birth: isValidDate(s.birthDate) ? s.birthDate : (isValidDate(s.dueDate) ? s.dueDate : DUE_DATE), due: isValidDate(s.dueDate) ? s.dueDate : DUE_DATE};
}
export function computeDue(calc, settings) {
  if (!calc || typeof calc !== 'object') return null;
  let d;
  if (calc.base === 'fixed') d = isValidDate(calc.date) ? calc.date : null;
  else if (calc.base === 'birth' || calc.base === 'due') {
    d = baseDate(settings)[calc.base];
    if (calc.years) d = addMonths(d, 12 * calc.years);
    if (calc.months) d = addMonths(d, calc.months);
    if (calc.days) d = addDays(d, calc.days);
  } else return null;
  if (d && calc.rollToOpenDay) d = rollToOpenDay(d);
  return d;
}
export function itemDate(item, settings) {
  if (item && isValidDate(item.dateOverride)) return item.dateOverride;
  return computeDue(item && item.calc, settings);
}
export function dateKind(item) { return item && item.calc && item.calc.kind === 'from' && !isValidDate(item.dateOverride) ? 'from' : 'by'; }
export function dateLabel(item, settings) {
  const d = itemDate(item, settings);
  if (!d) return '';
  return formatShort(d) + (dateKind(item) === 'from' ? 'から' : 'まで');
}
// 例: vac-irai「大村に戻るのが 1/17(日) より後なら必要」
export function conditionLabel(item, settings) {
  if (!item || !item.ifReturnAfter) return '';
  const d = computeDue(item.ifReturnAfter, settings);
  return d ? '大村に戻るのが' + formatShort(d) + 'より後の場合だけ必要' : '';
}
export function isOverdue(item, settings, today) {
  if (!item || item.done || dateKind(item) === 'from') return false;
  const d = itemDate(item, settings);
  return Boolean(d) && d < today;
}

// ---- list ----
const catIndex = c => { const i = CATEGORIES.indexOf(c); return i < 0 ? CATEGORIES.length : i; };
const ord = it => (typeof it.order === 'number' ? it.order : 100000);
function tie(a, b) { return ord(a) - ord(b) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
export function groupItems(items, settings, today, category = 'すべて') {
  const list = (items || []).filter(it => category === 'すべて' || it.category === category);
  const overdue = [], dated = [], undated = [], done = [];
  for (const it of list) {
    if (it.done) done.push(it);
    else if (isOverdue(it, settings, today)) overdue.push(it);
    else if (itemDate(it, settings)) dated.push(it);
    else undated.push(it);
  }
  const byDate = (a, b) => { const x = itemDate(a, settings), y = itemDate(b, settings); return x < y ? -1 : x > y ? 1 : tie(a, b); };
  overdue.sort(byDate); dated.sort(byDate);
  undated.sort((a, b) => catIndex(a.category) - catIndex(b.category) || tie(a, b));
  done.sort((a, b) => doneTime(b) - doneTime(a) || tie(a, b));
  return {overdue, dated, undated, done};
}
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  return null;
}
function doneTime(it) { const d = toDate(it.doneAt); return d ? d.getTime() : 0; }
export function shortName(name) {
  const s = String(name || '').trim().split(/\s+/)[0] || '';
  return s ? Array.from(s).slice(0, 8).join('') : 'だれか';
}
export function doneLabel(item) {
  if (!item || !item.done) return '';
  const who = shortName(item.doneBy && item.doneBy.name);
  const at = toDate(item.doneAt);
  return who + 'さん' + (at ? ' ' + formatMD(at) : '') + ' 完了';
}

// ---- allowlist ----
export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
export async function isAllowedEmail(email, hashFn = sha256Hex) {
  if (typeof email !== 'string' || !email.includes('@')) return false;
  const h = await hashFn(email.trim().toLowerCase());
  return ALLOWED_EMAIL_SHA256.includes(h);
}
export async function isAllowedUser(user, hashFn = sha256Hex) {
  if (!user || user.emailVerified !== true) return false;
  return isAllowedEmail(user.email, hashFn);
}

// ---- validation ----
export function isHttpsUrl(url) {
  if (typeof url !== 'string' || url === '') return false;
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
export function validateItem(input) {
  const errors = [];
  const v = input || {};
  const title = typeof v.title === 'string' ? v.title.trim() : '';
  if (title.length < 1) errors.push('タイトルを入れてください');
  if (Array.from(title).length > LIMITS.title) errors.push('タイトルは80文字まで');
  if (!CATEGORIES.includes(v.category)) errors.push('分類を選んでください');
  const memo = typeof v.memo === 'string' ? v.memo : '';
  if (Array.from(memo).length > LIMITS.memo) errors.push('メモは2000文字まで');
  const place = typeof v.place === 'string' ? v.place.trim() : '';
  if (Array.from(place).length > LIMITS.place) errors.push('場所は200文字まで');
  const docs = Array.isArray(v.documents) ? v.documents.map(x => String(x).trim()).filter(Boolean) : [];
  if (docs.length > LIMITS.documents) errors.push('持ち物は30個まで');
  if (docs.some(x => Array.from(x).length > LIMITS.docText)) errors.push('持ち物は1つ200文字まで');
  const dateOverride = v.dateOverride === '' || v.dateOverride == null ? null : v.dateOverride;
  if (dateOverride !== null && !isValidDate(dateOverride)) errors.push('日付が正しくありません');
  const sourceUrl = typeof v.sourceUrl === 'string' ? v.sourceUrl.trim() : '';
  if (sourceUrl && (!isHttpsUrl(sourceUrl) || sourceUrl.length > LIMITS.url)) errors.push('リンクは https:// で始まるアドレス');
  return {ok: errors.length === 0, errors, value: {title, category: v.category, memo, place, documents: docs, dateOverride, sourceUrl}};
}
export function validateBirthDate(s) {
  if (s === null || s === '') return {ok: true, value: null};
  const p = parseDate(s);
  if (!p || p.y < 2025 || p.y > 2028) return {ok: false, value: null};
  return {ok: true, value: s};
}

// ---- seed ----
// seedData: site/seed-data.js の SEED_ITEMS。Firestore にそのまま書ける形にする。
export function buildSeed(seedData) {
  return seedData.map((s, i) => ({
    id: s.id,
    data: {
      title: s.title,
      category: s.category,
      calc: s.calc || null,
      dateOverride: null,
      place: s.place || '',
      documents: (s.documents || []).slice(),
      note: s.note || '',
      memo: '',
      sourceUrl: s.sourceUrl || '',
      confidence: s.confidence || '',
      rule: s.rule || '',
      tag: s.tag || '',
      ifReturnAfter: s.ifReturnAfter || null,
      order: (i + 1) * 10,
      done: false,
      doneBy: null,
      doneAt: null,
      custom: false
    }
  }));
}
export function newId(rand = globalThis.crypto) {
  const b = new Uint8Array(8);
  rand.getRandomValues(b);
  return 'c' + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

// ==== R8 ====
export const SEED_VERSION = 2;
export const ASSIGNEES = ['husband', 'wife', 'both'];
export const ROLES = ['husband', 'wife'];
export const NAME_MAX = 20;
export const NOTE_MAX = 30;

export function formatMonthDay(s) { const p = parseDate(s); return p ? p.m + '/' + p.d : ''; }
export function isValidTime(t) { return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
export function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }

// ---- 予定（いつ・誰が） ----
// planDate 'YYYY-MM-DD' | null, planTime 'HH:MM' | null（日付があるときだけ）, assignee 'husband'|'wife'|'both'|null
export function validatePlan(input) {
  const v = input || {};
  const errors = [];
  const planDate = v.planDate === '' || v.planDate == null ? null : v.planDate;
  const planTime = v.planTime === '' || v.planTime == null ? null : v.planTime;
  const assignee = v.assignee === '' || v.assignee == null ? null : v.assignee;
  if (planDate !== null && (!isValidDate(planDate) || planDate < '2025-01-01' || planDate > '2030-12-31')) errors.push('日付が正しくありません');
  if (planTime !== null && !isValidTime(planTime)) errors.push('時刻が正しくありません');
  if (planTime !== null && planDate === null) errors.push('時刻は日付といっしょに入れてください');
  if (assignee !== null && !ASSIGNEES.includes(assignee)) errors.push('誰がを選んでください');
  return {ok: errors.length === 0, errors, value: {planDate, planTime, assignee}};
}
// 古い（R7の）項目には planDate などが無い → null として扱う。
export function planOf(item) {
  const it = item || {};
  return {
    planDate: isValidDate(it.planDate) ? it.planDate : null,
    planTime: isValidDate(it.planDate) && isValidTime(it.planTime) ? it.planTime : null,
    assignee: ASSIGNEES.includes(it.assignee) ? it.assignee : null
  };
}
export function cleanName(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f{}]/g, '').trim(); }
export function assigneeLabel(assignee, family) {
  const f = family || {};
  if (assignee === 'husband') return cleanName(f.husbandName) || '夫';
  if (assignee === 'wife') return cleanName(f.wifeName) || '妻';
  if (assignee === 'both') return '2人';
  return '';
}
// 例:「11/20(金) 10:00・{夫の名前}」（名前が無ければ 夫／妻／2人）
export function planLabel(item, family) {
  const p = planOf(item);
  const when = p.planDate ? formatShort(p.planDate) + (p.planTime ? ' ' + p.planTime : '') : '';
  const who = assigneeLabel(p.assignee, family);
  return [when, who].filter(Boolean).join('・');
}
// 予定日（planDate）があればそれ、無ければ期限。
export function effectiveDate(item, settings) { return planOf(item).planDate || itemDate(item, settings); }

// ---- 今日・明日・もうすぐ ----
export function upcoming(items, settings, today) {
  const out = {overdue: [], today: [], tomorrow: [], soon: []};
  if (!isValidDate(today)) return out;
  const t1 = addDays(today, 1), t3 = addDays(today, 3);
  for (const it of items || []) {
    if (!it || it.done) continue;
    const p = planOf(it);
    const d = p.planDate || itemDate(it, settings);
    if (!d) continue;
    const entry = {id: it.id, title: it.title, date: d, time: p.planTime, assignee: p.assignee, planned: Boolean(p.planDate),
      kind: p.planDate ? 'plan' : dateKind(it)};
    if (d < today) { if (p.planDate || dateKind(it) !== 'from') out.overdue.push(entry); }
    else if (d === today) out.today.push(entry);
    else if (d === t1) out.tomorrow.push(entry);
    else if (d <= t3) out.soon.push(entry);
  }
  const by = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : a.id < b.id ? -1 : 1);
  for (const k of Object.keys(out)) out[k].sort(by);
  return out;
}

// ---- 一覧（さがす・グループ） ----
const norm = s => String(s == null ? '' : s).normalize('NFKC').toLowerCase();
export function matchesQuery(item, query) {
  const q = norm(query).trim();
  if (!q) return true;
  const it = item || {};
  const hay = norm([it.title, it.place, it.memo, it.note, it.rule, it.category, it.tag, ...(it.documents || [])].join('\n'));
  return q.split(/\s+/).every(w => hay.includes(w));
}
export const SOON_DAYS = 14;
// overdue / soon（14日以内） / later / undated / done
export function sectionItems(items, settings, today, opts = {}) {
  const category = opts.category || 'すべて';
  const list = (items || []).filter(it => (category === 'すべて' || it.category === category) && matchesQuery(it, opts.query));
  const out = {overdue: [], soon: [], later: [], undated: [], done: []};
  const limit = isValidDate(today) ? addDays(today, SOON_DAYS) : '';
  const sortDate = it => itemDate(it, settings) || planOf(it).planDate;
  for (const it of list) {
    if (it.done) out.done.push(it);
    else if (isOverdue(it, settings, today)) out.overdue.push(it);
    else if (sortDate(it)) (sortDate(it) <= limit ? out.soon : out.later).push(it);
    else out.undated.push(it);
  }
  const byDate = (a, b) => { const x = sortDate(a), y = sortDate(b); return x < y ? -1 : x > y ? 1 : tie(a, b); };
  out.overdue.sort(byDate); out.soon.sort(byDate); out.later.sort(byDate);
  out.undated.sort((a, b) => catIndex(a.category) - catIndex(b.category) || tie(a, b));
  out.done.sort((a, b) => doneTime(b) - doneTime(a) || tie(a, b));
  return out;
}

// ---- 出生 ----
// 生まれた日を1日目として数える。今日が出生日より前なら null。
export function birthDayNumber(birthDate, today) {
  if (!isValidDate(birthDate) || !isValidDate(today)) return null;
  const n = daysBetween(birthDate, today) + 1;
  return n >= 1 ? n : null;
}
export function validateBirth(date, time, today) {
  const errors = [];
  const d = date === '' || date == null ? null : date;
  const t = time === '' || time == null ? null : time;
  if (d === null) return {ok: t === null, errors: t === null ? [] : ['時刻は日付といっしょに入れてください'], value: {birthDate: null, birthTime: null}};
  if (!validateBirthDate(d).ok) errors.push('日付が正しくありません');
  else if (isValidDate(today) && d > today) errors.push('まだ来ていない日は入れられません');
  if (t !== null && !isValidTime(t)) errors.push('時刻が正しくありません');
  return {ok: errors.length === 0, errors, value: {birthDate: d, birthTime: t}};
}

// ---- 家族 ----
// family: {husbandName, wifeName, bigName, bigNote, babyName, roles: {<sha256(小文字メール)>: 'husband'|'wife'}}
export function validateFamily(input) {
  const v = input || {};
  const errors = [];
  const value = {
    husbandName: cleanName(v.husbandName), wifeName: cleanName(v.wifeName), bigName: cleanName(v.bigName),
    bigNote: cleanName(v.bigNote), babyName: cleanName(v.babyName)
  };
  for (const k of ['husbandName', 'wifeName', 'bigName', 'babyName']) if (Array.from(value[k]).length > NAME_MAX) { errors.push('名前は20文字まで'); break; }
  if (Array.from(value.bigNote).length > NOTE_MAX) errors.push('上の子のことは30文字まで');
  const role = v.role;
  if (!ROLES.includes(role)) errors.push('このアカウントが夫か妻かを選んでください');
  return {ok: errors.length === 0, errors, value, role: ROLES.includes(role) ? role : null};
}
// 自分の役割。自分の分が無ければ、もう1人の役割から反対を推定する。
export function resolveRole(family, myHash) {
  const roles = (family && family.roles && typeof family.roles === 'object') ? family.roles : {};
  if (myHash && ROLES.includes(roles[myHash])) return {role: roles[myHash], inferred: false};
  const others = Object.entries(roles).filter(([k, r]) => k !== myHash && ROLES.includes(r)).map(([, r]) => r);
  if (others.length === 1) return {role: others[0] === 'husband' ? 'wife' : 'husband', inferred: true};
  return {role: null, inferred: false};
}
// 端末の時計で、次の 0:00 までのミリ秒（日付が変わったら画面を作り直すため）。
export function msUntilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}
export function hhmm(now = new Date()) { return pad(now.getHours()) + ':' + pad(now.getMinutes()); }
// 出生カードの状態。before: まだ（予定日を小さく表示） / after: 生まれて N日目
export function birthCard(settings, today) {
  const s = settings || {};
  if (!isValidDate(s.birthDate)) return {state: 'before', due: formatMonthDay(isValidDate(s.dueDate) ? s.dueDate : DUE_DATE)};
  const n = birthDayNumber(s.birthDate, today);
  return {state: 'after', day: n, date: formatShort(s.birthDate), time: isValidTime(s.birthTime) ? s.birthTime : null};
}
// 言葉の差し込み用（実名は端末の中で Firestore から読んだものだけ）。
export function wordContext(family, settings, today) {
  const f = family || {};
  const n = birthDayNumber(settings && settings.birthDate, today);
  return {
    wife: cleanName(f.wifeName) || 'ママ',
    husband: cleanName(f.husbandName) || 'パパ',
    big: cleanName(f.bigName) || '上の子',
    baby: cleanName(f.babyName) || '赤ちゃん',
    daytext: n ? '生まれて' + n + '日目。' : ''
  };
}

// ==== R9（5つのタブ） ====
// 予定日（planDate：利用者が決める）と期限（itemDate：参照する情報）は、いつも別の言葉で表示する。
export function deadlineLabel(item, settings) {
  const d = itemDate(item, settings);
  if (!d) return '';
  return dateKind(item) === 'from' ? '開始 ' + formatShort(d) + 'から' : '締切 ' + formatShort(d) + 'まで';
}
export function planWhenLabel(item) {
  const p = planOf(item);
  if (!p.planDate) return '予定 未定';
  return '予定 ' + formatShort(p.planDate) + ' ' + (p.planTime || '時刻未定');
}
export function assigneeText(item, family) {
  const a = assigneeLabel(planOf(item).assignee, family);
  return '担当 ' + (a || '未定');
}
export const stateText = item => (item && item.done ? '済み' : '未完了');

const byDateTime = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || ((a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : 0) || tie(a.item, b.item);

// きょう：今日・明日・もうすぐ（3日以内）。予定日があればその日、無ければ期限の日。済みも「済み」として出す。
export const SOON_AHEAD = 3;
export function todayGroups(items, settings, today) {
  const out = {today: [], tomorrow: [], soon: []};
  if (!isValidDate(today)) return out;
  const t1 = addDays(today, 1), t3 = addDays(today, SOON_AHEAD);
  for (const it of items || []) {
    if (!it) continue;
    const p = planOf(it);
    const date = p.planDate || itemDate(it, settings);
    if (!date || date < today || date > t3) continue;
    const e = {item: it, date, time: p.planDate ? p.planTime : null, planned: Boolean(p.planDate)};
    (date === today ? out.today : date === t1 ? out.tomorrow : out.soon).push(e);
  }
  for (const k of Object.keys(out)) out[k].sort(byDateTime);
  return out;
}

// きょうの「確認が必要なこと」：締切を過ぎた未完了、締切が近い（3日以内）未完了。開始日（から）は含めない。
export function attentionItems(items, settings, today) {
  const overdue = [], soon = [];
  if (!isValidDate(today)) return [];
  const t3 = addDays(today, SOON_AHEAD);
  for (const it of items || []) {
    if (!it || it.done || dateKind(it) === 'from') continue;
    const d = itemDate(it, settings);
    if (!d) continue;
    if (d < today) overdue.push({item: it, kind: 'overdue', date: d});
    else if (d <= t3) soon.push({item: it, kind: 'soon', date: d});
  }
  const by = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : tie(a.item, b.item));
  return [...overdue.sort(by), ...soon.sort(by)];
}

// 1週間
export function weekDays(start) { return isValidDate(start) ? Array.from({length: 7}, (_, i) => addDays(start, i)) : []; }
export const WEEKDAY = d => WEEK[weekday(d)];
export const ASSIGNEE_FILTERS = ['husband', 'wife', 'both'];
// 選んだ日：予定日がその日の項目（時刻あり／時刻未定）と、予定日が無く期限がその日の項目（締切。予定には見せない）。
// filter: 'husband' | 'wife' | 'both' | null（担当がちょうどその値の項目だけ）
export function dayEntries(items, settings, date, filter = null) {
  const timed = [], untimed = [], deadlines = [];
  for (const it of items || []) {
    if (!it) continue;
    const p = planOf(it);
    if (filter && p.assignee !== filter) continue;
    if (p.planDate === date) (p.planTime ? timed : untimed).push({item: it, date, time: p.planTime});
    else if (!p.planDate && itemDate(it, settings) === date) deadlines.push({item: it, date, time: null, kind: dateKind(it)});
  }
  timed.sort(byDateTime); untimed.sort(byDateTime); deadlines.sort(byDateTime);
  return {timed, untimed, deadlines, count: timed.length + untimed.length + deadlines.length};
}

// まだ未定：未完了 かつ（予定日が無い または 担当が無い）。1項目1行。時刻だけ未定は含めない。
export const REASON_TEXT = Object.freeze({date: '日付を決める', assignee: '担当を決める', both: '両方を決める'});
export function undecidedReason(item) {
  const p = planOf(item);
  if (!p.planDate && !p.assignee) return 'both';
  if (!p.planDate) return 'date';
  if (!p.assignee) return 'assignee';
  return null;
}
// 並び：期限のあるもの（近い順）→ 期限の無いもの。
export function undecidedItems(items, settings) {
  const withDue = [], noDue = [];
  for (const it of items || []) {
    if (!it || it.done) continue;
    const reason = undecidedReason(it);
    if (!reason) continue;
    const due = itemDate(it, settings);
    (due ? withDue : noDue).push({item: it, reason, due});
  }
  withDue.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : tie(a.item, b.item)));
  noDue.sort((a, b) => tie(a.item, b.item));
  return [...withDue, ...noDue];
}

// やること：時期ごとのまとまり＋「全件／未完了／済み」。view: 'all' | 'open' | 'done'
export const TODO_VIEWS = ['all', 'open', 'done'];
export function todoSections(items, settings, today, opts = {}) {
  const s = sectionItems(items, settings, today, opts);
  const view = TODO_VIEWS.includes(opts.view) ? opts.view : 'all';
  const near = [...s.overdue, ...s.soon];
  const out = {
    near: view === 'done' ? [] : near,
    later: view === 'done' ? [] : s.later,
    undated: view === 'done' ? [] : s.undated,
    done: view === 'open' ? [] : s.done,
    overdueIds: new Set(s.overdue.map(i => i.id))
  };
  out.total = out.near.length + out.later.length + out.undated.length + out.done.length;
  return out;
}
export const PERIOD_TEXT = Object.freeze({near: '期限切れ・2週間以内', later: '先の予定', undated: '日付なし', done: '済み'});
