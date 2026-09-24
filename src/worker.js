const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) > 0 &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
async function authorized(request, secret) {
  if (!secret) return false;
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(request.headers.get('Authorization') || ''), digest(`Bearer ${secret}`)]);
  return a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!await authorized(request, env.DIARY_TOKEN)) return json({ error: 'unauthorized' }, 401);
    try {
      if (url.pathname === '/api/entries' && request.method === 'GET') {
        const start = url.searchParams.get('start'), end = url.searchParams.get('end');
        if (!validDate(start) || !validDate(end) || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 92) return json({ error: 'invalid_range' }, 400);
        const { results } = await env.DB.prepare('SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date').bind(start, end).all();
        return json(results);
      }
      const match = url.pathname.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})(\/history)?$/);
      if (!match || !validDate(match[1])) return json({ error: 'not_found' }, 404);
      const date = match[1];
      if (match[2] && request.method === 'GET') {
        const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
        if (!Number.isSafeInteger(before) || before < 1) return json({ error: 'invalid_cursor' }, 400);
        const { results } = await env.DB.prepare('SELECT * FROM revisions WHERE date = ? AND version < ? ORDER BY version DESC LIMIT 30').bind(date, before).all();
        return json(results);
      }
      if (!match[2] && request.method === 'PUT') {
        let input;
        try { input = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
        if (!input || typeof input.body !== 'string' || input.body.length > 100000 || !Number.isSafeInteger(input.version) || input.version < 0) return json({ error: 'invalid_entry' }, 400);
        const current = await env.DB.prepare('SELECT * FROM entries WHERE date = ?').bind(date).first();
        if ((current?.version || 0) !== input.version) return json({ error: 'conflict' }, 409);
        if ((current?.body || '') === input.body) return json(current || { date, body: '', version: 0 });
        const stamp = new Date().toISOString();
        // Compare-and-swap also catches another save between the read and write.
        const result = current
          ? await env.DB.prepare('UPDATE entries SET body = ?, version = version + 1, updated_at = ? WHERE date = ? AND version = ?').bind(input.body, stamp, date, input.version).run()
          : await env.DB.prepare('INSERT INTO entries(date, body, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(date) DO NOTHING').bind(date, input.body, stamp).run();
        if (!result.meta.changes) return json({ error: 'conflict' }, 409);
        return json({ date, body: input.body, version: input.version + 1, updated_at: stamp });
      }
      return json({ error: 'method_not_allowed' }, 405);
    } catch (error) {
      console.error('Diary database operation failed', error.name);
      return json({ error: 'server_error' }, 500);
    }
  }
};
