// R10-6：キャラクターの「シリーズ」（テイスト別に10シリーズ × 各10体 = 100体の器）。
//   いま中身があるのはシリーズ1（いまの10体＝餅の家族10体。名前は確定（2026-11-10 ご本人承認））だけ。
//   シリーズ2〜10はまだ絵が無いので「準備中」（選べない）。シリーズの名前は、ご本人が決めるまで画面に出さない（いまは中立の呼び名だけ）。
//   新しいシリーズを足すときは：絵（art/ の WebP 10枚）と registry の10体を用意し、下の slot の characters に入れ、available を true にする。
import {MOCHI} from './registry.js';
import {FELT, PIXEL, EMBROIDERY, CROCHET} from './series-art.js';
// R10-7：シリーズ2〜5に DOTS の4シリーズを入れた。名前は素材の名前だけ（DOTS の言葉）：フェルト・ドット絵・刺しゅう・編みぐるみ。
//   シリーズ1（いまの10体）は変えていない。既定もシリーズ1のまま。シリーズ6〜10は「準備中」のまま。

export const SERIES_SLOTS = 10;
export const CHARS_PER_SERIES = 10;
export const DEFAULT_SERIES = 'mochi';
export const PENDING_LABEL = '準備中';

const slot = (n, id, label, characters) => Object.freeze({
  n, id, label, characters: Object.freeze([...characters]), available: characters.length === CHARS_PER_SERIES
});
export const SERIES = Object.freeze([
  slot(1, 'mochi', 'いまの10体', MOCHI),
  slot(2, 'felt', 'フェルト', FELT),
  slot(3, 'pixel', 'ドット絵', PIXEL),
  slot(4, 'embroidery', '刺しゅう', EMBROIDERY),
  slot(5, 'crochet', '編みぐるみ', CROCHET),
  ...Array.from({length: SERIES_SLOTS - 5}, (_, i) => slot(i + 6, 'series-' + (i + 6), PENDING_LABEL, []))
]);
// 選べる（中身がそろっている）シリーズだけ。
export const isSeriesId = id => SERIES.some(s => s.id === id && s.available);
export function getSeries(id) {
  return SERIES.find(s => s.id === id && s.available) || SERIES.find(s => s.id === DEFAULT_SERIES);
}
export const seriesCharacters = id => getSeries(id).characters;
