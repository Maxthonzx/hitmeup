import { googleAddLink } from './links.mjs';

export function createNoneCalendar() {
  return {
    type: 'none',
    async listBusy() { return []; },
    async createEvent(ev) { return { written: false, addLinks: { google: googleAddLink(ev) } }; },
    async check() { return '未连接日历（仅按每周可约时间提供时段）'; },
  };
}
