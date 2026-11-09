// 写真を端末の中で縮小する。サイズの決め方（純粋な関数）はNodeでテストできる。
export const FULL = Object.freeze({edge: 1280, maxBytes: 300 * 1024});
export const THUMB = Object.freeze({edge: 320, maxBytes: 40 * 1024});
export const QUALITIES = Object.freeze([0.82, 0.74, 0.66, 0.58, 0.5]);
export const SHRINK = 0.8;
export const MIN_EDGE = 120;
export const MAX_FILES = 20;

// 長い辺を edge 以下に（拡大はしない）。
export function fitWithin(w, h, edge) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const long = Math.max(w, h);
  if (long <= edge) return {w, h};
  const s = edge / long;
  return {w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s))};
}
// data URL（base64）の中身のバイト数。
export function base64Bytes(dataUrl) {
  const s = String(dataUrl);
  const b64 = s.slice(s.indexOf(',') + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor(b64.length * 3 / 4) - pad;
}
export const fitsLimit = (dataUrl, maxBytes) => base64Bytes(dataUrl) <= maxBytes;
// 試す順番：まず画質を下げ、それでも大きければ寸法を 0.8 倍ずつ小さくする。必ず終わる。
export function attemptPlan(w, h, target) {
  const plan = [];
  let edge = target.edge;
  for (;;) {
    const dims = fitWithin(w, h, edge);
    for (const q of QUALITIES) plan.push({w: dims.w, h: dims.h, q});
    if (Math.max(dims.w, dims.h) <= MIN_EDGE) break;
    edge = Math.max(MIN_EDGE, Math.floor(Math.max(dims.w, dims.h) * SHRINK));
  }
  return plan;
}
// encode(w, h, q) → data URL。条件を満たす最初の結果を返す。
export function shrinkToLimit(w, h, target, encode) {
  for (const step of attemptPlan(w, h, target)) {
    const data = encode(step.w, step.h, step.q);
    if (fitsLimit(data, target.maxBytes)) return {data, w: step.w, h: step.h, q: step.q, bytes: base64Bytes(data)};
  }
  throw new Error('too-large');
}

// 端末が読めない形式（HEIC など）のときに出す文。
export const DECODE_FAIL_TEXT = 'この写真は読み込めませんでした。JPEGで保存し直すか、カメラの設定を『互換性優先』にしてください';
export function isHeicLike(file) {
  const f = file || {};
  return /image\/hei[cf]/i.test(String(f.type || '')) || /\.hei[cf]$/i.test(String(f.name || ''));
}
// 失敗の理由 → 画面の文（読めなかったときだけ専用の文）。
export function photoFailText(decodeFails, otherFails) {
  if (decodeFails > 0) return DECODE_FAIL_TEXT;
  if (otherFails > 0) return otherFails + '枚は追加できませんでした';
  return '';
}

// ---- ブラウザー用 ----
// 向き（EXIF）は createImageBitmap の imageOrientation: 'from-image' でそろえる。
async function decode(file, env) {
  if (typeof env.createImageBitmap === 'function') {
    try { return await env.createImageBitmap(file, {imageOrientation: 'from-image'}); } catch { /* fall back to <img> */ }
  }
  const url = env.URL.createObjectURL(file);
  try {
    const img = env.document.createElement('img');
    await new Promise((ok, ng) => { img.onload = ok; img.onerror = ng; img.src = url; });
    if (!(img.naturalWidth || img.width)) throw new Error('empty');
    return img;
  } catch {
    const e = new Error('decode');
    e.code = 'decode';
    e.heic = isHeicLike(file);
    throw e;
  } finally { env.URL.revokeObjectURL(url); }
}
// file → {thumb, full, w, h, bytes}
export async function preparePhoto(file, env) {
  const src = await decode(file, env);
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  const canvas = env.document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const encode = (w, h, q) => {
    canvas.width = w; canvas.height = h;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', q);
  };
  const full = shrinkToLimit(sw, sh, FULL, encode);
  const thumb = shrinkToLimit(sw, sh, THUMB, encode);
  if (typeof src.close === 'function') src.close();
  return {full: full.data, thumb: thumb.data, w: full.w, h: full.h, bytes: full.bytes};
}
