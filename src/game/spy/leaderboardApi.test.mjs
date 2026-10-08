import test from 'node:test';
import assert from 'node:assert/strict';

// Exercita a função serverless real (api/spy-leaderboard.js) com o
// armazenamento em memória que o @vercel/functions usa fora da Vercel.
process.env.SPY_LEADERBOARD_SECRET = 'segredo-de-teste-local-1234';
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_STORE_ID;
const originalWarn = console.warn;
console.warn = () => {};
const api = await import('../../../api/spy-leaderboard.js');
console.warn = originalWarn;

const URL_BASE = 'https://example.test/api/spy-leaderboard';
const post = (body, ip = '10.0.0.1') =>
  api.POST(
    new Request(URL_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: JSON.stringify(body),
    }),
  );

test('API: GET vazio, start, envio recusado por rapidez e GET filtrado', async () => {
  const empty = await api.GET(new Request(`${URL_BASE}?mission=all&tier=all`));
  assert.equal(empty.status, 200);
  const emptyBody = await empty.json();
  assert.equal(emptyBody.ok, true);
  assert.equal(emptyBody.storage, 'memory');
  assert.ok(Array.isArray(emptyBody.entries));

  const bad = await api.GET(new Request(`${URL_BASE}?mission=nada`));
  assert.equal(bad.status, 400);

  const start = await post({ action: 'start', missionId: 'garoa', tier: 1 });
  assert.equal(start.status, 200);
  const { runId } = await start.json();
  assert.match(runId, /^[\w-]+\.[\w-]+$/);

  // Enviado logo após o início: duração declarada > tempo real → recusado.
  const tooSoon = await post({
    codename: 'CORUJA',
    missionId: 'garoa',
    tier: 1,
    score: 4000,
    durationMs: 120_000,
    targetsHit: 5,
    runId,
  });
  assert.equal(tooSoon.status, 422);
  assert.equal((await tooSoon.json()).code, 'clock');

  const forged = await post({
    codename: 'CORUJA',
    missionId: 'garoa',
    tier: 1,
    score: 900,
    durationMs: 1000,
    targetsHit: 1,
    runId: 'abc.def',
  });
  assert.equal(forged.status, 403);

  const junk = await api.POST(
    new Request(URL_BASE, { method: 'POST', body: 'not json' }),
  );
  assert.equal(junk.status, 400);
});

test('API: limite de taxa por IP', async () => {
  let last;
  for (let i = 0; i < 32; i += 1)
    last = await post(
      { action: 'start', missionId: 'garoa', tier: 1 },
      '10.9.9.9',
    );
  assert.equal(last.status, 429);
});
