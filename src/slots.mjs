// 可约时间生成（纯函数）：每周可约时段 + 忙闲 + 缓冲 + 提前量 + 每日上限。
import { MIN, fromWall, dateStr, addDays, weekdayOf, WEEKDAY_KEYS, toISO, parseTime } from './tz.mjs';

export const DEFAULT_AVAILABILITY = {
  weekly: {
    mon: [['19:00', '22:00']], tue: [['19:00', '22:00']], wed: [['19:00', '22:00']],
    thu: [['19:00', '22:00']], fri: [['19:00', '22:00']],
    sat: [['10:00', '21:00']], sun: [['10:00', '21:00']],
  },
  bufferMin: 30, minNoticeHours: 12, maxMeetupsPerDay: 2, horizonDays: 14, defaultDurationMin: 60,
};

const overlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
export const slotKey = (s) => `${parseTime(s.start)}-${parseTime(s.end)}`;
export const stripSlot = (s) => ({ start: s.start, end: s.end });

/**
 * @param {object} o
 * @param {object} o.availability  见 DEFAULT_AVAILABILITY
 * @param {Array}  o.busy          [{start,end}]（ISO/毫秒）
 * @param {Array}  [o.meetups]     已确认的约我 · 见面 [{start,end}]（用于每日上限）
 * @param {number} o.durationMin
 * @param {string} o.tz
 * @param {number} o.nowMs
 * @returns {Array<{start,end,startMs,endMs,day}>} 按时间升序
 */
export function generateSlots({ availability, busy = [], meetups = [], durationMin, tz, nowMs = Date.now(), stepMin = 30 }) {
  const a = { ...DEFAULT_AVAILABILITY, ...availability };
  const dur = durationMin * MIN, buf = a.bufferMin * MIN;
  const earliest = nowMs + a.minNoticeHours * 60 * MIN;
  const busyMs = busy.map((b) => ({ s: parseTime(b.start, tz), e: parseTime(b.end, tz) }));
  const meetMs = meetups.map((b) => parseTime(b.start, tz));
  const out = [];
  const today = dateStr(nowMs, tz);
  for (let i = 0; i <= a.horizonDays; i++) {
    const ds = addDays(today, i);
    const ranges = a.weekly?.[WEEKDAY_KEYS[weekdayOf(ds)]] || [];
    if (!ranges.length) continue;
    const dayStart = fromWall(ds, '00:00', tz), dayEnd = fromWall(addDays(ds, 1), '00:00', tz);
    if (meetMs.filter((m) => m >= dayStart && m < dayEnd).length >= a.maxMeetupsPerDay) continue;
    for (const [from, to] of ranges) {
      const wStart = fromWall(ds, from, tz);
      const wEnd = to === '24:00' ? dayEnd : fromWall(ds, to, tz);
      for (let t = wStart; t + dur <= wEnd; t += stepMin * MIN) {
        const s = t, e = t + dur;
        if (s < earliest) continue;
        if (busyMs.some((b) => overlap(s, e, b.s - buf, b.e + buf))) continue;
        out.push({ start: toISO(s, tz), end: toISO(e, tz), startMs: s, endMs: e, day: ds });
      }
    }
  }
  return out;
}

/** 挑 n 个“最好”的：跨天轮流取；每天最多 perDay 个且互不重叠 */
export function pickBest(slots, n = 12, { perDay = 3 } = {}) {
  const byDay = new Map();
  for (const s of slots) { if (!byDay.has(s.day)) byDay.set(s.day, []); byDay.get(s.day).push(s); }
  const picks = [];
  for (const list of byDay.values()) {
    const chosen = [];
    for (const s of list) {
      if (chosen.length >= perDay) break;
      if (chosen.every((c) => !overlap(s.startMs, s.endMs, c.startMs, c.endMs))) chosen.push(s);
    }
    picks.push(chosen);
  }
  const out = [];
  for (let r = 0; out.length < n && r < perDay; r++) {
    for (const c of picks) if (c[r] && out.length < n) out.push(c[r]);
  }
  return out.sort((x, y) => x.startMs - y.startMs);
}

/** 求交：proposed 中完全落在某个空闲时段内的项 */
export function intersectSlots(proposed, free) {
  const f = free.map((s) => ({ s: parseTime(s.start), e: parseTime(s.end) }));
  const out = [];
  for (const p of proposed || []) {
    let ps, pe;
    try { ps = parseTime(p.start); pe = parseTime(p.end); } catch { continue; }
    if (!(pe > ps)) continue;
    if (f.some((x) => ps >= x.s && pe <= x.e)) out.push({ start: p.start, end: p.end });
  }
  return out;
}
