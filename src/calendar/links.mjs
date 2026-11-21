// 一键添加链接与 .ics 生成（无法写入日历时的兜底）
import { parseTime } from '../tz.mjs';

const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function googleAddLink({ start, end, summary, description, location }) {
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: summary || '搭子见面',
    dates: `${utc(parseTime(start))}/${utc(parseTime(end))}`,
    details: description || '', location: location || '',
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export function buildICS({ uid, start, end, summary, description, location }) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dazi//Dazi Agent//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${uid}@dazi`, `DTSTAMP:${utc(Date.now())}`,
    `DTSTART:${utc(parseTime(start))}`, `DTEND:${utc(parseTime(end))}`,
    `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(description)}`, `LOCATION:${esc(location)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
