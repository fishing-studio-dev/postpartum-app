/* R6 bootstrap: connects offline.js + ui.js to this page and registers the same-origin service worker.
   The page itself never opens network connections (CSP connect-src 'none'). */
(function (window) {
  'use strict';
  const document = window.document;
  const navigator = window.navigator;
  const R6 = window.PostpartumR6;
  const storage = {getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value)};
  const app = window.PostpartumR6UI.mount(document, storage, {
    confirm: text => window.confirm(text),
    today: () => R6.todayString(new Date())
  });
  window.addEventListener('storage', event => { if (event.key === R6.KEY || event.key === null) app.externalChange(); });
  window.addEventListener('beforeunload', event => { if (app.isDirty()) { event.preventDefault(); event.returnValue = ''; } });
  // The date may have changed while the app was in the background.
  window.addEventListener('focus', () => { if (!app.isDirty()) app.render(); });

  const WORKER = './sw.js';
  const status = document.getElementById('offline-status');
  function show(text) { status.textContent = text; }
  if (!navigator || !('serviceWorker' in navigator) || window.isSecureContext === false) {
    show('この開き方では、ネットがないときは使えません。公開されたアドレス（HTTPS）から開いてください。入力と保存はこのまま使えます。');
    return;
  }
  let url = WORKER;
  try {
    // CSP requires Trusted Types. Only this one fixed, relative worker URL is allowed.
    if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
      const policy = window.trustedTypes.createPolicy('postpartum-r6-sw', {
        createScriptURL(value) { if (value !== WORKER) throw new TypeError('unexpected-worker-url'); return value; }
      });
      url = policy.createScriptURL(WORKER);
    }
  } catch (_) {
    show('準備できませんでした。このページを開き直してください。直らないときは、iPhoneはSafari、AndroidはChromeで開いてください。入力と保存はこのまま使えます。');
    return;
  }
  show('ネットがなくても使えるように準備しています…');
  Promise.resolve()
    .then(() => navigator.serviceWorker.register(url, {scope: './'}))
    .then(() => navigator.serviceWorker.ready)
    .then(
      () => show('準備完了：ネットがなくても使えます'),
      () => show('準備できませんでした。ネットにつないだ状態でこのページを開き直してください。入力と保存はこのまま使えます。')
    );
})(window);
