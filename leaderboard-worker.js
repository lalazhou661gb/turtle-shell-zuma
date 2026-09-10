const KV_KEY = 'leaderboard';
const MAX_ENTRIES = 50;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders()),
  });
}

async function readBoard(env) {
  const raw = await env.LB.get(KV_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

async function writeBoard(env, board) {
  await env.LB.put(KV_KEY, JSON.stringify(board));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/leaderboard') {
      const board = await readBoard(env);
      const top = board.slice().sort((a, b) => b.score - a.score).slice(0, 5);
      return json({ top });
    }

    if (request.method === 'GET' && url.pathname === '/score') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'missing id' }, 400);
      const board = await readBoard(env);
      const entry = board.find((e) => e.id === id);
      return json({ entry: entry || null });
    }

    if (request.method === 'POST' && url.pathname === '/score') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
      const id = typeof body.id === 'string' ? body.id.slice(0, 64) : '';
      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 24) : '無名龜';
      const score = Number(body.score);
      if (!id || !Number.isFinite(score)) return json({ error: 'invalid payload' }, 400);

      const board = await readBoard(env);
      const idx = board.findIndex((e) => e.id === id);
      if (idx === -1) {
        board.push({ id, name, score, updatedAt: Date.now() });
      } else if (score > board[idx].score) {
        board[idx] = { id, name, score, updatedAt: Date.now() };
      } else {
        board[idx].name = name;
      }
      board.sort((a, b) => b.score - a.score);
      const trimmed = board.slice(0, MAX_ENTRIES);
      await writeBoard(env, trimmed);

      const top = trimmed.slice(0, 5);
      const mine = trimmed.find((e) => e.id === id) || { id, name, score };
      return json({ ok: true, top, mine });
    }

    return json({ error: 'not found' }, 404);
  },
};
