// R10-8：予定を順番に決める（フロー）。やることを1つずつ見せて「日にちを入れる／あとで／済み」を選び、最後に一覧で確定する。
//   ここは計算だけ（画面は ui.js、保存は data.js の setPlan / setDone / addItem。今の items の形のまま）。
import {itemDate, isNoPlan, planOf, validatePlan} from './logic.js';

export const FLOW_TEXT = Object.freeze({
  title: '予定を順番に決める',
  again: '予定を順番に見直す',
  add: '＋ 予定を追加',
  date: '日にちを入れる',
  later: 'あとで',
  done: '済み',
  ok: 'この日にする',
  prev: '前へ',
  toSummary: '一覧へ進む',
  confirm: '確定する',
  restart: '最初から見直す',
  change: '変える',
  empty: 'いま決めることはありません。＋で予定を追加できます。',
  summaryNote: '「確定する」を押すと保存します。確定したあとも、いつでも追加・変更できます。',
  confirmed: '確定しました。あとからでも、ここや各項目の画面で追加・変更できます。',
  nothing: '選んだものがありません（「あとで」だけのときは何も保存しません）',
  needDate: '日にちを選んでください',
  addTitle: '予定を追加',
  addSave: '追加する',
  choice: {date: '日にちを入れる', later: 'あとで', done: '済みにする'}
});
export const FLOW_CONFIRMED_KEY = 'sango-flow-confirmed';

const order = it => (typeof it.order === 'number' ? it.order : 1e9);
const tie = (a, b) => order(a) - order(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
// 流れに出す項目：まだ済んでいない・「予定は不要」の印が無いもの。期限の近い順（期限なしは最後、元の順）。
export function flowItems(items, settings) {
  const withDue = [], noDue = [];
  for (const it of items || []) {
    if (!it || it.done || isNoPlan(it)) continue;
    const due = itemDate(it, settings);
    (due ? withDue : noDue).push({it, due});
  }
  withDue.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : tie(a.it, b.it)));
  noDue.sort((a, b) => tie(a.it, b.it));
  return [...withDue, ...noDue].map(x => x.it);
}
// 選んだこと（choice）を確かめる。{kind: 'date', planDate, planTime, assignee} | {kind: 'later'} | {kind: 'done'}
export function checkChoice(c) {
  if (!c || !['date', 'later', 'done'].includes(c.kind)) return {ok: false, errors: ['選んでください']};
  if (c.kind !== 'date') return {ok: true, value: {kind: c.kind}};
  if (!c.planDate) return {ok: false, errors: [FLOW_TEXT.needDate]};
  const p = validatePlan(c);
  return p.ok ? {ok: true, value: {kind: 'date', ...p.value}} : {ok: false, errors: p.errors};
}
// 確定のときに書くもの。'later' は何も書かない。いまと同じ予定なら書かない。
export function flowWrites(choices, items) {
  const out = [];
  for (const [id, c] of choices) {
    const it = (items || []).find(x => x.id === id);
    if (!it) continue;
    if (c.kind === 'done' && !it.done) out.push({id, kind: 'done'});
    if (c.kind === 'date') {
      const now = planOf(it);
      const v = {planDate: c.planDate || null, planTime: c.planTime || null, assignee: c.assignee || null};
      if (now.planDate !== v.planDate || now.planTime !== v.planTime || now.assignee !== v.assignee) out.push({id, kind: 'plan', plan: v});
    }
  }
  return out;
}
