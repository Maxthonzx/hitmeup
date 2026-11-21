// 飞书日历适配器（可选，工作场景）：通过 lark-cli 读忙闲、建日程。
import { spawn } from 'node:child_process';
import path from 'node:path';
import { parseTime, DAY } from '../tz.mjs';
import { googleAddLink } from './links.mjs';

const IS_WIN = process.platform === 'win32';

function cliEnv() {
  const env = { ...process.env };
  if (IS_WIN) {
    const extra = [path.join(process.env.APPDATA || '', 'npm'), 'C:\\Program Files\\nodejs'];
    const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'Path';
    env[key] = `${extra.join(';')};${env[key] || ''}`;
  }
  return env;
}

export function runLark(args, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = IS_WIN
      ? spawn(['lark-cli', ...args.map((a) => `"${String(a).replace(/"/g, '\\"')}"`)].join(' '), { env: cliEnv(), shell: true, windowsHide: true })
      : spawn('lark-cli', args, { env: cliEnv() });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('lark-cli 超时')); }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

export function parseJsonLoose(text) {
  const t = text.trim();
  try { return JSON.parse(t); } catch { /* 继续 */ }
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i >= 0 && j > i) return JSON.parse(t.slice(i, j + 1));
  throw new Error(`无法解析 lark-cli 输出: ${t.slice(0, 200)}`);
}

export function createFeishuCalendar({ profile = null, dryRun = false, runner = runLark } = {}) {
  const base = (args) => (profile ? [...args, '--profile', profile] : args);
  return {
    type: 'feishu',
    async listBusy(start, end) {
      const s0 = Math.max(parseTime(start), Date.now()), e0 = parseTime(end);
      const busy = [];
      for (let s = s0; s < e0; s += 7 * DAY) {
        const e = Math.min(s + 7 * DAY, e0);
        const iso = (ms) => new Date(ms).toISOString();
        const r = await runner(base(['calendar', '+freebusy', '--as', 'user', '--start', iso(s), '--end', iso(e)]));
        const j = parseJsonLoose(r.stdout);
        if (!j.ok) throw new Error(`飞书忙闲查询失败: ${JSON.stringify(j.error || j)}`);
        for (const u of j.data?.users || []) for (const b of u.busy || []) busy.push({ start: b.start_time, end: b.end_time });
      }
      return busy;
    },
    async createEvent(ev) {
      const args = ['calendar', '+create', '--as', 'user', '--summary', ev.summary, '--start', ev.start, '--end', ev.end, '--description', ev.description || ''];
      if (ev.location) args.push('--location', ev.location);
      if (dryRun) args.push('--dry-run');
      const r = await runner(base(args));
      const links = { google: googleAddLink(ev) };
      if (dryRun) return { written: false, ref: 'feishu-dry-run', addLinks: links };
      const j = parseJsonLoose(r.stdout);
      if (!j.ok) throw new Error(`飞书创建日程失败: ${JSON.stringify(j.error || j)}`);
      return { written: true, ref: j.data?.event_id || j.data?.event?.event_id || 'feishu-event', addLinks: links };
    },
    async check() {
      const r = await runner(base(['whoami']));
      if (r.code !== 0) throw new Error('lark-cli 不可用或未登录（lark-cli auth login）');
      return '飞书 lark-cli 可用';
    },
  };
}
