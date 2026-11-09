// 自分だけの設定（キャラクター・動き）。Firestore の prefs/{sha256(小文字メール)} に merge で保存し、端末の localStorage にも控える。
// meta/settings・meta/family には書かない（2人の共有データを変えないため）。
import {isCharacterId, DEFAULT_CHARACTER} from './chars/registry.js';
import {MOTION_MODES} from './motion.js';

export const PREFS_KEY = 'sango-prefs';
export const DEFAULT_PREFS = Object.freeze({character: DEFAULT_CHARACTER, motion: 'standard'});
// 正しい値だけを残す（知らない項目は捨てる）。
export function cleanPrefs(input) {
  const v = input && typeof input === 'object' ? input : {};
  const out = {};
  if (isCharacterId(v.character)) out.character = v.character;
  if (MOTION_MODES.includes(v.motion)) out.motion = v.motion;
  return out;
}
// 既定値 ← 端末の控え ← Firestore の値 の順に重ねる。
export function resolvePrefs(local, remote) { return {...DEFAULT_PREFS, ...cleanPrefs(local), ...cleanPrefs(remote)}; }
export function readLocalPrefs(storage) {
  try { const t = storage ? storage.getItem(PREFS_KEY) : null; return t ? cleanPrefs(JSON.parse(t)) : {}; } catch { return {}; }
}
export function writeLocalPrefs(storage, prefs) {
  try { if (storage) storage.setItem(PREFS_KEY, JSON.stringify(cleanPrefs(prefs))); return true; } catch { return false; }
}
