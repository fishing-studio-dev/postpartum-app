// R10-4：日によって変わるキャラの配置。
//   種はその端末のローカルの日付（todayLocal() の 'YYYY-MM-DD'）だけ。Math.random() も UTC の日付も使わない。
//   dayIndex = Math.floor(Date.UTC(年, 月-1, 日) / 86400000)（ローカルの年月日の数字をそのまま使うので、時差の影響を受けない）
//   rotated[i] = MOCHI[(i + dayIndex) % 10]
//   きょう = rotated[0]、1週間 = rotated[1]、まだ未定 = rotated[2]、やること = rotated[3]、アルバム = rotated[4]
//   → 同じ日はいつ開いても同じ配置。日が変わると「きょう」の主役が10体を順番に回る。同じ日の5か所は重ならない。
import {MOCHI} from './chars/registry.js';
import {todayLocal} from './logic.js';

export const PLACES = Object.freeze(['today', 'week', 'undecided', 'todo', 'album']);
export const PLACE_TEXT = Object.freeze({today: 'きょうの主役', week: '1週間', undecided: 'まだ未定', todo: 'やること', album: 'アルバム'});
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayIndexOf(ymd) {
  const p = YMD.exec(String(ymd || ''));
  if (!p) return 0;
  const t = Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3]));
  return Number.isFinite(t) ? Math.floor(t / 86400000) : 0;
}
export function placementFor(ymd, list = MOCHI) {
  const n = list.length;
  const dayIndex = dayIndexOf(ymd);
  const k = ((dayIndex % n) + n) % n;
  const rotated = list.map((_, i) => list[(i + k) % n]);
  const out = {date: String(ymd || ''), dayIndex, rotated: Object.freeze(rotated)};
  PLACES.forEach((place, i) => { out[place] = rotated[i]; });
  return Object.freeze(out);
}
// 端末の時計から（ローカルの日付だけを使う。時刻は関係ない）
export const placementAt = (now = new Date()) => placementFor(todayLocal(now));
// その日にその子が出る場所（無ければ null）
export function placeOf(placement, id) {
  for (const place of PLACES) if (placement[place] && placement[place].id === id) return place;
  return null;
}

// ---- R10-6：きょうに出る3体と、その日の主役 ----
//   3体は、選んだシリーズの中から日付で決まる（rotated[0]・rotated[1]・rotated[2]。同じ日はいつ開いても同じ3体）。
//   主役（大きく出る子）は、その3体の中から「アプリを開くたびに」ランダムに選ぶ（ご本人の希望。日付だけでは決まらない）。
//   random は 0 以上 1 未満を返す関数（app.js が起動のときに渡す。テストでは固定の値）。ここでは乱数を作らない（日付だけ）。
export const TRIO_SIZE = 3;
export function trioFor(ymd, list = MOCHI) {
  return Object.freeze(placementFor(ymd, list).rotated.slice(0, Math.min(TRIO_SIZE, list.length)));
}
export function pickLeadIndex(random, size = TRIO_SIZE) {
  let r = 0;
  try { r = typeof random === 'function' ? Number(random()) : 0; } catch { r = 0; }
  if (!Number.isFinite(r) || r < 0) r = 0;
  return Math.min(size - 1, Math.floor(r * size));
}
// 主役を先頭にした3体（主役・なかま・なかま）。leadIndex は pickLeadIndex() の結果。
export function stageFor(ymd, list, leadIndex) {
  const trio = trioFor(ymd, list);
  const k = ((Number(leadIndex) || 0) % trio.length + trio.length) % trio.length;
  return Object.freeze({date: String(ymd || ''), trio, lead: trio[k], leadIndex: k, friends: Object.freeze(trio.filter((_, i) => i !== k))});
}
