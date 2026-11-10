// キャラクターの一覧。
// R10-4：画面で使うのは「餅の家族」10体だけ（MOCHI。順番もこのとおり）。絵は site/art/char_mochi_v4_*.webp（元のファイルとバイトは同じ）。
//   名前は確定（2026-11-10 ご本人承認）。
//   どの子をどこに出すかは placement.js（その端末のローカルの日付で決まる。選ぶしくみはやめた）。
//   action：触ったときの短い反応（state は 'tap'）。css は style.css の @keyframes 名、durationMs はその長さ（1回だけ再生して止まる）。
//   絵が読み込めないときは SVG に戻さず、絵を隠す（fallback: null。10体には SVG が無いため）。
// R9〜R10-3 の15体（うさぎ・くま など）は LEGACY_CHARACTERS に残す（画面では使わない。chars/*.svg も残す）。
export const DEFAULT_CHARACTER = 'hana';
// R10-2：絵の差し替えは「キャラの id → art/ の中のファイル名」を1行足すだけ。
//   書き方：  <id>: '<art/ に置いたファイル名>.webp',   （.png も可）
//   ファイルは site/art/ に置く。ここに書いていない子は chars/<id>.svg のまま。
//   絵が読み込めなかったとき（ファイルが無い等）は、画面がその子の SVG（fallback）に一度だけ戻す。
// R10：DOTS 作の透過 WebP（site/art/。元のファイルとバイトは同じ）を3体に使う。ほかの12体は SVG のまま。
// R10-3 プレビュー：最後のZIP（餅の家族10体）の主役＋仲間2体。
//   rabbit＝花と葉（主役・きょうの既定）、bear＝雨雲（仲間1・1週間の右上）、hamster＝洋梨（仲間2・まだ未定の右上）。
//   R10 の3枚（char_rabbit_apricot / char_bear_lavender / char_hamster_honey）は art/ に残してある。
// R10-4：この一覧は LEGACY_CHARACTERS（使わなくなった15体）用に残しているだけ。
export const IMAGE_OVERRIDES = Object.freeze({
  rabbit: 'char_mochi_flower.webp',
  bear: 'char_mochi_raincloud.webp',
  hamster: 'char_mochi_pear.webp'
});
export const ART_DIR = './art/';
export const svgSrc = id => './chars/' + id + '.svg';
// ファイル名だけを受け付ける（フォルダーや外のアドレスは使わない）。合わないものは無視して SVG のまま。
const SAFE_FILE = /^[a-z0-9][a-z0-9_-]*\.(webp|png)$/i;
export function overrideFor(id, overrides = IMAGE_OVERRIDES) {
  const f = Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : null;
  return typeof f === 'string' && SAFE_FILE.test(f) ? f : null;
}

// ---- R10-4：餅の家族10体（名前は確定（2026-11-10 ご本人承認）） ----
const m = (id, name, motif, file, label, css, durationMs) => {
  const ok = SAFE_FILE.test(file);
  return Object.freeze({id, name, motif, item: motif, src: ok ? ART_DIR + file : '', kind: ok ? file.split('.').pop().toLowerCase() : 'none', fallback: null,
    action: Object.freeze({state: 'tap', label, css, durationMs})});
};
export const MOCHI = Object.freeze([
  m('hana', 'はなっぱ', '花と葉', 'char_mochi_v4_01_flower.webp', 'ゆらゆら', 'mochi-yurayura', 900),
  m('amagumo', 'あまぐも', '雨雲', 'char_mochi_v4_02_raincloud.webp', 'ふわっと浮く', 'mochi-fuwa', 900),
  m('nashi', 'ようなし', '洋梨', 'char_mochi_v4_03_pear.webp', 'ぼよん', 'mochi-boyon', 800),
  m('yozora', 'よぞら', '夜空', 'char_mochi_v4_04_nightstar.webp', 'くるっと小さく揺れる', 'mochi-kurutto', 900),
  m('kaigara', 'かいがら', '貝殻', 'char_mochi_v4_05_shell.webp', 'ぱかっ', 'mochi-paka', 700),
  m('donguri', 'どんぐり', 'どんぐり', 'char_mochi_v4_06_acorn.webp', 'ころん', 'mochi-koron', 900),
  m('fukurou', 'ふくろう', 'ふくろう', 'char_mochi_v4_07_owl.webp', 'ぱたぱた', 'mochi-patapata', 800),
  m('shida', 'しだ', 'シダ', 'char_mochi_v4_08_fern.webp', 'のびっ', 'mochi-nobi', 800),
  m('minamo', 'みなも', '水面と小石', 'char_mochi_v4_09_ripple.webp', 'ぷるん', 'mochi-purun', 800),
  m('kitsune', 'きつね', 'きつね', 'char_mochi_v4_10_fox.webp', 'ぴょん', 'mochi-pyon', 800)
]);
// 画面で使う一覧（R10-4：10体だけ）
export const CHARACTERS = MOCHI;

// ---- R9〜R10-3 の15体（使わない。定義と chars/*.svg は消さずに残す） ----
const c = (id, name, item, state, label, css, durationMs) => {
  const file = overrideFor(id);
  const fallback = svgSrc(id);
  return Object.freeze({id, name, item, src: file ? ART_DIR + file : fallback, kind: file ? file.split('.').pop().toLowerCase() : 'svg', fallback,
    action: Object.freeze({state, label, css, durationMs})});
};
export const LEGACY_DEFAULT = 'rabbit';
export const LEGACY_CHARACTERS = Object.freeze([
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
// 10体から探す。見つからなければ古い15体（古いテスト・古い保存値のため）、それも無ければ既定（はなっぱ）。
export function getCharacter(id) {
  return MOCHI.find(x => x.id === id) || LEGACY_CHARACTERS.find(x => x.id === id) || MOCHI.find(x => x.id === DEFAULT_CHARACTER);
}
export const getLegacyCharacter = id => LEGACY_CHARACTERS.find(x => x.id === id) || LEGACY_CHARACTERS.find(x => x.id === LEGACY_DEFAULT);
// prefs.character の古い保存値（rabbit など）も「正しい値」として残す（画面の配置には使わないので壊れない）。
export const isCharacterId = id => MOCHI.some(x => x.id === id) || LEGACY_CHARACTERS.some(x => x.id === id);
