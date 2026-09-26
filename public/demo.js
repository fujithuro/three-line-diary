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
    [0, '帰り道、いつもと違う路地を歩いてみた。\n小さなパン屋を見つけて、明日の朝ごはんを買った。\nこういう寄り道もいい。'],
    [-1, '読みかけの本を、少しだけ進めた。'],
    [-3, '窓を開けると、気持ちのいい風が入ってきた。\n机の上を片づけてから、ゆっくりコーヒーを淹れた。\n午後は近所を散歩。\n公園のベンチで、何もせずに過ごす時間があった。\n忙しくない日も、書き残しておきたい。'],
    [-4, '久しぶりに友人と話した。\n昔の話で、思っていたより長電話になった。\nまた近いうちに会いたい。'],
    [-7, '夕飯のスープがうまくできた。\n少し多めに作ったので、明日の分もある。'],
    [-10, '散歩の途中で、きれいな空を見た。\n写真にはうまく写らなかったけれど、覚えておこう。'],
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
    if (offset === 0) save(date, '帰り道、いつもと違う路地を歩いてみた。', 0, `${date}T09:00:00Z`);
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
