import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateLabel } from '../public/calendar.js';
test('weekends color only weekday, holidays override Saturday', () => {
  assert.equal(dateLabel('2026-09-26').className, 'weekday-saturday');
  assert.equal(dateLabel('2026-09-27').className, 'weekday-holiday');
  assert.equal(dateLabel('2026-09-25').className, '');
  assert.equal(dateLabel('2026-09-23').date, '2026年9月23日');
  assert.equal(dateLabel('2026-09-23').weekday, '(水・祝)');
  assert.equal(dateLabel('2026-09-23').holiday, '秋分の日');
  assert.equal(dateLabel('2026-09-23').className, 'weekday-holiday');
  assert.equal(dateLabel('2024-11-23').className, 'weekday-holiday');
});
test('official data includes substitute, bridge and exceptional holidays', () => {
  for (const date of ['2026-05-06', '2026-09-22', '2019-05-01', '2021-07-22']) assert.ok(dateLabel(date).holiday);
  assert.equal(dateLabel('2021-07-19').holiday, '');
  assert.equal(dateLabel('2028-01-01').holiday, '');
});
