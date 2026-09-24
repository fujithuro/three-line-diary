import { test } from 'node:test';
import assert from 'node:assert/strict';
// Run against a disposable local D1: DIARY_TEST_URL=http://localhost:8787 npm test
const base = process.env.DIARY_TEST_URL;
test('D1 saves, keeps empty revisions, rejects concurrent writes and restores', { skip: !base }, async () => {
  const date='2001-01-01';
  const request = async (path, body) => fetch(`${base}/api/${path}`, { method:body?'PUT':'GET', headers:{Authorization:'Bearer local-verification-token','Content-Type':'application/json'}, ...(body?{body:JSON.stringify(body)}:{}) });
  const rows=await (await request(`entries?start=${date}&end=${date}`)).json();
  let version=rows[0]?.version || 0;
  const body='検証 '+Date.now();
  let response=await request(`entries/${date}`,{body,version});assert.equal(response.status,200);version=(await response.json()).version;
  response=await request(`entries/${date}`,{body,version});assert.equal((await response.json()).version,version);
  const race=await Promise.all(['A','B'].map(body=>request(`entries/${date}`,{body,version})));
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);version++;
  response=await request(`entries/${date}`,{body:'',version});assert.equal(response.status,200);version++;
  let history=await (await request(`entries/${date}/history`)).json();assert.equal(history[0].body,'');assert.equal(history[2].body,body);
  response=await request(`entries/${date}`,{body,version});assert.equal(response.status,200);version++;
  history=await (await request(`entries/${date}/history`)).json();assert.equal(history[0].version,version);assert.equal(history[0].body,body);assert.equal(history[1].body,'');
  const invalid=await fetch(`${base}/api/entries?start=${date}&end=${date}`);assert.equal(invalid.status,401);
});
