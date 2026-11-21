import test from 'node:test';
import assert from 'node:assert/strict';
import { offsetMin, toISO, fromWall, wall, dateStr, addDays, weekdayOf, isValidTimezone, fmtSlot } from '../src/tz.mjs';

test('Asia/Shanghai fixed +08:00', () => {
  assert.equal(offsetMin('Asia/Shanghai', Date.UTC(2026, 6, 1)), 480);
  assert.equal(toISO(Date.UTC(2026, 10, 23, 2, 0), 'Asia/Shanghai'), '2026-11-23T10:00:00+08:00');
});

test('America/New_York DST aware', () => {
  assert.equal(offsetMin('America/New_York', Date.UTC(2026, 6, 1)), -240); // EDT
  assert.equal(offsetMin('America/New_York', Date.UTC(2026, 0, 15)), -300); // EST
  assert.equal(fromWall('2026-03-08', '01:30', 'America/New_York'), Date.UTC(2026, 2, 8, 6, 30));
  assert.equal(fromWall('2026-03-08', '12:00', 'America/New_York'), Date.UTC(2026, 2, 8, 16, 0));
  assert.equal(fromWall('2026-11-01', '12:00', 'America/New_York'), Date.UTC(2026, 10, 1, 17, 0));
  assert.equal(toISO(Date.UTC(2026, 10, 1, 17, 0), 'America/New_York'), '2026-11-01T12:00:00-05:00');
});

test('fromWall <-> wall roundtrip across zones', () => {
  for (const tz of ['Europe/London', 'Australia/Sydney', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Auckland']) {
    for (const d of ['2026-01-10', '2026-04-05', '2026-07-01', '2026-10-25', '2026-11-30']) {
      const ms = fromWall(d, '19:30', tz);
      const w = wall(ms, tz);
      assert.equal(`${w.hour}:${w.minute}`, '19:30', `${tz} ${d}`);
      assert.equal(dateStr(ms, tz), d);
    }
  }
  assert.equal(offsetMin('Asia/Kolkata', 0), 330);
});

test('date helpers', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekdayOf('2026-11-23'), 1);
  assert.ok(isValidTimezone('Asia/Tokyo'));
  assert.ok(!isValidTimezone('Mars/Base'));
  assert.equal(fmtSlot({ start: '2026-11-23T10:00:00+08:00', end: '2026-11-23T11:00:00+08:00' }, 'Asia/Shanghai'), '11月23日周一 10:00-11:00');
});
