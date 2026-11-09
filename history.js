// Android の「戻る」操作（ジェスチャー・ボタン）を、アプリの中の操作にする。
// history と各コールバックは外から渡す（テストでは偽物）。
//   画面（パネル）を開く → pushState。戻る → いちばん上のパネルを閉じる。
//   ホームで戻る → 「アプリを閉じますか？」。もどる → ガードを積み直す。閉じる → history.back() を1回だけ。
export function createBackGuard({history, onBack, onExitAsk} = {}) {
  const has = Boolean(history && typeof history.pushState === 'function' && typeof history.back === 'function');
  const stack = [];
  let ignore = 0;
  let leaving = false;
  let asking = false;

  function push(state) { if (has) history.pushState(state, ''); }
  function start() {
    if (!has) return;
    const st = history.state;
    if (st && st.sango === 'guard') return;
    if (typeof history.replaceState === 'function') history.replaceState({sango: 'base'}, '');
    push({sango: 'guard'});
  }
  function open(name) {
    stack.push(name);
    push({sango: 'panel', name});
  }
  // 開いているパネルを別のパネルに入れかえる（履歴は増やさない）。
  function replace(from, to) {
    const i = stack.lastIndexOf(from);
    if (i < 0) { open(to); return; }
    stack[i] = to;
    if (has && typeof history.replaceState === 'function' && i === stack.length - 1) history.replaceState({sango: 'panel', name: to}, '');
  }
  // 画面のボタンで閉じたとき。積んだ履歴を1つ戻し、そのとき来る popstate は無視する。
  function close(name) {
    const i = stack.lastIndexOf(name);
    if (i < 0) return false;
    stack.splice(i, 1);
    if (has) { ignore++; history.back(); }
    return true;
  }
  function handlePop() {
    if (leaving) return 'leaving';
    if (ignore > 0) { ignore--; return 'ignored'; }
    if (stack.length) {
      const name = stack.pop();
      if (onBack) onBack(name);
      return 'closed';
    }
    if (asking) return 'asking';
    asking = true;
    if (onExitAsk) onExitAsk();
    return 'ask';
  }
  // 「もどる」：アプリに残る。
  function stay() {
    if (!asking) return;
    asking = false;
    push({sango: 'guard'});
  }
  // 「閉じる」：もう一度だけ戻って、アプリから出る。
  function leave() {
    if (leaving) return;
    leaving = true;
    asking = false;
    if (has) history.back();
  }
  // bfcache から戻ってきたとき。
  function resume() {
    leaving = false; asking = false; ignore = 0; stack.length = 0;
    start();
  }
  return {
    start, open, replace, close, handlePop, stay, leave, resume,
    get top() { return stack.length ? stack[stack.length - 1] : null; },
    get depth() { return stack.length; },
    get asking() { return asking; },
    has: name => stack.includes(name)
  };
}
