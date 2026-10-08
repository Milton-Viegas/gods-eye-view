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

test('missões têm 3–5 alvos válidos em São Paulo', () => {
  assert.ok(SPY_MISSIONS.length >= 2);
  for (const mission of SPY_MISSIONS) {
    assert.ok(mission.targets.length >= 3 && mission.targets.length <= 5);
    for (const t of mission.targets) {
      assert.ok(t.lat < -23.4 && t.lat > -23.75, `${t.id} lat`);
      assert.ok(t.lon < -46.4 && t.lon > -46.85, `${t.id} lon`);
      assert.ok(t.radiusM >= 500 && t.radiusM <= 1500, `${t.id} radius`);
      assert.ok(t.clue && t.hint && t.intel && t.name);
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
  const mission = engine.start('garoa');
  assert.equal(engine.phase, 'playing');

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
  assert.equal(hit.bonus, timeBonus(30));
  assert.equal(engine.stepIndex, 1);

  while (engine.phase === 'playing') engine.reveal();
  const summary = engine.summary();
  assert.equal(summary.found, 1);
  assert.equal(summary.revealed, mission.targets.length - 1);
  assert.equal(summary.results.length, mission.targets.length);
  assert.equal(engine.phase, 'debrief');
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
