// R10-6：きょうの3体が「歩く・遊ぶ」。絵は描き足さない。今ある静止画（WebP）を、舞台（#chara-stage）の上で動かすだけ。
//   要素に付け外しするのは data 属性だけ：
//     data-pos  … 横の位置 0〜6（style.css で transform の位置を決め、transition で歩いて移る）
//     data-face … 向き l / r（左へ歩くときは絵を左右反転）
//     data-act  … いまの動き walk（歩く）/ hop（ぴょん）/ twirl（くるっ）/ wiggle（ゆらゆら）/ peek（のぞく）/ sit（ひと休み）
//   動きそのものは style.css（transform の transition と transform の @keyframes だけ。インラインの style は使わない＝CSP のまま）。
//   canMove() が false のとき（アプリの「動きを減らす」「停止」・OS の「動きを減らす」・文字入力中・パネル表示中・画面外・裏）は
//   何もしない（data-act を外して静止画のまま。位置はそのまま）。CSS 側でも data-idle="off" と reduce/stop・prefers-reduced-motion で止める。
//   random・setTimeout は外から渡す（テストでは固定の値・偽物）。
export const STAGE_POSITIONS = 7;
export const START_POSITIONS = Object.freeze([0, 3, 6]);
// 隣どうしは 2 つ以上あける（いちばん大きい主役 88px でも重ならない）。歩くときは、ほかの子を追いこさない。
export const MIN_GAP = 2;
export const PLAYS = Object.freeze(['hop', 'twirl', 'wiggle', 'peek', 'sit']);
export const ACTS = Object.freeze(['walk', ...PLAYS]);
export const STROLL_TICK_MS = 3200;
export const WALK_CHANCE = 0.55;

export function createStroll(deps = {}) {
  const setT = deps.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const random = typeof deps.random === 'function' ? deps.random : () => 0;
  const canMove = typeof deps.canMove === 'function' ? deps.canMove : () => true;
  const isShown = typeof deps.isShown === 'function' ? deps.isShown : () => true;
  let actors = [];
  let running = false;
  let gen = 0;
  let steps = 0;
  const r = () => { let v = 0; try { v = Number(random()); } catch { v = 0; } return Number.isFinite(v) && v >= 0 && v < 1 ? v : 0; };
  const pos = a => Number(a.el.getAttribute('data-pos')) || 0;

  // els：舞台の役者（主役が先頭）。位置は最初だけ 0・3・6 に並べる（動かない端末でも重ならない）。
  function setActors(els) {
    actors = (els || []).filter(Boolean).map((el, i) => {
      if (el.getAttribute('data-pos') == null) el.setAttribute('data-pos', String(START_POSITIONS[i % START_POSITIONS.length]));
      if (el.getAttribute('data-face') == null) el.setAttribute('data-face', i === 2 ? 'l' : 'r');
      return {el};
    });
    return actors.length;
  }
  function still() {
    for (const a of actors) { try { a.el.removeAttribute('data-act'); } catch { /* ignore */ } }
  }
  // 1回分の動き。動いてよいときだけ、役者ごとに「歩く」か「遊ぶ」を1つ選ぶ。戻り値：動かしたか。
  function step() {
    if (!actors.length || !canMove() || !isShown()) { still(); return false; }
    steps++;
    const taken = new Set(actors.map(pos));
    for (const a of actors) {
      const from = pos(a);
      if (r() < WALK_CHANCE) {
        const others = [...taken].filter(p => p !== from);
        const free = Array.from({length: STAGE_POSITIONS}, (_, i) => i).filter(i => i !== from
          && others.every(p => Math.abs(p - i) >= MIN_GAP && !(p > Math.min(from, i) && p < Math.max(from, i))));
        if (free.length) {
          const to = free[Math.floor(r() * free.length) % free.length];
          taken.delete(from); taken.add(to);
          a.el.setAttribute('data-face', to < from ? 'l' : 'r');
          a.el.setAttribute('data-pos', String(to));
          a.el.setAttribute('data-act', 'walk');
          continue;
        }
      }
      a.el.setAttribute('data-act', PLAYS[Math.floor(r() * PLAYS.length) % PLAYS.length]);
    }
    return true;
  }
  // 止めてすぐ動かしても、前の順番待ちのタイマーは何もしない（gen で見分ける）。
  function start() {
    if (running) return false;
    running = true;
    const g = ++gen;
    const loop = () => { if (!running || g !== gen) return; step(); setT(loop, STROLL_TICK_MS); };
    setT(loop, STROLL_TICK_MS);
    return true;
  }
  function stop() { running = false; gen++; still(); }

  return {
    setActors, step, still, start, stop,
    get running() { return running; },
    get steps() { return steps; },
    get actors() { return actors.map(a => a.el); }
  };
}
