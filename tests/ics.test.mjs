import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { busyFromICS, normalizeIcsUrl } from '../src/calendar/ics.mjs';
import { googleAddLink, buildICS } from '../src/calendar/links.mjs';

const text = fs.readFileSync(new URL('./fixtures/recurring.ics', import.meta.url), 'utf8');

test('recurring event expands with DST-correct UTC, honors EXDATE', () => {
  const b = busyFromICS(text, Date.parse('2026-11-01T00:00:00Z'), Date.parse('2026-12-10T00:00:00Z'));
  const weekly = b.filter((x) => x.end.slice(11, 16) === '01:30'); // 19:00-20:30 EST = 00:00-01:30Z
  assert.deepEqual(weekly.map((x) => x.start.slice(0, 16)), ['2026-11-03T00:00', '2026-11-10T00:00', '2026-11-24T00:00', '2026-12-01T00:00', '2026-12-08T00:00']);
});

test('single event kept; all-day and TRANSPARENT ignored', () => {
  const b = busyFromICS(text, Date.parse('2026-11-20T00:00:00Z'), Date.parse('2026-11-25T00:00:00Z'));
  assert.ok(b.some((x) => x.start.startsWith('2026-11-21T15:00')));
  assert.ok(!b.some((x) => x.start.startsWith('2026-11-22T15:00')));
  assert.equal(b.filter((x) => x.start.startsWith('2026-11-21T00:00')).length, 0);
});

test('window filtering', () => {
  assert.equal(busyFromICS(text, Date.parse('2027-06-01T00:00:00Z'), Date.parse('2027-06-10T00:00:00Z')).length, 0);
});

test('webcal url + add links + ics build', () => {
  assert.equal(normalizeIcsUrl('webcal://p01-caldav.icloud.com/x.ics'), 'https://p01-caldav.icloud.com/x.ics');
  const ev = { start: '2026-11-23T10:00:00+08:00', end: '2026-11-23T11:00:00+08:00', summary: 'hi, you', description: '', location: '' };
  assert.match(googleAddLink(ev), /dates=20261123T020000Z%2F20261123T030000Z/);
  const ics = buildICS({ uid: 'u', ...ev });
  assert.match(ics, /DTSTART:20261123T020000Z/);
  assert.match(ics, /SUMMARY:hi\\, you/);
});
