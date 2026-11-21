import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAgent } from '../src/agent.mjs';
import { handleRpc } from '../src/a2a.mjs';
import { writeJson, dataPaths, normalizeProfile } from '../src/data.mjs';

function mkAgent(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hitmeup-'));
  const p = dataPaths(dir);
  writeJson(p.profile, normalizeProfile({
    handle: 'owner-x', nickname: 'Owner', contacts: { wechat: 'owner_wx', phone: '123' }, contactsToShare: ['wechat'],
    favoritePlaces: [{ name: 'Cafe A', type: 'cafe' }],
  }));
  writeJson(p.config, { timezone: 'Asia/Shanghai', calendar: { type: 'none' }, notify: {}, secret: 'abc' });
  const agent = createAgent({ dataDir: dir, directory: 'off', log: () => {}, ...extra });
  return { agent, dir };
}
const from = { name: 'Bob', intro: 'hi', contact: 'bob_wx' };

test('slots exclude past/min-notice and are in owner tz', async () => {
  const { agent } = mkAgent();
  const s = await agent.freeSlots(60, 12);
  assert.ok(s.length > 0 && s.length <= 12);
  assert.match(s[0].start, /\+08:00$/);
});

test('request lifecycle: create -> accept -> contacts revealed, slot becomes busy', async () => {
  const { agent } = mkAgent();
  const [slot] = await agent.freeSlots(60, 3);
  const r = await agent.createInbound({ from, meeting: { durationMin: 60, meetupType: '喝咖啡', place: 'Cafe A' }, slots: [slot] });
  assert.equal(r.status, 'pending');
  let v = agent.publicStatus(r.id, r.token);
  assert.equal(v.status, 'pending');
  assert.equal(v.contacts, undefined);
  assert.equal(agent.publicStatus(r.id, 'wrong'), null);

  const a = await agent.approve(r.id);
  assert.equal(a.status, 'accepted');
  assert.equal(a.written, false);
  assert.match(a.addLinks.google, /calendar\.google\.com/);
  v = agent.publicStatus(r.id, r.token);
  assert.deepEqual(v.contacts, { 微信: 'owner_wx' }); // 只分享 contactsToShare，不含手机
  assert.equal(v.place, 'Cafe A');
  assert.match(agent.icsFor(agent.getRequest(r.id)), /BEGIN:VEVENT/);

  const after = await agent.candidateSlots(60);
  assert.ok(!after.some((x) => x.startMs === Date.parse(slot.start)), '已确认时间不再提供');
  await assert.rejects(() => agent.approve(r.id), /已是/);
});

test('decline and counter + confirm', async () => {
  const { agent } = mkAgent();
  const [s1, s2] = await agent.freeSlots(60, 6);
  const r1 = await agent.createInbound({ from, meeting: { durationMin: 60 }, slots: [s1] });
  assert.equal((await agent.decline(r1.id)).status, 'declined');
  const r2 = await agent.createInbound({ from, meeting: { durationMin: 60 }, slots: [s1] });
  const c = await agent.counter(r2.id, s2);
  assert.equal(c.status, 'counter');
  assert.equal(agent.publicStatus(r2.id, r2.token).counterSlot.start, s2.start);
  const done = await agent.confirmCounter(r2.id, r2.token);
  assert.equal(done.status, 'accepted');
  assert.equal(done.slot.start, s2.start);
});

test('rejects slots outside free time, validates contact', async () => {
  const { agent } = mkAgent();
  await assert.rejects(() => agent.createInbound({ from, meeting: { durationMin: 60 }, slots: [{ start: '2020-01-01T00:00:00Z', end: '2020-01-01T01:00:00Z' }] }), (e) => e.code === 'no_overlap' && e.extra.freeSlots.length > 0);
  const [slot] = await agent.freeSlots(60, 1);
  await assert.rejects(() => agent.createInbound({ from: { name: 'X' }, meeting: {}, slots: [slot] }), /联系方式/);
});

test('A2A: get-profile hides contacts; request-meetup input-required / rejected+freeSlots; tasks/get follows approval', async () => {
  const { agent } = mkAgent();
  const msg = (data) => ({ jsonrpc: '2.0', id: 1, method: 'message/send', params: { message: { kind: 'message', role: 'user', messageId: 'm', parts: [{ kind: 'data', data }] } } });
  const gp = await handleRpc(agent, msg({ type: 'get-profile' }));
  assert.equal(gp.result.status.state, 'completed');
  assert.ok(!JSON.stringify(gp).includes('owner_wx'));

  const bad = await handleRpc(agent, msg({ type: 'request-meetup', from, meeting: { durationMin: 60 }, slots: [{ start: '2020-01-01T00:00:00Z', end: '2020-01-01T01:00:00Z' }] }));
  assert.equal(bad.result.status.state, 'rejected');
  const hint = bad.result.artifacts[0].parts[0].data.freeSlots;
  assert.ok(hint.length > 0 && hint.length <= 8);

  const ok = await handleRpc(agent, msg({ type: 'request-meetup', from, meeting: { durationMin: 60, title: '喝咖啡' }, slots: hint.slice(0, 2) }));
  assert.equal(ok.result.status.state, 'input-required');
  const tid = ok.result.id;
  const reqId = tid.split('_')[0];
  let t = await handleRpc(agent, { jsonrpc: '2.0', id: 2, method: 'tasks/get', params: { id: tid } });
  assert.equal(t.result.status.state, 'input-required');
  await agent.approve(reqId);
  t = await handleRpc(agent, { jsonrpc: '2.0', id: 3, method: 'tasks/get', params: { id: tid } });
  assert.equal(t.result.status.state, 'completed');
  assert.deepEqual(t.result.artifacts[0].parts[0].data.contacts, { 微信: 'owner_wx' });
  const nf = await handleRpc(agent, { jsonrpc: '2.0', id: 4, method: 'tasks/get', params: { id: reqId + '_bad' } });
  assert.equal(nf.error.code, -32001);
});

test('inbox say-hi, pending cap', async () => {
  const { agent } = mkAgent();
  agent.addHi({ name: 'Zed', message: 'yo' });
  assert.equal(agent.inbox().length, 1);
  assert.throws(() => agent.addHi({ name: '', message: 'x' }));
});

test('control chars stripped', async () => {
  const { agent } = mkAgent();
  agent.addHi({ name: 'Z\u0000e\u0007d', message: 'a\u001bb' });
  assert.equal(agent.inbox()[0].name, 'Zed');
  assert.equal(agent.inbox()[0].message, 'ab');
});
