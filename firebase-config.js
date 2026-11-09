/* Firebase の設定と SDK の版（ここ1か所だけで固定）。
   ページ（app.js）と sw.js の両方がこのファイルを読む。classic script として読み込む。 */
(function (root) {
  'use strict';
  var SDK_VERSION = '13.2.0';
  var SDK_BASE = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';
  root.SANGO_FIREBASE = Object.freeze({
    config: Object.freeze({
      apiKey: 'AIzaSyBTLzgTqksFBpU0Vxg3-RaA8u5n-IDDa3A',
      authDomain: 'sango-app-a7e00.firebaseapp.com',
      projectId: 'sango-app-a7e00',
      storageBucket: 'sango-app-a7e00.firebasestorage.app',
      messagingSenderId: '257923777124',
      appId: '1:257923777124:web:b5b7ce38481bd898ec5571'
    }),
    sdkVersion: SDK_VERSION,
    sdk: Object.freeze({
      app: SDK_BASE + 'firebase-app.js',
      auth: SDK_BASE + 'firebase-auth.js',
      firestore: SDK_BASE + 'firebase-firestore.js'
    }),
    sdkUrls: Object.freeze([SDK_BASE + 'firebase-app.js', SDK_BASE + 'firebase-auth.js', SDK_BASE + 'firebase-firestore.js'])
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
