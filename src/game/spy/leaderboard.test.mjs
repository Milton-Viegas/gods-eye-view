import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  MAX_TIER,
  SPY_TIERS,
  clampTier,
  effectiveRadius,
  maxMissionScore,
  maxPlausibleScore,
  minPlausibleDurationMs,
  readProgress,
  recordMissionResult,
  unlockThreshold,
  validateRunClaim,
} from './difficulty.js';
import {
  QA_TTL_MS,
  createEmptyBoard,
  issueRunToken,
  normalizeBoard,
  pruneBoard,
  queryBoard,
  sanitizeCodename,
  submitScore,
  verifyRunToken,
} from './leaderboardCore.js';
import { createLeaderboardClient } from './leaderboardClient.js';

const sign = (text) =>
  createHmac('sha256', 'segredo-de-teste').update(text).digest('base64url');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('níveis: progressão monotônica de raio, janela, penalidade e multiplicador', () => {
  assert.equal(SPY_TIERS.length, 5);
  for (let i = 1; i < SPY_TIERS.length; i += 1) {
    const prev = SPY_TIERS[i - 1];
    const tier = SPY_TIERS[i];
    assert.ok(tier.radiusScale < prev.radiusScale);
    assert.ok(tier.maxRadiusM < prev.maxRadiusM);
    assert.ok(tier.timeBonusWindowS < prev.timeBonusWindowS);
    assert.ok(tier.wrongPenalty > prev.wrongPenalty);
    assert.ok(tier.multiplier > prev.multiplier);
    assert.ok(tier.hintPenalties.length <= prev.hintPenalties.length);
  }
  assert.equal(effectiveRadius({ radiusM: 900 }, 1), 1350);
  assert.equal(effectiveRadius({ radiusM: 900 }, 2), 900);
  assert.equal(effectiveRadius({ radiusM: 900 }, 5), 320);
  assert.equal(effectiveRadius({ radiusM: 500 }, 5), 200);
  assert.equal(clampTier('9'), MAX_TIER);
  assert.equal(clampTier('abc'), 1);
  assert.equal(maxMissionScore(5, 1), 5000);
  assert.equal(maxMissionScore(5, 5), 15000);
  assert.equal(unlockThreshold(5, 1), 2000);
});

test('campanha: liberar o próximo nível exige 40% da pontuação máxima', () => {
  const storage = memoryStorage();
  assert.equal(readProgress(storage).unlockedTier, 1);
  let r = recordMissionResult(storage, {
    missionId: 'garoa',
    level: 1,
    score: 1999,
    targetCount: 5,
  });
  assert.equal(r.unlocked, null);
  r = recordMissionResult(storage, {
    missionId: 'garoa',
    level: 1,
    score: 2000,
    targetCount: 5,
  });
  assert.equal(r.unlocked, 2);
  // Treino livre não libera níveis.
  r = recordMissionResult(storage, {
    missionId: 'faria-lima',
    level: 2,
    score: 6000,
    targetCount: 5,
    campaign: false,
  });
  assert.equal(r.unlocked, null);
  const progress = readProgress(storage);
  assert.equal(progress.unlockedTier, 2);
  assert.equal(progress.best['garoa:1'], 2000);
  assert.equal(progress.best['faria-lima:2'], 6000);
  assert.equal(readProgress({ getItem: () => '{oops' }).unlockedTier, 1);
});

test('anti-trapaça: duração mínima e teto de pontuação', () => {
  const ok = validateRunClaim({
    targetCount: 5,
    level: 1,
    score: 4200,
    durationMs: 120_000,
    targetsHit: 5,
  });
  assert.equal(ok.ok, true);
  const tooFast = validateRunClaim({
    targetCount: 5,
    level: 1,
    score: 4000,
    durationMs: 5_000,
    targetsHit: 5,
  });
  assert.equal(tooFast.code, 'too-fast');
  const tooHigh = validateRunClaim({
    targetCount: 5,
    level: 1,
    score: 5001,
    durationMs: 60_000,
    targetsHit: 5,
  });
  assert.equal(tooHigh.code, 'too-high');
  // Um acerto só não pode valer mais que 1 alvo.
  assert.equal(
    validateRunClaim({
      targetCount: 5,
      level: 2,
      score: 3000,
      durationMs: 60_000,
      targetsHit: 1,
    }).code,
    'too-high',
  );
  // Partida muito longa: o teto cai (bônus zerado no último alvo).
  const long = maxPlausibleScore({
    targetCount: 5,
    level: 1,
    targetsHit: 5,
    durationMs: 3_600_000,
  });
  assert.equal(long, 4500);
  // Com alvos revelados, o tempo pode ter ido todo para eles: teto cheio por acerto.
  assert.equal(
    maxPlausibleScore({
      targetCount: 5,
      level: 1,
      targetsHit: 1,
      durationMs: 600_000,
    }),
    1000,
  );
  assert.ok(minPlausibleDurationMs(5, 5) >= 20_000);
  assert.equal(
    validateRunClaim({
      targetCount: 5,
      level: 9,
      score: 10,
      durationMs: 60_000,
      targetsHit: 1,
    }).code,
    'tier',
  );
});

test('codinome é saneado (HTML, tamanho, palavrões)', () => {
  assert.equal(sanitizeCodename('<b>coruja</b>'), 'CORUJA');
  assert.equal(sanitizeCodename('<script>alert(1)</script>x'), 'ALERT1 X');
  assert.equal(sanitizeCodename('a'.repeat(40)).length, 20);
  assert.equal(sanitizeCodename('   '), null);
  assert.equal(sanitizeCodename('Agente Caralho'), 'AGENTE ANÔNIMO');
  assert.equal(sanitizeCodename('onça-pintada'), 'ONÇA-PINTADA');
});

