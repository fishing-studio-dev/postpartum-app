// R10-6：夫婦で「ことば」を贈り合う。システムの「今日のことば／今日の気づかい」とは別のもの（ふたりが自分で書いた短い文）。
//   保存先は Firestore の gifts/{id}（ログインできる2人だけ。firestore.rules を参照）。
//   文書に入れるのは text・from・to（'husband' / 'wife'）・createdAt・createdBy（uid）だけ。メール・表示名は入れない。
//   画面には個人名を出さない（「妻からのことば」「夫からのことば」）。
export const GIFT_MAX = 200;
export const GIFT_ROLES = Object.freeze(['husband', 'wife']);
export const GIFT_HISTORY_MAX = 30;
export const GIFT_FROM_LABEL = Object.freeze({wife: '妻からのことば', husband: '夫からのことば'});
export const GIFT_TO_LABEL = Object.freeze({wife: '妻へ贈ることば', husband: '夫へ贈ることば'});
export const GIFT_TEXT = Object.freeze({
  title: 'ふたりのことば',
  open: '言葉を贈る',
  send: '贈る',
  cancel: 'やめる',
  history: 'これまでのことば',
  historyClose: '閉じる',
  none: 'まだ届いていません。届いたらここに出ます',
  sent: '贈りました',
  sending: '贈っています…',
  queued: 'つながったら贈ります',
  failed: '贈れませんでした。もう一度お試しください',
  empty: 'ことばを入れてください',
  tooLong: GIFT_MAX + '文字までです',
  needRole: '夫か妻かを選ぶと、ことばを贈り合えます',
  needLogin: 'ログインすると、夫婦でことばを贈り合えます',
  historyEmpty: 'まだありません',
  notifyTitleWife: '妻からことばが届きました',
  notifyTitleHusband: '夫からことばが届きました',
  notifyBody: '「きょう」の画面で読めます'
});
export const partnerOf = role => (role === 'wife' ? 'husband' : role === 'husband' ? 'wife' : null);
// 文字数は「見た目の1文字」に近い数え方（サロゲートペアを1つと数える）。
export const charCount = text => [...String(text == null ? '' : text)].length;
export function cleanGiftText(text) {
  return String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
}
// 送る前の確認。fromRole はこのアカウントの役割（はっきり選んだもの）。
export function validateGift(text, fromRole) {
  const t = cleanGiftText(text);
  const errors = [];
  if (!GIFT_ROLES.includes(fromRole)) errors.push(GIFT_TEXT.needRole);
  if (!t) errors.push(GIFT_TEXT.empty);
  else if (charCount(t) > GIFT_MAX) errors.push(GIFT_TEXT.tooLong);
  if (errors.length) return {ok: false, errors};
  return {ok: true, errors: [], value: {text: t, from: fromRole, to: partnerOf(fromRole)}};
}
export function giftMs(v) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'number') return v;
  return 0;
}
// 正しい形の文書だけを、新しい順に。
export function sortGifts(list) {
  return (Array.isArray(list) ? list : [])
    .filter(g => g && typeof g.text === 'string' && GIFT_ROLES.includes(g.from) && GIFT_ROLES.includes(g.to))
    .sort((a, b) => giftMs(b.createdAt) - giftMs(a.createdAt) || (a.id < b.id ? 1 : -1));
}
export const receivedGifts = (list, myRole) => sortGifts(list).filter(g => g.to === myRole);
export const latestReceived = (list, myRole) => receivedGifts(list, myRole)[0] || null;
export const giftHistory = (list, max = GIFT_HISTORY_MAX) => sortGifts(list).slice(0, max);
export function giftWhen(createdAt) {
  const ms = giftMs(createdAt);
  if (!ms) return '';
  const d = new Date(ms);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
// 履歴の1行の見出し（「妻から・11月10日」）。名前は出さない。
export function giftHeading(g) {
  const who = g.from === 'wife' ? '妻から' : '夫から';
  const when = giftWhen(g.createdAt);
  return who + (when ? '・' + when : '');
}
