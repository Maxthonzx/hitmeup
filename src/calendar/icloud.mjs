// iCloud 日历（CalDAV，读写）。需要 Apple ID + App 专用密码。
import { randomUUID } from 'node:crypto';
import { busyFromICS } from './ics.mjs';
import { buildICS, googleAddLink } from './links.mjs';

export function createIcloudCalendar({ appleId, appPassword, calendarName, serverUrl = 'https://caldav.icloud.com' }) {
  let clientP = null;
  async function client() {
    if (!clientP) {
      clientP = (async () => {
        const { createDAVClient } = await import('tsdav');
        return createDAVClient({
          serverUrl, credentials: { username: appleId, password: appPassword },
          authMethod: 'Basic', defaultAccountType: 'caldav',
        });
      })().catch((e) => { clientP = null; throw e; });
    }
    return clientP;
  }
  async function calendars() {
    const c = await client();
    const all = await c.fetchCalendars();
    return all.filter((x) => !x.components || x.components.includes('VEVENT'));
  }
  const nameOf = (c) => (typeof c.displayName === 'string' ? c.displayName : '');
  return {
    type: 'icloud',
    async listBusy(startISO, endISO) {
      const c = await client();
      const out = [];
      const s = Date.parse(startISO), e = Date.parse(endISO);
      for (const cal of await calendars()) {
        const objs = await c.fetchCalendarObjects({ calendar: cal, timeRange: { start: new Date(s).toISOString(), end: new Date(e).toISOString() } });
        for (const o of objs) if (o.data) { try { out.push(...busyFromICS(o.data, s, e)); } catch { /* 跳过无法解析的条目 */ } }
      }
      return out;
    },
    async createEvent(ev) {
      const c = await client();
      const cals = await calendars();
      const cal = (calendarName && cals.find((x) => nameOf(x) === calendarName)) || cals[0];
      if (!cal) throw new Error('iCloud 账号下没有可写入事件的日历');
      const uid = randomUUID();
      const res = await c.createCalendarObject({ calendar: cal, filename: `${uid}.ics`, iCalString: buildICS({ uid, ...ev }) });
      if (res && res.ok === false) throw new Error(`iCloud 写入失败: HTTP ${res.status}`);
      return { written: true, ref: `icloud:${uid}`, addLinks: { google: googleAddLink(ev) } };
    },
    async check() {
      const cals = await calendars();
      return `iCloud 已连接，可用日历：${cals.map(nameOf).filter(Boolean).join('、') || cals.length + ' 个'}`;
    },
  };
}