test('runId assinado: válido, adulterado e expirado', () => {
  const now = 1_000_000_000_000;
  const token = issueRunToken({
    missionId: 'garoa',
    tier: 2,
    now,
    nonce: 'abc',
    sign,
  });
  assert.deepEqual(verifyRunToken(token, { sign, now: now + 1000 }), {
    r: 'abc',
    m: 'garoa',
    t: 2,
    iat: now,
  });
  const [payload, sig] = token.split('.');
  const forged = `${Buffer.from(JSON.stringify({ r: 'abc', m: 'garoa', t: 5, iat: now })).toString('base64url')}.${sig}`;
  assert.equal(verifyRunToken(forged, { sign, now }), null);
  assert.equal(verifyRunToken(`${payload}.xx`, { sign, now }), null);
  assert.equal(
    verifyRunToken(token, { sign, now: now + 7 * 3600 * 1000 }),
    null,
  );
});

test('quadro: envio, posição, duplicata, melhor marca e QA oculto', () => {
  const t0 = Date.UTC(2026, 9, 8, 12);
  const board = createEmptyBoard(t0);
  const start = (nonce, tier = 1, missionId = 'garoa') =>
    issueRunToken({ missionId, tier, now: t0, nonce, sign });
  const send = (body, now) =>
    submitScore(board, body, { sign, now, nonce: `id-${Math.random()}` });

  const a = send(
    {
      codename: 'CORUJA',
      missionId: 'garoa',
      tier: 1,
      score: 4000,
      durationMs: 90_000,
      targetsHit: 5,
      runId: start('r1'),
    },
    t0 + 95_000,
  );
  assert.equal(a.ok, true);
  assert.equal(a.rank, 1);

  const b = send(
    {
      codename: 'TUCANO',
      missionId: 'garoa',
      tier: 1,
      score: 4200,
      durationMs: 80_000,
      targetsHit: 5,
      runId: start('r2'),
    },
    t0 + 85_000,
  );
  assert.equal(b.rank, 1);
  assert.equal(b.total, 2);

  // Mesmo runId não vale duas vezes.
  const dup = send(
    {
      codename: 'TUCANO',
      missionId: 'garoa',
      tier: 1,
      score: 4300,
      durationMs: 80_000,
      targetsHit: 5,
      runId: start('r2'),
    },
    t0 + 86_000,
  );
  assert.equal(dup.code, 'duplicate');

  // Duração declarada maior que o tempo real desde o início: recusado.
  const clock = send(
    {
      codename: 'GAVIÃO',
      missionId: 'garoa',
      tier: 1,
      score: 3000,
      durationMs: 300_000,
      targetsHit: 5,
      runId: start('r3'),
    },
    t0 + 60_000,
  );
  assert.equal(clock.code, 'clock');

  // runId de outra missão/nível: recusado.
  const wrong = send(
    {
      codename: 'GAVIÃO',
      missionId: 'garoa',
      tier: 3,
      score: 3000,
      durationMs: 60_000,
      targetsHit: 5,
      runId: start('r4', 1),
    },
    t0 + 70_000,
  );
  assert.equal(wrong.code, 'run');

  // Pior marca do mesmo codinome não substitui a melhor.
  const worse = send(
    {
      codename: 'CORUJA',
      missionId: 'garoa',
      tier: 1,
      score: 1000,
      durationMs: 90_000,
      targetsHit: 2,
      runId: start('r5'),
    },
    t0 + 100_000,
  );
  assert.equal(worse.ok, true);
  assert.equal(worse.personalBest, false);
  assert.equal(
    queryBoard(board, { mission: 'garoa', tier: 1 }).entries.find(
      (e) => e.codename === 'CORUJA',
    ).score,
    4000,
  );

  // QA: aceito, mas oculto do ranking público e expira.
  const qa = send(
    {
      codename: 'TESTE-QA-1',
      missionId: 'garoa',
      tier: 1,
      score: 4800,
      durationMs: 60_000,
      targetsHit: 5,
      runId: start('r6'),
    },
    t0 + 65_000,
  );
  assert.equal(qa.ok, true);
  assert.equal(qa.entry.qa, true);
  const pub = queryBoard(board, { mission: 'all', tier: 'all' });
  assert.deepEqual(
    pub.entries.map((e) => e.codename),
    ['TUCANO', 'CORUJA'],
  );
  assert.equal(pub.entries[0].missionCodename, 'OPERAÇÃO GAROA');
  assert.equal(
    queryBoard(board, { includeQa: true }).entries[0].codename,
    'TESTE-QA-1',
  );
  pruneBoard(board, t0 + QA_TTL_MS + 120_000);
  assert.equal(
    queryBoard(board, { includeQa: true }).entries.some((e) => e.qa),
    false,
  );
  assert.equal(queryBoard(board, { tier: 2 }).total, 0);
  assert.equal(normalizeBoard('lixo').entries.length, 0);
});

test('cliente do ranking degrada sem servidor e respeita o modo de teste', async () => {
  const offline = createLeaderboardClient({
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  const r1 = await offline.fetchTop();
  assert.equal(r1.ok, false);
  assert.equal(r1.offline, true);

  const html404 = createLeaderboardClient({
    fetchImpl: async () =>
      new Response('<h1>404</h1>', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }),
  });
  assert.equal((await html404.fetchTop()).offline, true);

  let calls = 0;
  const testMode = createLeaderboardClient({
    enabled: false,
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}');
    },
  });
  assert.equal(
    (await testMode.startRun({ missionId: 'garoa', tier: 1 })).disabled,
    true,
  );
  assert.equal(
    (await testMode.submit({ codename: 'X', runId: 'y' })).disabled,
    true,
  );
  assert.equal(calls, 0);
});
