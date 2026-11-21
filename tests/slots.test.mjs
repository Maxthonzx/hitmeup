import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSlots, pickBest, intersectSlots } from '../src/slots.mjs';
import { fromWall, wall } from '../src/tz.mjs';

const av = { weekly: { mon: [['19:00', '22:00']], sat: [['10:00', '12:00']] }, bufferMin: 30, minNoticeHours: 12, maxMeetupsPerDay: 2, horizonDays: 14 };

test('busy + buffer removes overlapping slots', () => {
  const tz = 'Asia/Shanghai';
  const now = fromWall('2026-11-20', '12:00', tz); // 周五
  const busy = [{ start: '2026-11-23T20:00:00+08:00', end: '2026-11-23T20:30:00+08:00' }];
  const s = generateSlots({ availability: av, busy, durationMin: 60, tz, nowMs: now });
  assert.deepEqual(s.filter((x) => x.day === '2026-11-23').map((x) => x.start.slice(11, 16)), ['21:00']); // 19:30-21:00 被挡
  assert.ok(s.some((x) => x.day === '2026-11-30'));
  assert.ok(s.some((x) => x.day === '2026-11-21')); // 周六 10:00，距现在 22h
});

test('min notice excludes near slots', () => {
  const tz = 'Asia/Shanghai';
  const now = fromWall('2026-11-21', '08:00', tz);
  const s = generateSlots({ availability: av, durationMin: 60, tz, nowMs: now });
  assert.ok(!s.some((x) => x.day === '2026-11-21')); // 10:00 距 08:00 仅 2h < 12h
});

test('DST zone: Monday 19:00 local stays 19:00 across the transition', () => {
  const tz = 'America/New_York';
  const now = fromWall('2026-10-20', '12:00', tz);
  const s = generateSlots({ availability: av, durationMin: 60, tz, nowMs: now });
  const oct26 = s.filter((x) => x.day === '2026-10-26');
  const nov2 = s.filter((x) => x.day === '2026-11-02');
  assert.equal(oct26[0].start, '2026-10-26T19:00:00-04:00'); // EDT
  assert.equal(nov2[0].start, '2026-11-02T19:00:00-05:00'); // EST（11/1 夏令时结束）
  assert.equal(wall(nov2[0].startMs, tz).hour, 19);
  assert.equal(oct26.length, nov2.length);
});

test('maxMeetupsPerDay', () => {
  const tz = 'Asia/Shanghai';
  const now = fromWall('2026-11-20', '12:00', tz);
  const meetups = [{ start: '2026-11-23T19:00:00+08:00', end: '2026-11-23T20:00:00+08:00' }, { start: '2026-11-23T21:00:00+08:00', end: '2026-11-23T22:00:00+08:00' }];
  const s = generateSlots({ availability: { ...av, bufferMin: 0 }, meetups, durationMin: 30, tz, nowMs: now });
  assert.ok(!s.some((x) => x.day === '2026-11-23'));
});

test('pickBest spreads across days; intersect', () => {
  const tz = 'Asia/Shanghai';
  const now = fromWall('2026-11-20', '12:00', tz);
  const all = generateSlots({ availability: av, durationMin: 60, tz, nowMs: now });
  const top = pickBest(all, 4);
  assert.equal(top.length, 4);
  assert.ok(new Set(top.map((x) => x.day)).size >= 2);
  const inter = intersectSlots([{ start: all[0].start, end: all[0].end }, { start: '2026-11-22T03:00:00+08:00', end: '2026-11-22T04:00:00+08:00' }], all);
  assert.equal(inter.length, 1);
});
