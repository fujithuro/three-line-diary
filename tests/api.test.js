import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { validDate } from '../src/worker.js';
test('calendar validation rejects nonexistent dates', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const value of ['2025-02-29', '2026-04-31', null, 'bad']) assert.equal(validDate(value), false);
});
test('API rejects missing or wrong token before touching database', async () => {
  for (const token of ['', 'Bearer wrong']) {
    const response = await worker.fetch(new Request('https://diary.test/api/entries', { headers: { Authorization: token } }), { DIARY_TOKEN: 'secret' });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});
test('API validates ranges after authenticating', async () => {
  const response = await worker.fetch(new Request('https://diary.test/api/entries?start=2026-01-01&end=2026-12-31', { headers: { Authorization: 'Bearer secret' } }), { DIARY_TOKEN: 'secret' });
  assert.equal(response.status, 400);
});
