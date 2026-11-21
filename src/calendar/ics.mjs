// ICS 只读适配器：Google 私密 iCal 地址 / iCloud 共享日历 / Outlook 发布链接。
import ical from 'node-ical';
import { googleAddLink } from './links.mjs';
import { fromWall, isValidTimezone } from '../tz.mjs';

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * 从 ICS 文本提取 [startMs,endMs] 内的忙碌区间（展开重复事件，处理 EXDATE 与单次改动）。
 * 忽略：全天事件、TRANSPARENT（显示为空闲）、已取消。
 */
export function busyFromICS(text, startMs, endMs) {
  const data = ical.sync.parseICS(text);
  const out = [];
  for (const ev of Object.values(data)) {
    if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;
    if (ev.datetype === 'date' || ev.start.dateOnly) continue;
    if (String(ev.transparency || '').toUpperCase() === 'TRANSPARENT') continue;
    if (String(ev.status || '').toUpperCase() === 'CANCELLED') continue;
    const s0 = new Date(ev.start).getTime();
    const dur = ev.end ? new Date(ev.end).getTime() - s0 : 0;
    const push = (s, d) => { if (s < endMs && s + Math.max(d, 1) > startMs) out.push({ start: new Date(s).toISOString(), end: new Date(s + Math.max(d, 60000)).toISOString() }); };
    if (ev.rrule) {
      // rrule 返回“浮动时间”：UTC getter 取到的是事件所在时区的墙上时间，需按 TZID 还原成真实时刻（夏令时正确）
      const tzName = ev.start.tz;
      const wallTz = tzName && isValidTimezone(tzName) && !/^(etc\/)?(utc|gmt)$/i.test(tzName) ? tzName : null;
      const toInstant = (d) => (wallTz ? fromWall(d.toISOString().slice(0, 10), d.toISOString().slice(11, 16), wallTz) : d.getTime());
      const exMs = new Set(Object.values(ev.exdate || {}).map((d) => new Date(d).getTime()));
      const occ = ev.rrule.between(new Date(startMs - dur - 2 * 86400000), new Date(endMs + 2 * 86400000), true);
      for (const d of occ) {
        const inst = toInstant(d);
        const ov = ev.recurrences?.[dayKey(inst)];
        if (ov?.start) {
          const os = new Date(ov.start).getTime();
          push(os, ov.end ? new Date(ov.end).getTime() - os : dur);
          continue;
        }
        if (exMs.has(inst)) continue;
        push(inst, dur);
      }
    } else {
      push(s0, dur);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export function normalizeIcsUrl(u) { return String(u || '').trim().replace(/^webcals?:\/\//i, 'https://'); }

export function createIcsCalendar({ url, cacheMs = 5 * 60 * 1000, fetchImpl = fetch }) {
  let cache = null;
  async function load() {
    if (cache && Date.now() - cache.at < cacheMs) return cache.text;
    const res = await fetchImpl(normalizeIcsUrl(url), { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Hit Me Up/0.1' } });
    if (!res.ok) throw new Error(`ICS 下载失败: HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('该链接返回的不是 iCal 日历');
    cache = { at: Date.now(), text };
    return text;
  }
  return {
    type: 'ics',
    async listBusy(startISO, endISO) { return busyFromICS(await load(), Date.parse(startISO), Date.parse(endISO)); },
    async createEvent(ev) { return { written: false, addLinks: { google: googleAddLink(ev) } }; },
    async check() { const t = await load(); return `已读取日历（${(t.match(/BEGIN:VEVENT/g) || []).length} 个事件）`; },
  };
}
