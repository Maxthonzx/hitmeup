#!/usr/bin/env node
// 端到端：两个 Dazi 实例（alice 7788/7790 上海时区，bob 7888/7890 纽约时区），--no-tunnel，目录/通知全部关闭。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT } from '../src/opts.mjs';

const TMP = path.join(ROOT, 'tmp');
const MAIN = path.join(ROOT, 'src', 'main.mjs');
const CLI = path.join(ROOT, 'src', 'cli.mjs');
const A = { name: 'alice', tz: 'Asia/Shanghai', pub: 7788, adm: 7790 };
const B = { name: 'bob', tz: 'America/New_York', pub: 7888, adm: 7890 };
const children = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let step = 0;
const ok = (m) => console.log(`  ✅ ${++step}. ${m}`);

function init(x, extra = []) {
  const dir = path.join(TMP, x.name);
  fs.rmSync(dir, { recursive: true, force: true });
  const r = spawnSync(process.execPath, [CLI, 'init', '--data', dir, '--handle', x.name, '--nickname', x.name[0].toUpperCase() + x.name.slice(1),
    '--city', x.name === 'alice' ? '上海' : 'New York', '--tagline', `我是${x.name}`, '--hobbies', '咖啡,羽毛球', '--timezone', x.tz, '--wechat', `${x.name}_wx`, '--phone', `${x.name}_PRIVATE_PHONE`,
    '--share', 'wechat', ...extra], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return dir;
}

function start(x, dir) {
  const env = {
    ...process.env, DAZI_DATA_DIR: dir, DAZI_PUBLIC_PORT: String(x.pub), DAZI_ADMIN_PORT: String(x.adm),
    DAZI_PUBLIC_URL: `http://127.0.0.1:${x.pub}`, DAZI_DIRECTORY: 'off', DAZI_POLL_MS: '700',
  };
  const c = spawn(process.execPath, [MAIN, '--no-tunnel'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d));
  c.getOut = () => out;
  children.push(c);
  return c;
}

const pubUrl = (x) => `http://127.0.0.1:${x.pub}`;
const admUrl = (x) => `http://127.0.0.1:${x.adm}`;
async function admin(x, p, method = 'GET', body) {
  const r = await fetch(admUrl(x) + p, { method, headers: { 'content-type': 'application/json', 'x-dazi-admin': '1' }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
async function pub(x, p, method = 'GET', body) {
  const r = await fetch(pubUrl(x) + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  try { return { status: r.status, json: JSON.parse(text) }; } catch { return { status: r.status, text }; }
}
async function waitFor(fn, what, ms = 15000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`超时等待：${what}`);
    await sleep(200);
  }
}

async function main() {
  console.log('Dazi e2e');
  const da = init(A), db = init(B);
  const ca = start(A, da), cb = start(B, db);
  for (const x of [A, B]) await waitFor(async () => (await pub(x, '/api/ping')).json?.ok, `${x.name} 启动`);
  ok('两个实例启动（Alice 上海 / Bob 纽约）');

  // 公开面安全
  const prof = await pub(B, '/api/profile');
  assert.equal(prof.json.profile.nickname, 'Bob');
  assert.ok(!JSON.stringify(prof.json).includes('bob_wx') && !JSON.stringify(prof.json).includes('PRIVATE_PHONE'));
  assert.equal((await pub(B, '/api/state')).status, 404);
  assert.equal((await pub(B, '/admin')).status, 404);
  const card = await fetch(pubUrl(B) + '/');
  const html = await card.text();
  assert.ok(html.includes('Bob') && !html.includes('bob_wx'));
  const llms = await pub(B, '/llms.txt');
  assert.ok(llms.text.includes('/a2a'));
  const ac = (await pub(B, '/.well-known/agent-card.json')).json;
  assert.equal(ac.url, `${pubUrl(B)}/a2a`);
  assert.equal(ac.protocolVersion, '0.3.0');
  ok('公开资料/卡片页/agent-card/llms.txt 正常，联系方式与管理路由未泄露');

  // 管理端保护
  const noHdr = await fetch(admUrl(B) + '/api/profile', { method: 'PUT', body: '{}' });
  assert.equal(noHdr.status, 403);
  const badStatus = await new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port: B.adm, path: '/api/state', headers: { host: 'evil.example:7890' } }, (res) => { res.resume(); resolve(res.statusCode); });
    r.on('error', () => resolve(0)); r.end();
  });
  assert.equal(badStatus, 403); // DNS rebinding 防护：Host 不对
  ok('管理端：缺少管理头的写请求被拒绝');

  // Alice 主动约 Bob
  const out = await admin(A, '/api/outbound', 'POST', { target: pubUrl(B), title: '喝咖啡', durationMin: 60, meetupType: '喝咖啡', note: 'e2e 测试' });
  assert.ok(out.ok, JSON.stringify(out));
  assert.equal(out.profile.nickname, 'Bob');
  assert.equal(out.request.status, 'pending');
  assert.ok(!JSON.stringify(out).includes('bob_wx'), '审批前不得拿到 Bob 的联系方式');
  ok('Alice 发起邀约 → get-profile 成功，Bob 状态 pending（跨时区求交成功）');

  const bobState = await waitFor(async () => { const s = await admin(B, '/api/state'); return s.requests.some((r) => r.direction === 'in' && r.status === 'pending') && s; }, 'Bob 收到请求');
  const inReq = bobState.requests.find((r) => r.direction === 'in');
  assert.equal(inReq.from.name, 'Alice');
  assert.ok(inReq.from.contact.includes('alice_wx'));
  ok(`Bob 后台收到 Alice 的 pending 请求：${inReq.slotLabels[0]}（Bob 时区）`);

  // Bob 批准
  const acc = await admin(B, `/api/requests/${inReq.id}/accept`, 'POST', { slotIndex: 0, place: 'Cafe E2E' });
  assert.ok(acc.ok, JSON.stringify(acc));
  assert.equal(acc.request.status, 'accepted');
  assert.match(acc.request.addLinks.google, /calendar\.google\.com/);
  ok('Bob 通过管理 API 接受；日历为 none，退化为添加链接');

  // Alice 轮询到 completed
  const aState = await waitFor(async () => { const s = await admin(A, '/api/state'); return s.requests.some((r) => r.direction === 'out' && r.status === 'accepted') && s; }, 'Alice 轮询到 completed');
  const outReq = aState.requests.find((r) => r.direction === 'out');
  assert.equal(outReq.slot.start, acc.request.slot.start);
  assert.equal(outReq.result.place, 'Cafe E2E');
  assert.deepEqual(outReq.result.contacts, { 微信: 'bob_wx' });
  assert.ok(!JSON.stringify(outReq).includes('PRIVATE_PHONE'));
  ok(`Alice 轮询到 completed：${outReq.label}（上海时区）@ ${outReq.result.place}，拿到 Bob 的微信，未拿到手机`);

  // 双方日历/忙碌
  const sa = await admin(A, '/api/slots?duration=60&n=30'), sb = await admin(B, '/api/slots?duration=60&n=30');
  const t0 = Date.parse(outReq.slot.start);
  assert.ok(!sa.slots.some((s) => Math.abs(Date.parse(s.start) - t0) < 3600000), 'Alice 该时段应已占用');
  assert.ok(!sb.slots.some((s) => Math.abs(Date.parse(s.start) - t0) < 3600000), 'Bob 该时段应已占用');
  ok('双方的该时段都已计为占用，不再对外提供');

  // 浏览器表单式 REST 约见
  const slots = (await pub(B, '/api/slots?duration=60')).json.slots;
  assert.ok(slots.length >= 3);
  const honey = await pub(B, '/api/meetup', 'POST', { name: 'Bot', contact: 'x', website: 'http://spam', slot: slots[0] });
  assert.ok(honey.json.ok && !honey.json.id, '蜜罐应假装成功且不创建请求');
  const mr = await pub(B, '/api/meetup', 'POST', { name: 'Carol', intro: '路过的访客', contact: 'carol_wx', title: '散步', meetupType: '散步', durationMin: 60, note: '<b>x</b>', slot: { start: slots[0].start, end: slots[0].end } });
  assert.ok(mr.json.ok, JSON.stringify(mr.json));
  const st = (await pub(B, `/api/requests/${mr.json.id}?t=${mr.json.token}`)).json.request;
  assert.equal(st.status, 'pending');
  assert.equal(st.contacts, undefined);
  assert.equal((await pub(B, `/api/requests/${mr.json.id}?t=wrong`)).status, 404);
  const page = await pub(B, mr.json.url);
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('/api/requests/'));
  ok('REST 表单式约见：pending，状态页可访问，错误 token 404，蜜罐生效');

  // Bob 换个时间 -> Carol 确认
  const alt = (await admin(B, `/api/requests/${mr.json.id}/slots`)).slots.find((s) => s.start !== slots[0].start);
  const cn = await admin(B, `/api/requests/${mr.json.id}/counter`, 'POST', { slot: { start: alt.start, end: alt.end } });
  assert.equal(cn.request.status, 'counter');
  const cs = (await pub(B, `/api/requests/${mr.json.id}?t=${mr.json.token}`)).json.request;
  assert.equal(cs.status, 'counter');
  const cf = await pub(B, `/api/requests/${mr.json.id}/confirm?t=${mr.json.token}`, 'POST', {});
  assert.equal(cf.json.request.status, 'accepted');
  assert.deepEqual(cf.json.request.contacts, { 微信: 'bob_wx' });
  const ics = await fetch(pubUrl(B) + cf.json.request.addLinks.icsUrl);
  assert.equal(ics.status, 200);
  assert.match(await ics.text(), /BEGIN:VEVENT/);
  ok('换个时间 → 访客确认 → accepted，联系方式放行，.ics 可下载');

  // 打招呼 + 婉拒
  const hi = await pub(B, '/api/hi', 'POST', { name: 'Dave', message: '你好呀', contact: 'dave' });
  assert.ok(hi.json.ok);
  assert.equal((await admin(B, '/api/state')).inbox[0].name, 'Dave');
  const m2 = await pub(B, '/api/meetup', 'POST', { name: 'Eve', contact: 'eve', durationMin: 60, slot: (await pub(B, '/api/slots?duration=60')).json.slots[1] });
  assert.ok(m2.json.ok);
  assert.equal((await admin(B, `/api/requests/${m2.json.id}/decline`, 'POST', {})).request.status, 'declined');
  assert.equal((await pub(B, `/api/requests/${m2.json.id}?t=${m2.json.token}`)).json.request.status, 'declined');
  ok('打招呼进收件箱；婉拒状态可见');

  // CLI meet（对着 Alice 的管理端口）
  const meet = spawnSync(process.execPath, [CLI, 'meet', pubUrl(B), '--title', '吃饭', '--duration', '60', '--admin-port', String(A.adm)], { encoding: 'utf8' });
  assert.equal(meet.status, 0, meet.stderr + meet.stdout);
  assert.ok(meet.stdout.includes('已发出邀约'));
  ok('CLI: npm run meet -- <url> 发出第二个邀约');

  // 限流
  let limited = false;
  for (let i = 0; i < 12 && !limited; i++) {
    const r = await pub(B, '/api/hi', 'POST', { name: 'Spam', message: 'x' });
    if (r.status === 429) limited = true;
  }
  assert.ok(limited, '应触发限流 429');
  ok('每 IP 写入限流生效（429）');

  console.log('\n🎉 e2e 全部通过');
}

let code = 0;
try { await main(); } catch (e) {
  code = 1;
  console.error('\n❌ e2e 失败：', e.message);
  for (const c of children) console.error('--- 子进程输出 ---\n' + c.getOut());
} finally {
  for (const c of children) c.kill();
  await sleep(300);
  process.exit(code);
}
