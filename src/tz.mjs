// 通用时区工具：基于 Intl.DateTimeFormat 计算任意 IANA 时区的偏移（含夏令时），
// 绝不使用机器本地 Date 的 getHours() 等。
export const MIN = 60000;
export const DAY = 86400000;
export const pad = (n, w = 2) => String(n).padStart(w, '0');
export const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const fmtCache = new Map();
function formatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimezone(tz) {
  try { formatter(tz); return typeof tz === 'string' && tz.length > 0; } catch { return false; }
}

export function defaultTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

/** 某绝对时刻在 tz 的偏移（分钟，东为正） */
export function offsetMin(tz, ms) {
  const parts = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) parts[p.type] = Number(p.value);
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / MIN);
}

export function offsetStr(tz, ms) {
  const o = offsetMin(tz, ms);
  const a = Math.abs(o);
  return `${o < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** epoch ms -> tz 内的墙上时间分量 */
export function wall(ms, tz) {
  const d = new Date(ms + offsetMin(tz, ms) * MIN);
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}

export function dateStr(ms, tz) {
  const w = wall(ms, tz);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

export function toISO(ms, tz) {
  const w = wall(ms, tz);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}${offsetStr(tz, ms)}`;
}

/** 'YYYY-MM-DD' + 'HH:MM' -> epoch ms（在 tz 内解释；夏令时间隙取间隙之后） */
export function fromWall(date, hhmm, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const guess = naive - offsetMin(tz, naive) * MIN;
  return naive - offsetMin(tz, guess) * MIN;
}

/** 'YYYY-MM-DD' 加减天（纯日历运算） */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 解析 ISO（须带偏移或 Z）/ 毫秒 / 'YYYY-MM-DD'（按 tz 当天 00:00） */
export function parseTime(s, tz = 'UTC') {
  if (typeof s === 'number') return s;
  if (s instanceof Date) return s.getTime();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fromWall(s, '00:00', tz);
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new Error(`无法解析时间: ${s}`);
  return t;
}

export function startOfDay(ms, tz) { return fromWall(dateStr(ms, tz), '00:00', tz); }

export function fmtSlot(slot, tz) {
  const a = wall(parseTime(slot.start), tz), b = wall(parseTime(slot.end), tz);
  return `${a.month}月${a.day}日${WEEKDAY_CN[a.weekday]} ${pad(a.hour)}:${pad(a.minute)}-${pad(b.hour)}:${pad(b.minute)}`;
}
