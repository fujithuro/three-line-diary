// Each page creates its own store. No fetch, localStorage, or database access.
export function createDemoApi(today) {
  const entries = new Map();
  const histories = new Map();
  const shift = days => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const samples = [
    [0, '今日はカレーを食べた。\n洗剤を買い忘れた。\n明日こそ買う。'],
    [-1, '特に何もなかった。早めに寝た。'],
    [-3, '朝、洗濯した。\n昼は冷凍うどん。\n午後はスーパーに行った。\n卵が安かったので買った。\n帰って冷蔵庫を見たら、まだあった。'],
    [-4, '部屋を掃除した。\nなくしたと思っていたペンが出てきた。\n掃除機の充電が途中で切れた。'],
    [-7, 'カレーを作りすぎた。\nたぶん明日もカレー。'],
    [-10, '散歩に出たら雨が降ってきた。\nすぐ帰った。'],
  ];
  function save(date, body, version, savedAt = new Date().toISOString()) {
    const current = entries.get(date);
    if ((current?.version || 0) !== version) {
      const error = new Error('他の画面で変更されています。最新の内容を読み込んで、もう一度編集してください。');
      error.conflict = true;
      throw error;
    }
    if ((current?.body || '') === body) return { ...(current || { date, body: '', version: 0 }) };
    const next = { date, body, version: version + 1, updated_at: savedAt };
    entries.set(date, next);
    const history = histories.get(date) || [];
    history.unshift({ date, body, version: next.version, saved_at: savedAt });
    histories.set(date, history);
    return { ...next };
  }
  for (const [offset, body] of samples) {
    const date = shift(offset);
    if (offset === 0) save(date, '今日はカレーを食べた。', 0, `${date}T09:00:00Z`);
    save(date, body, entries.get(date)?.version || 0, `${date}T10:00:00Z`);
  }
  return async (path, options = {}) => {
    const url = new URL(path, 'https://demo.invalid/');
    if (url.pathname === '/entries' && (!options.method || options.method === 'GET')) {
      const start = url.searchParams.get('start'), end = url.searchParams.get('end');
      return [...entries.values()].filter(row => row.date >= start && row.date <= end)
        .sort((a, b) => a.date.localeCompare(b.date)).map(row => ({ ...row }));
    }
    const match = url.pathname.match(/^\/entries\/(\d{4}-\d{2}-\d{2})(\/history)?$/);
    if (match?.[2] && (!options.method || options.method === 'GET')) {
      const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
      return (histories.get(match[1]) || []).filter(row => row.version < before).slice(0, 30).map(row => ({ ...row }));
    }
    if (match && !match[2] && options.method === 'PUT') {
      const { body, version } = JSON.parse(options.body);
      if (typeof body !== 'string' || body.length > 100000 || !Number.isSafeInteger(version) || version < 0) throw new Error('入力内容を確認してください。');
      return save(match[1], body, version);
    }
    // Never fall through to the real API, even for an unsupported demo operation.
    throw new Error('デモではこの操作に対応していません。');
  };
}
