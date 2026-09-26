import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi } from '../public/demo.js';
import worker from '../src/worker.js';
const today = '2026-09-26';
const range = `entries?start=${today}&end=2026-09-27`;
const write = (api, body, version) => api(`entries/${today}`, { method: 'PUT', body: JSON.stringify({ body, version }) });
test('demo saves and restores history, but resets in a new page store', async () => {
  const api = createDemoApi(today), separateTab = createDemoApi(today);
  const original = (await api(range))[0];
  assert.equal((await api(range)).length, 1); // Tomorrow remains blank.
  const saved = await write(api, 'デモの編集', original.version);
  assert.equal((await api(range))[0].body, 'デモの編集');
  const unchanged = await write(api, saved.body, saved.version);
  assert.equal(unchanged.version, saved.version);
  await assert.rejects(write(api, 'stale', original.version), e => e.conflict);
  const empty = await write(api, '', saved.version);
  const history = await api(`entries/${today}/history`);
  assert.equal(history[0].body, '');
  assert.equal(history[1].body, 'デモの編集');
  const restored = await write(api, original.body, empty.version);
  assert.equal(restored.version, empty.version + 1);
  assert.deepEqual(await separateTab(range), await createDemoApi(today)(range));
  assert.equal((await separateTab(range))[0].version, original.version);
  await assert.rejects(api('unsupported'));
});
test('demo history is paginated and returned objects cannot mutate the store', async () => {
  const api = createDemoApi(today);
  let row = (await api(range))[0];
  for (let i = 0; i < 35; i++) row = await write(api, String(i), row.version);
  const page = await api(`entries/${today}/history`);
  assert.equal(page.length, 30);
  const next = await api(`entries/${today}/history?before=${page.at(-1).version}`);
  assert.ok(next.every(row => row.version < page.at(-1).version));
  page[0].body = 'mutated';
  assert.equal((await api(`entries/${today}/history`))[0].body, '34');
});
test('demo routes share the HTML shell without accessing the DB; API remains private', async () => {
  const env = { ASSETS: { fetch: request => {
    assert.equal(new URL(request.url).pathname, '/');
    return new Response('<section id="login">Login</section>', { headers: { 'Content-Type': 'text/html' } });
  } }, get DB() { throw new Error('Demo must not access DB'); } };
  for (const path of ['/demo', '/demo/']) {
    const response = await worker.fetch(new Request('https://diary.test' + path), env);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /section hidden/);
  }
  const response = await worker.fetch(new Request('https://diary.test/api/entries?demo=true'), env);
  assert.equal(response.status, 401);
});
