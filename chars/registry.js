// キャラクターの一覧。画像は1体1ファイル（chars/<id>.svg）。
// 差し替え：src を透過 PNG / WebP（例 './chars/rabbit.webp'）に変え、kind を 'png' / 'webp' にするだけでよい（コードの変更は不要）。
// 画像は選んだ1体だけを、表示するときに読み込む（img の src を実行時に入れる）。
// action：その子の「固有の動き」。state はどの場面で使うか（資料6〜9章・action_design_source.json）。
//   css は style.css の @keyframes 名、durationMs はその長さ（1回だけ再生して止まる）。
export const DEFAULT_CHARACTER = 'rabbit';
// 画像を差し替えるときは、ここに1行足すだけ（例）：
//   rabbit: {src: './chars/rabbit.webp', kind: 'webp'},
export const IMAGE_OVERRIDES = Object.freeze({});
const c = (id, name, item, state, label, css, durationMs) => {
  const img = IMAGE_OVERRIDES[id] || {src: './chars/' + id + '.svg', kind: 'svg'};
  return Object.freeze({id, name, item, src: img.src, kind: img.kind, action: Object.freeze({state, label, css, durationMs})});
};
export const CHARACTERS = Object.freeze([
  c('rabbit', 'うさぎ', 'よだれかけ', 'welcome', 'おかえり', 'sig-rabbit', 1800),
  c('hamster', 'ハムスター', '哺乳びん', 'saved', 'ぱちぱち', 'sig-hamster', 1400),
  c('cat', 'ねこ', 'ベビー靴下', 'rest', 'のび〜', 'sig-cat', 2800),
  c('bear', 'くま', 'ガラガラ', 'welcome', 'ぎゅっの気持ち', 'sig-bear', 2200),
  c('seal', 'あざらし', 'おしゃぶり', 'tap', 'ゆらぷる', 'sig-seal', 2400),
  c('chick', 'ひよこ', 'おくるみ', 'saved', 'やったね', 'sig-chick', 1600),
  c('dog', 'いぬ', 'バンダナ', 'welcome', 'しっぽふりふり', 'sig-dog', 2000),
  c('fox', 'きつね', '歯固め', 'guide', 'ちらり', 'sig-fox', 2200),
  c('sheep', 'ひつじ', 'ベビー帽子', 'rest', 'こくり', 'sig-sheep', 2600),
  c('panda', 'パンダ', 'ガラガラ', 'welcome', 'まるっと', 'sig-panda', 2000),
  c('penguin', 'ペンギン', '哺乳びん', 'guide', 'よちよち', 'sig-penguin', 1800),
  c('hedgehog', 'ハリネズミ', 'ベビー靴下', 'tap', 'ぽふっ', 'sig-hedgehog', 1800),
  c('elephant', 'ぞう', 'ベビー帽子', 'guide', 'くるり', 'sig-elephant', 2400),
  c('squirrel', 'りす', 'よだれかけ', 'saved', 'くるん', 'sig-squirrel', 2200),
  c('koala', 'コアラ', 'おしゃぶり', 'tap', '小さなハイタッチ', 'sig-koala', 1800)
]);
export function getCharacter(id) {
  return CHARACTERS.find(x => x.id === id) || CHARACTERS.find(x => x.id === DEFAULT_CHARACTER);
}
export const isCharacterId = id => CHARACTERS.some(x => x.id === id);
