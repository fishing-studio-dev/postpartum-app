// R10-7：DOTS が作った4シリーズ（各10体）の絵。絵は site/art/char_<シリーズ>_NN_<元のファイル名>.webp
//   （元は DOTS の ZIP の透過 PNG。r10-7/convert/convert-r10-7.py で 512x512 の WebP にした。描き直し・色の変更はしていない）。
//   名前：刺しゅうは DOTS の README にある名前（ハリネズミ・リス・子鹿・ウサギ・ネズミ・コマドリ・キツネ・アナグマ・カエル・フクロウ）。
//   フェルト・ドット絵・編みぐるみは DOTS が日本語の名前を付けていないので、画面には名前を出さない（name は空）。
//   id は元のファイル名から作った内部用の値（画面には出さない）。
//   触ったときの反応は、シリーズ1（餅の家族）の10種類を同じ順番で使う（新しい動きは足していない。ポーズの差分の絵は無い）。
import {MOCHI} from './registry.js';

const SAFE_FILE = /^[a-z0-9][a-z0-9_-]*\.webp$/;
const ART_DIR = './art/';
const make = (series, stems, names) => Object.freeze(stems.map((stem, i) => {
  const base = /^\d\d_/.test(stem) ? stem.slice(3) : stem;
  const file = 'char_' + series + '_' + String(i + 1).padStart(2, '0') + '_' + base + '.webp';
  const ok = SAFE_FILE.test(file);
  return Object.freeze({id: series + '-' + base.replace(/_/g, '-'), name: names ? names[i] : '', motif: '', item: '',
    src: ok ? ART_DIR + file : '', kind: ok ? 'webp' : 'none', fallback: null, series, pixel: series === 'pixel',
    action: MOCHI[i].action});
}));

export const FELT = make('felt', ['01_penguin', '02_bear', '03_seal', '04_rabbit', '05_fox', '06_otter', '07_sparrow', '08_cat', '09_dog', '10_owl']);
export const PIXEL = make('pixel', ['01_sprout_heart', '02_clover', '03_cactus', '04_acorn', '05_bellflower', '06_mushroom', '07_fern', '08_radish', '09_sunflower', '10_peapod']);
export const EMBROIDERY = make('embroidery', ['hedgehog', 'squirrel', 'fawn', 'rabbit', 'mouse', 'robin', 'fox', 'badger', 'frog', 'owl'],
  ['ハリネズミ', 'リス', '子鹿', 'ウサギ', 'ネズミ', 'コマドリ', 'キツネ', 'アナグマ', 'カエル', 'フクロウ']);
export const CROCHET = make('crochet', ['01_lamb', '02_bunny', '03_bear', '04_duck', '05_puppy', '06_cat', '07_alpaca', '08_dinosaur', '09_whale', '10_pony']);
export const NEW_SERIES_CHARACTERS = Object.freeze([...FELT, ...PIXEL, ...EMBROIDERY, ...CROCHET]);
