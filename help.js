// R10-8：使い方の説明（はじめて使う人のため）。文はやさしい日本語で短く。医療の判断は書かない。
//   GUIDE_STEPS：はじめて開いたときの案内（キャラが話す形）。tab があれば、その段のあいだ下のタブに印を付ける。
//   HELP_BANDS：各タブの上の短い説明（とじられる）。
export const GUIDE_STEPS = Object.freeze([
  {title: 'はじめまして', text: 'このアプリの使い方を、少しだけ案内します。とちゅうでやめても、設定からもう一度見られます。'},
  {tab: 'today', title: 'きょう', text: '今日と明日にすることが出ます。先に確認することも、ここに出ます。'},
  {tab: 'week', title: '1週間', text: '7日間の予定を見られます。日を押すと、その日の予定が下に出ます。'},
  {tab: 'undecided', title: 'まだ未定', text: '日にちや担当が決まっていないことが出ます。「日時・担当を決める」で決められます。'},
  {tab: 'undecided', title: '予定を順番に決める', text: '「予定を順番に決める」を押すと、やることが1つずつ出ます。「日にちを入れる」「あとで」「済み」から選んで、最後に確定します。'},
  {tab: 'todo', title: 'やること', text: '手続きなどの全部の項目です。押すと、くわしい説明や持ち物が見られます。右下の＋で追加できます。'},
  {tab: 'more', title: 'アルバム・設定', text: '写真を2人で残せます。設定では、使い方の案内をもう一度見たり、入力をリセットしたりできます。'},
  {title: 'これで おしまい', text: 'わからなくなったら、各画面の上の説明か、設定の「使い方をもう一度見る」を見てください。'}
].map(Object.freeze));
export const GUIDE_TEXT = Object.freeze({
  next: 'つぎへ', prev: '前へ', finish: 'はじめる', skip: 'スキップ', again: 'もう一度見る', close: '案内をとじる',
  step: (i, n) => (i + 1) + ' / ' + n
});
export const HELP_BANDS = Object.freeze({
  today: '今日と明日にすることが出ます。項目を押すと、くわしく見られます。',
  week: '7日間の予定です。上の日を押すと、その日の予定が下に出ます。',
  undecided: '日にちか担当がまだのものです。「予定を順番に決める」で1つずつ決められます。',
  todo: '全部の項目です。左の丸で「済み」。右下の＋で追加できます。',
  more: '写真を2人で残せます。設定では、使い方の案内や入力のリセットができます。'
});
export const HELP_BAND_CLOSE = 'この説明をとじる';
export const GUIDE_SEEN_KEY = 'sango-guide-seen';
export const BANDS_KEY = 'sango-help-bands';
// localStorage の読み書き（使えない端末では何もしない）
export function readBands(storage) {
  try { const t = storage ? storage.getItem(BANDS_KEY) : null; const v = t ? JSON.parse(t) : []; return Array.isArray(v) ? v.filter(x => x in HELP_BANDS) : []; } catch { return []; }
}
export function writeBands(storage, list) { try { if (storage) storage.setItem(BANDS_KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function guideSeen(storage) { try { return Boolean(storage) && storage.getItem(GUIDE_SEEN_KEY) === '1'; } catch { return true; } }
export function setGuideSeen(storage, on) { try { if (storage) storage.setItem(GUIDE_SEEN_KEY, on ? '1' : '0'); } catch { /* ignore */ } }
