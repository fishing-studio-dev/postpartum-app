// 「アプリを開いている間だけ通知する」。Push API・バックグラウンド同期は使わない。
// Notification（コンストラクター）・storage・show は外から渡す（テストでは偽物）。
export const NOTIFY_KEY = 'sango-notify-open';
export const NOTIFY_NOTE = '通知はこのアプリを開いている間だけ届きます。閉じているときは届きません。確実にしたいときは『カレンダーに追加』を使ってください';
export const LEAD_MIN = 60;

export function notifyStatus(N) {
  if (!N) return 'unsupported';
  return ['granted', 'denied', 'default'].includes(N.permission) ? N.permission : 'default';
}
const toMin = hm => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };

// 今日の予定のうち、まだ知らせていないもの。時刻つきは LEAD_MIN 分前から。
// up: logic.upcoming() の結果、nowHM: 'HH:MM'、sent: Set
export function dueNotifications(up, today, nowHM, sent) {
  const out = [];
  if (!up || !Array.isArray(up.today)) return out;
  for (const e of up.today) {
    const key = e.id + '@' + today;
    if (sent && sent.has(key)) continue;
    if (e.time && toMin(nowHM) < toMin(e.time) - LEAD_MIN) continue;
    out.push({key, title: e.title, body: e.time ? '今日 ' + e.time : '今日の予定'});
  }
  return out;
}

export function createNotifier({Notification: N, storage, show} = {}) {
  const sent = new Set();
  const read = () => { try { return storage ? storage.getItem(NOTIFY_KEY) : null; } catch { return null; } };
  const write = v => { try { if (storage) storage.setItem(NOTIFY_KEY, v); } catch { /* ignore */ } };
  const status = () => notifyStatus(N);
  const enabled = () => read() === '1' && status() === 'granted';

  // 許可を聞くのは、このボタンを押したときだけ。
  async function enable() {
    if (!N) return 'unsupported';
    let p = status();
    if (p === 'default' && typeof N.requestPermission === 'function') {
      p = await new Promise(resolve => {
        let done = false;
        const fin = v => { if (!done) { done = true; resolve(v); } };
        try {
          const r = N.requestPermission(fin);
          if (r && typeof r.then === 'function') r.then(fin, () => fin('default'));
        } catch { fin('default'); }
      });
    }
    if (p === 'granted') { write('1'); return 'on'; }
    write('0');
    return p === 'denied' ? 'denied' : 'off';
  }
  function disable() { write('0'); return 'off'; }
  function check(up, today, nowHM) {
    if (!enabled() || typeof show !== 'function') return [];
    const due = dueNotifications(up, today, nowHM, sent);
    for (const d of due) {
      sent.add(d.key);
      try { const r = show(d.title, {body: d.body, tag: d.key}); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch { /* ignore */ }
    }
    return due;
  }
  return {enable, disable, check, enabled, status, get sent() { return sent; }};
}
