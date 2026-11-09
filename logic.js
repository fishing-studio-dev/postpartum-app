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
