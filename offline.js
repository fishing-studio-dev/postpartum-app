// つながり具合の表示。navigator.onLine と online/offline イベントだけを見る（通信はしない）。
export const OFFLINE_TEXT = 'オフライン：最後に見た内容を表示中';
export const QUEUED_TEXT = 'つながったら同期します';

export function isOnline(win) {
  return !(win && win.navigator && win.navigator.onLine === false);
}
export function watchOnline(win, onChange) {
  const fire = () => onChange(isOnline(win));
  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('online', fire);
    win.addEventListener('offline', fire);
  }
  fire();
  return () => {
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('online', fire);
      win.removeEventListener('offline', fire);
    }
  };
}
