/* R5 bootstrap: connects offline.js to this page and registers the same-origin service worker.
   The page itself never opens network connections (CSP connect-src 'none'). */
(function (window) {
  'use strict';
  const document = window.document;
  const navigator = window.navigator;
  const R5 = window.PostpartumR5;
  const storage = {getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value)};
  const app = R5.mount(document, storage, text => window.confirm(text));
  window.addEventListener('storage', event => { if (event.key === R5.KEY || event.key === null) app.externalChange(); });
  window.addEventListener('beforeunload', event => { if (app.isDirty()) { event.preventDefault(); event.returnValue = ''; } });

  const WORKER = './sw.js';
  const status = document.getElementById('offline-status');
  function show(text) { status.textContent = text; }
  if (!navigator || !('serviceWorker' in navigator) || window.isSecureContext === false) {
    show('この開き方ではオフライン保存を使えません（HTTPS で配信されたページで使えます）。画面の操作は試せます。');
    return;
  }
  let url = WORKER;
  try {
    // CSP requires Trusted Types. Only this one fixed, relative worker URL is allowed.
    if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
      const policy = window.trustedTypes.createPolicy('postpartum-r5-sw', {
        createScriptURL(value) { if (value !== WORKER) throw new TypeError('unexpected-worker-url'); return value; }
      });
      url = policy.createScriptURL(WORKER);
    }
  } catch (_) {
    show('オフライン保存の準備ができませんでした。画面の操作は試せます。');
    return;
  }
  show('オフライン用にこのアプリのファイルを端末へ保存しています…');
  Promise.resolve()
    .then(() => navigator.serviceWorker.register(url, {scope: './'}))
    .then(() => navigator.serviceWorker.ready)
    .then(
      () => show('オフラインで使えます（アプリのファイルはこの端末に保存済み）。'),
      () => show('オフライン用の保存に失敗しました。配信元に接続できる状態で開き直してください。')
    );
})(window);
