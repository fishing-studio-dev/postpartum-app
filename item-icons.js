// R10-2：項目のアイコン（DOTS 作の WebP 5枚。site/art/ の中、元のファイルとバイトは同じ）。
// 対応表はここ1か所だけ。題名の言葉を上から順に見て、最初に合ったものを使う。合わなければ分類で決める。
// どれにも合わない項目にはアイコンを付けない（null）。絵は飾りなので、画面では alt="" で出す。
export const ICON_FILES = Object.freeze({
  basket: './art/icon_basket.webp',
  pump: './art/icon_pump_bottle.webp',
  toilet: './art/icon_toilet_paper.webp',
  photo: './art/icon_photo.webp',
  documents: './art/icon_documents.webp'
});
// [アイコン, 題名に含まれる言葉]（上から順に調べる。補充 → ポンプのボトル を 日用品 → トイレットペーパー より先に）
export const TITLE_RULES = Object.freeze([
  ['photo', /写真|アルバム/],
  ['pump', /補充|詰め替え|ボトル|ハンドソープ|洗剤|シャンプー/],
  ['toilet', /トイレットペーパー|ティッシュ|日用品/],
  ['basket', /買いもの|買い物|買う|購入|おむつ|ミルク/],
  ['documents', /書類|手続|提出|申請|請求|届|証|マイナンバー|保険/]
]);
// 題名で決まらないときの分類（logic.js の CATEGORIES）。
export const CATEGORY_RULES = Object.freeze({'手続き': 'documents', 'お金': 'documents'});

export function iconKey(item) {
  if (!item) return null;
  const title = String(item.title || '');
  for (const [key, re] of TITLE_RULES) if (re.test(title)) return key;
  return Object.prototype.hasOwnProperty.call(CATEGORY_RULES, item.category) ? CATEGORY_RULES[item.category] : null;
}
export function iconFor(item) {
  const k = iconKey(item);
  return k ? ICON_FILES[k] : null;
}
