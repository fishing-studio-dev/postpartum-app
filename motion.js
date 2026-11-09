// キャラクターの動き（資料6章・action_design_source.json）。DOM・タイマー・matchMedia は外から渡す（テストでは偽物）。
//   ・どの動きも1回だけ再生して、最後は静止（ループしない。待機の常時ループは使わない）
//   ・同時に動くのは画面全体で1体まで。新しいきっかけで前の動きを止める（順番待ちにしない）
//   ・OS の「視差効果を減らす／動きを減らす」、アプリの「動きを減らす」「停止」では動かさない（静止画のまま。情報はそのまま）
//   ・文字入力中、パネル（詳細など）を開いている間、画面外、アプリが裏に回ったときは止める
//   ・音は出さない
// 動きそのものは style.css の @keyframes（transform と opacity だけ）。ここでは要素に data-motion を付け外しするだけ。
export const STATES = Object.freeze({neutral: 0, idle_optional: 4000, welcome: 1800, tap: 900, saved: 1400, guide: 1400, rest: 2600});
export const GENERIC_CSS = Object.freeze({idle_optional: 'mv-idle', welcome: 'mv-welcome', tap: 'mv-tap', saved: 'mv-saved', guide: 'mv-guide', rest: 'mv-rest'});
export const MOTION_MODES = Object.freeze(['standard', 'reduce', 'stop']);
export const MOTION_MODE_TEXT = Object.freeze({standard: '標準', reduce: '動きを減らす', stop: '停止'});
export const TAP_DEBOUNCE_MS = 400;
export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export function createMotion(deps = {}) {
  const setT = deps.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearT = deps.clearTimeout || (t => clearTimeout(t));
  const now = deps.now || (() => Date.now());
  const doc = deps.document || null;
  let mq = null;
  try { mq = typeof deps.matchMedia === 'function' ? deps.matchMedia(REDUCED_QUERY) : null; } catch { mq = null; }
  let mode = 'standard';
  let current = null;
  let visible = true;
  let welcomeDay = null;
  let lastTap = -Infinity;
  const blocks = new Set();
  const played = [];

  const reducedOS = () => { try { return Boolean(mq && mq.matches); } catch { return false; } };
  const hidden = () => Boolean(doc && (doc.visibilityState === 'hidden' || doc.hidden === true));
  function canMove() { return mode === 'standard' && !reducedOS() && !hidden() && blocks.size === 0 && visible; }

  function stop() {
    if (!current) return false;
    const c = current;
    current = null;
    clearT(c.timer);
    try { c.el.removeAttribute('data-motion'); } catch { /* ignore */ }
    return true;
  }
  // state: STATES のどれか。character: registry の1体（固有の動きがその場面用なら、それを使う）。
  function play(el, state, character) {
    if (!el || !(state in STATES) || state === 'neutral') { stop(); return false; }
    if (!canMove()) { stop(); return false; }
    stop();
    const sig = character && character.action && character.action.state === state ? character.action : null;
    const css = sig ? sig.css : GENERIC_CSS[state];
    const ms = sig ? sig.durationMs : STATES[state];
    try { void el.offsetWidth; } catch { /* reflow so that the same animation can start again */ }
    el.setAttribute('data-motion', css);
    const token = {el, state, css, ms};
    token.timer = setT(() => {
      if (current !== token) return;
      current = null;
      try { el.removeAttribute('data-motion'); } catch { /* ignore */ }
    }, ms);
    current = token;
    played.push(css);
    return true;
  }
  // 連打は積まない：短い間の2回目は無視する。
  function tap(el, character) {
    const t = now();
    if (t - lastTap < TAP_DEBOUNCE_MS) return false;
    lastTap = t;
    return play(el, 'tap', character);
  }
  // おかえり：きょうを開いたときに、アプリを開くごと（日付が変わったら）1回だけ。タブの往復では再生しない。
  function welcome(el, character, day) {
    if (welcomeDay === day) return false;
    welcomeDay = day;
    return play(el, 'welcome', character);
  }
  function block(reason, on) {
    if (on) { blocks.add(reason); stop(); } else blocks.delete(reason);
  }
  function setMode(m) {
    mode = MOTION_MODES.includes(m) ? m : 'standard';
    if (mode !== 'standard') stop();
    return mode;
  }
  function setVisible(v) { visible = Boolean(v); if (!visible) stop(); }

  if (doc && typeof doc.addEventListener === 'function') doc.addEventListener('visibilitychange', () => { if (hidden()) stop(); });
  if (mq) {
    const onChange = () => { if (reducedOS()) stop(); };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
  }

  return {
    play, tap, welcome, stop, block, setMode, setVisible, canMove,
    isStill: () => !canMove(),
    reducedOS,
    get mode() { return mode; },
    get current() { return current ? {state: current.state, css: current.css, ms: current.ms, el: current.el} : null; },
    get blocked() { return [...blocks]; },
    get played() { return played.slice(); }
  };
}
