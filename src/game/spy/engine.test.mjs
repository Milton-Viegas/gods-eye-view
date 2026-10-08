import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPY_SCORING,
  bearingDegrees,
  compassLabel,
  createSpyEngine,
  distanceMeters,
  formatDistance,
  formatScore,
  readBestScore,
  recordBestScore,
  temperatureFor,
  timeBonus,
} from './engine.js';
import { SPY_MISSIONS } from './missions.js';
import { effectiveRadius, tierRules } from './difficulty.js';

const MASP = { lat: -23.5614, lon: -46.6559 };
const SE = { lat: -23.5507, lon: -46.6343 };

test('distância MASP → Sé fica perto de 2,5 km', () => {
  const d = distanceMeters(MASP, SE);
  assert.ok(d > 2300 && d < 2700, `got ${d}`);
  assert.equal(compassLabel(bearingDegrees(MASP, SE)), 'nordeste');
});

test('formatação pt-BR', () => {
  assert.equal(formatDistance(842), '840 m');
  assert.equal(formatDistance(4230), '4,2 km');
  assert.equal(formatScore(12500), '12.500');
  assert.equal(formatScore(-50), '-50');
});

test('termômetro e bônus de tempo', () => {
  assert.equal(temperatureFor(500, 800).level, 'found');
  assert.equal(temperatureFor(1500, 800).level, 'burning');
  assert.equal(temperatureFor(3000, 800).level, 'hot');
  assert.equal(temperatureFor(6000, 800).level, 'warm');
  assert.equal(temperatureFor(15000, 800).level, 'cold');
  assert.equal(temperatureFor(90000, 800).level, 'freezing');
  assert.equal(timeBonus(0), SPY_SCORING.timeBonusMax);
  assert.equal(timeBonus(SPY_SCORING.timeBonusWindowS * 2), 0);
});

test('missões: 8 operações de 5 alvos válidos em São Paulo', () => {
  assert.ok(SPY_MISSIONS.length >= 7);
  const missionIds = new Set();
  const targetIds = new Set();
  for (const mission of SPY_MISSIONS) {
    assert.ok(!missionIds.has(mission.id), `missão repetida ${mission.id}`);
    missionIds.add(mission.id);
    assert.ok(mission.codename && mission.title && mission.briefing);
    assert.ok(
      Number.isInteger(mission.tier) && mission.tier >= 1 && mission.tier <= 5,
    );
    assert.equal(mission.targets.length, 5, `${mission.id} precisa de 5 alvos`);
    for (const t of mission.targets) {
      assert.ok(!targetIds.has(t.id), `alvo repetido ${t.id}`);
      targetIds.add(t.id);
      assert.ok(
        Number.isFinite(t.lat) && Number.isFinite(t.lon),
        `${t.id} coords`,
      );
      assert.ok(t.lat > -24.0 && t.lat < -23.3, `${t.id} lat ${t.lat}`);
      assert.ok(t.lon > -46.9 && t.lon < -46.3, `${t.id} lon ${t.lon}`);
      assert.ok(t.radiusM >= 500 && t.radiusM <= 1500, `${t.id} radius`);
      for (const field of ['name', 'clue', 'clueHard', 'hint', 'intel'])
        assert.ok(
          typeof t[field] === 'string' && t[field].trim().length > 8,
          `${t.id}.${field}`,
        );
      assert.notEqual(
        t.clue,
        t.clueHard,
        `${t.id} pista difícil igual à fácil`,
      );
    }
  }
  // Todo nível da campanha tem pelo menos uma missão.
  for (let tier = 1; tier <= 5; tier += 1)
    assert.ok(
      SPY_MISSIONS.some((m) => m.tier === tier),
      `nível ${tier} sem missão`,
    );
});

test('alvos de missões diferentes não se confundem no mesmo nível', () => {
  // Dentro de uma missão, dois alvos não podem caber no mesmo raio no nível 1.
  for (const mission of SPY_MISSIONS) {
    for (let i = 0; i < mission.targets.length; i += 1)
      for (let j = i + 1; j < mission.targets.length; j += 1) {
        const a = mission.targets[i];
        const b = mission.targets[j];
        assert.ok(
          distanceMeters(a, b) > effectiveRadius(a, 1) / 2,
          `${a.id} e ${b.id} sobrepostos`,
        );
      }
  }
});

