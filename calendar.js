// カレンダーに追加。.ics ファイル（RFC 5545）と Google カレンダーのリンクを端末の中で作る（通信しない）。
import {parseDate, isValidTime, addDays, planOf, effectiveDate, assigneeLabel} from './logic.js';

const CRLF = '\r\n';
const pad = n => String(n).padStart(2, '0');
export const TZID = 'Asia/Tokyo';
export const GCAL_BASE = 'https://calendar.google.com/calendar/render';
const VTIMEZONE = ['BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:JST', 'END:STANDARD', 'END:VTIMEZONE'];

// TEXT の値：\ ; , と改行をエスケープ。
export function escapeText(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}
// 1行を75オクテット以内に折り返す（続きの行は空白1つで始める）。文字の途中では切らない。
export function foldLine(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of String(line)) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join(CRLF);
}
const compact = date => date.replace(/-/g, '');
// 'YYYY-MM-DD' + 'HH:MM' に分を足す（日付をまたいでもよい）。
function addMinutes(date, time, min) {
  const p = parseDate(date);
  const [h, m] = time.split(':').map(Number);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d, h, m) + min * 60000);
  return {date: t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()), time: pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes())};
}
const local = (date, time) => compact(date) + 'T' + time.replace(':', '') + '00';
export function utcStamp(d) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
}
// 通知：前日 09:00 JST（= 前日 00:00 UTC）と当日 08:00 JST（= 前日 23:00 UTC）。
export function alarmTimes(date) {
  const prev = compact(addDays(date, -1));
  return [prev + 'T000000Z', prev + 'T230000Z'];
}

// ev: {uid, title, description, date 'YYYY-MM-DD', time 'HH:MM'|null, durationMin?}, now: Date
export function buildIcs(ev, now = new Date()) {
  if (!ev || !parseDate(ev.date)) throw new Error('no-date');
  const timed = isValidTime(ev.time);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//sango-app//postpartum//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (timed) lines.push(...VTIMEZONE);
  lines.push('BEGIN:VEVENT', 'UID:' + ev.uid, 'DTSTAMP:' + utcStamp(now));
  if (timed) {
    const end = addMinutes(ev.date, ev.time, ev.durationMin || 60);
    lines.push('DTSTART;TZID=' + TZID + ':' + local(ev.date, ev.time), 'DTEND;TZID=' + TZID + ':' + local(end.date, end.time));
  } else {
    lines.push('DTSTART;VALUE=DATE:' + compact(ev.date), 'DTEND;VALUE=DATE:' + compact(addDays(ev.date, 1)));
  }
  lines.push('SUMMARY:' + escapeText(ev.title));
  if (ev.description) lines.push('DESCRIPTION:' + escapeText(ev.description));
  const [before, sameDay] = alarmTimes(ev.date);
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapeText('明日：' + ev.title), 'TRIGGER;VALUE=DATE-TIME:' + before, 'END:VALARM');
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapeText('今日：' + ev.title), 'TRIGGER;VALUE=DATE-TIME:' + sameDay, 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

export function gcalUrl(ev) {
  if (!ev || !parseDate(ev.date)) return '';
  let dates;
  if (isValidTime(ev.time)) {
    const end = addMinutes(ev.date, ev.time, ev.durationMin || 60);
    dates = local(ev.date, ev.time) + '/' + local(end.date, end.time);
  } else dates = compact(ev.date) + '/' + compact(addDays(ev.date, 1));
  return GCAL_BASE + '?action=TEMPLATE&text=' + encodeURIComponent(ev.title || '') + '&dates=' + dates +
    '&details=' + encodeURIComponent(ev.description || '') + '&ctz=' + TZID;
}

// 項目 → 予定。日付は planDate があればそれ、無ければ期限。どちらも無ければ null。
export function calendarEvent(item, settings, family) {
  if (!item) return null;
  const date = effectiveDate(item, settings);
  if (!date) return null;
  const p = planOf(item);
  const time = p.planDate ? p.planTime : null;
  const who = assigneeLabel(p.assignee, family);
  const desc = [];
  if (who) desc.push('誰が：' + who);
  if (item.place) desc.push('場所：' + item.place);
  if (item.documents && item.documents.length) desc.push('持ち物：' + item.documents.join('、'));
  if (item.sourceUrl && /^https:\/\//.test(item.sourceUrl)) desc.push(item.sourceUrl);
  return {uid: String(item.id) + '-' + date.replace(/-/g, '') + '-sango-app', title: item.title || '予定', description: desc.join('\n'), date, time};
}
export function icsFileName(title) {
  const base = Array.from(String(title || '予定').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim()).slice(0, 40).join('') || '予定';
  return base + '.ics';
}