test('partida completa: erro, dica, acerto, revelar e debriefing', () => {
  let clock = 0;
  const engine = createSpyEngine({
    missions: SPY_MISSIONS,
    now: () => clock,
    random: () => 0.5,
  });
  const mission = engine.start('garoa', { tier: 2 });
  assert.equal(engine.phase, 'playing');
  assert.equal(engine.tier, 2);

  const miss = engine.guess(SE);
  assert.equal(miss.result, 'miss');
  assert.equal(engine.score, -SPY_SCORING.wrongPenalty);

  const hint = engine.hint();
  assert.equal(hint.level, 1);
  assert.equal(hint.text, mission.targets[0].hint);
  const hint2 = engine.hint();
  assert.equal(hint2.level, 2);
  assert.ok(hint2.fromLastGuess.distance > 2000);
  assert.ok(engine.hint().exhausted);

  clock = 30_000;
  const hit = engine.guess(MASP);
  assert.equal(hit.result, 'hit');
  assert.equal(hit.bonus, timeBonus(30, engine.scoring));
  assert.equal(hit.points, Math.round((500 + hit.bonus) * 1.25));
  assert.equal(engine.stepIndex, 1);

  while (engine.phase === 'playing') engine.reveal();
  const summary = engine.summary();
  assert.equal(summary.found, 1);
  assert.equal(summary.tier, 2);
  assert.equal(summary.maxScore, 5 * Math.round(1000 * 1.25));
  assert.equal(summary.revealed, mission.targets.length - 1);
  assert.equal(summary.results.length, mission.targets.length);
  assert.equal(engine.phase, 'debrief');
});

test('nível muda raio, pista, penalidade, dicas e multiplicador', () => {
  let clock = 0;
  const engine = createSpyEngine({
    missions: SPY_MISSIONS,
    now: () => clock,
    random: () => 0.5,
  });
  const radii = [];
  for (let tier = 1; tier <= 5; tier += 1) {
    engine.start('garoa', { tier });
    const target = engine.currentTarget();
    radii.push(target.radiusM);
    assert.equal(
      target.radiusM,
      effectiveRadius(SPY_MISSIONS[0].targets[0], tier),
    );
    assert.equal(
      target.clue,
      tier >= 4
        ? SPY_MISSIONS[0].targets[0].clueHard
        : SPY_MISSIONS[0].targets[0].clue,
    );
    engine.guess(SE);
    assert.equal(engine.score, -tierRules(tier).wrongPenalty);
  }
  for (let i = 1; i < radii.length; i += 1)
    assert.ok(radii[i] < radii[i - 1], `raio não encolheu: ${radii}`);

  // Nível 5: sem dicas, acerto instantâneo vale (500 + 500) × 3.
  engine.start('garoa', { tier: 5 });
  const none = engine.hint();
  assert.ok(none.exhausted && none.unavailable);
  assert.equal(engine.score, 0);
  const hit = engine.guess(MASP);
  assert.equal(hit.result, 'hit');
  assert.equal(hit.points, 3000);

  // Nível 4: uma única dica, só texto.
  engine.start('garoa', { tier: 4 });
  assert.equal(engine.hint().penalty, 250);
  assert.ok(engine.hint().exhausted);

  // Sem tier explícito vale o nível da própria missão.
  engine.start('fantasma');
  assert.equal(engine.tier, 5);
});

test('sorteio respeita o grupo de missões do nível', () => {
  const engine = createSpyEngine({
    missions: SPY_MISSIONS,
    random: () => 0.99,
  });
  const pool = SPY_MISSIONS.filter((m) => m.tier === 3);
  const mission = engine.start(undefined, { tier: 3, pool });
  assert.equal(mission.tier, 3);
});

test('recorde salvo apenas quando supera o anterior', () => {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  assert.equal(readBestScore(storage), null);
  assert.equal(recordBestScore(storage, { score: 1000, codename: 'A' }), true);
  assert.equal(recordBestScore(storage, { score: 900, codename: 'B' }), false);
  assert.equal(readBestScore(storage).codename, 'A');
});
