/**
 * Regras puras do Modo Espião: distância, feedback quente/frio, pontuação e a
 * máquina de estados da missão. Sem Cesium e sem DOM — testável em Node.
 */

import {
  SPY_BASE_SCORING,
  clampTier,
  clueFor,
  effectiveRadius,
  maxMissionScore,
  tierRules,
} from './difficulty.js';

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * Pontuação do nível 2 (Agente de Campo), mantida por compatibilidade. As
 * regras de cada nível ficam em difficulty.js (SPY_TIERS).
 */
export const SPY_SCORING = Object.freeze({
  base: SPY_BASE_SCORING.base,
  timeBonusMax: SPY_BASE_SCORING.timeBonusMax,
  timeBonusWindowS: tierRules(2).timeBonusWindowS,
  wrongPenalty: tierRules(2).wrongPenalty,
  hintPenalties: tierRules(2).hintPenalties,
});

/** Pontuação efetiva de um nível no formato usado pelo motor. */
export function scoringForTier(level) {
  const tier = tierRules(level);
  return Object.freeze({
    base: SPY_BASE_SCORING.base,
    timeBonusMax: SPY_BASE_SCORING.timeBonusMax,
    timeBonusWindowS: tier.timeBonusWindowS,
    wrongPenalty: tier.wrongPenalty,
    hintPenalties: tier.hintPenalties,
    multiplier: tier.multiplier,
  });
}

/** Distância de grande círculo em metros entre dois pontos {lat, lon}. */
export function distanceMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumo inicial (0–360°, 0 = norte) de `a` para `b`. */
export function bearingDegrees(a, b) {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Ponto de destino a `distanceM` metros de `origin` no rumo `bearingDeg`. */
export function destinationPoint(origin, bearingDeg, distanceM) {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lon);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return { lat: toDeg(φ2), lon: ((toDeg(λ2) + 540) % 360) - 180 };
}

const COMPASS = Object.freeze([
  'norte',
  'nordeste',
  'leste',
  'sudeste',
  'sul',
  'sudoeste',
  'oeste',
  'noroeste',
]);

/** Nome da direção em pt-BR para um rumo em graus. */
export function compassLabel(bearingDeg) {
  const index = Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8;
  return COMPASS[index];
}

/** "850 m" ou "4,2 km" (formato brasileiro). */
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  const digits = km < 100 ? 1 : 0;
  return `${km.toFixed(digits).replace('.', ',')} km`;
}

/** "mm:ss" para uma duração em milissegundos. */
export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Pontos formatados em pt-BR ("1.250"). */
export function formatScore(points) {
  const sign = points < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(points)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Termômetro de proximidade.
 * @returns {{level:'found'|'burning'|'hot'|'warm'|'cold'|'freezing', label:string}}
 */
export function temperatureFor(distanceM, radiusM) {
  if (distanceM <= radiusM) return { level: 'found', label: 'NO ALVO' };
  if (distanceM <= radiusM + 1200)
    return { level: 'burning', label: 'Fervendo' };
  if (distanceM <= 3500) return { level: 'hot', label: 'Quente' };
  if (distanceM <= 7000) return { level: 'warm', label: 'Morno' };
  if (distanceM <= 20000) return { level: 'cold', label: 'Frio' };
  return { level: 'freezing', label: 'Congelando' };
}

/** Bônus de tempo para um alvo encontrado após `seconds`. */
export function timeBonus(seconds, scoring = SPY_SCORING) {
  const left = 1 - Math.max(0, seconds) / scoring.timeBonusWindowS;
  return Math.max(0, Math.round(scoring.timeBonusMax * left));
}

/** Patente final a partir da fração da pontuação máxima possível. */
export function rankFor(score, maxScore) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.8) return 'Lenda do Olho de Deus';
  if (ratio >= 0.6) return 'Agente Sênior';
  if (ratio >= 0.4) return 'Agente de Campo';
  if (ratio >= 0.2) return 'Agente Júnior';
  return 'Recruta em Treinamento';
}

/**
 * Máquina de estados de uma partida.
 * @param {{missions: ReadonlyArray<object>, now?: () => number, random?: () => number}} options
 */
export function createSpyEngine({
  missions,
  now = () => Date.now(),
  random = Math.random,
}) {
  if (!Array.isArray(missions) || missions.length === 0)
    throw new TypeError('O Modo Espião precisa de pelo menos uma missão');

  let state = idleState();
  let tier = tierRules(1);
  let scoring = scoringForTier(1);

  function idleState() {
    return {
      phase: 'idle',
      mission: null,
      tier: 1,
      campaign: true,
      stepIndex: 0,
      score: 0,
      missionStartedAt: 0,
      stepStartedAt: 0,
      endedAt: 0,
      wrongGuesses: 0,
      hintsUsed: 0,
      stepHints: 0,
      revealed: 0,
      found: 0,
      lastGuess: null,
      results: [],
    };
  }

  function elapsedMs() {
    if (state.phase === 'idle') return 0;
    const end = state.phase === 'debrief' ? state.endedAt : now();
    return end - state.missionStartedAt;
  }

  /** Alvo atual já ajustado ao nível: raio efetivo e pista do nível. */
  function currentTarget() {
    const target = state.mission?.targets[state.stepIndex];
    if (!target) return null;
    return {
      ...target,
      baseRadiusM: target.radiusM,
      radiusM: effectiveRadius(target, state.tier),
      clue: clueFor(target, state.tier),
    };
  }

  function finishStep(result) {
    state.results.push(result);
    state.stepIndex += 1;
    state.stepHints = 0;
    state.lastGuess = null;
    state.stepStartedAt = now();
    const missionComplete = state.stepIndex >= state.mission.targets.length;
    if (missionComplete) {
      state.phase = 'debrief';
      state.endedAt = now();
    }
    return missionComplete;
  }

  return {
    /**
     * Inicia uma missão pelo id, ou uma aleatória quando omitido/"random".
     * `tier` (1–5) define raio, bônus, penalidades, dicas e multiplicador; sem
     * ele vale o nível da própria missão. `pool` restringe o sorteio.
     */
    start(missionId, { tier: level, campaign = true, pool } = {}) {
      let mission = missions.find((m) => m.id === missionId);
      if (!mission) {
        const candidates = pool?.length ? pool : missions;
        mission = candidates[Math.floor(random() * candidates.length)];
      }
      state = idleState();
      state.tier = clampTier(level ?? mission.tier ?? 1);
      state.campaign = campaign;
      tier = tierRules(state.tier);
      scoring = scoringForTier(state.tier);
      state.phase = 'playing';
      state.mission = mission;
      state.missionStartedAt = now();
      state.stepStartedAt = state.missionStartedAt;
      return mission;
    },

    /** Avalia um palpite {lat, lon} para o alvo atual. */
    guess(point) {
      const target = currentTarget();
      if (state.phase !== 'playing' || !target) return { result: 'inactive' };
      const distance = distanceMeters(point, target);
      const temperature = temperatureFor(distance, target.radiusM);
      if (temperature.level === 'found') {
        const seconds = (now() - state.stepStartedAt) / 1000;
        const bonus = timeBonus(seconds, scoring);
        const points = Math.round((scoring.base + bonus) * scoring.multiplier);
        state.score += points;
        state.found += 1;
        const missionComplete = finishStep({
          target,
          outcome: 'found',
          seconds,
          points,
        });
        return {
          result: 'hit',
          target,
          distance,
          points,
          bonus,
          seconds,
          missionComplete,
        };
      }
      state.wrongGuesses += 1;
      state.score -= scoring.wrongPenalty;
      state.lastGuess = { lat: point.lat, lon: point.lon };
      return {
        result: 'miss',
        target,
        distance,
        temperature,
        penalty: scoring.wrongPenalty,
        bearing: bearingDegrees(point, target),
      };
    },

    /**
     * Próximo nível de dica do alvo atual.
     * Nível 1: dica em texto. Nível 2: triangulação (direção + aproximação da câmera).
     */
    hint() {
      const target = currentTarget();
      if (state.phase !== 'playing' || !target) return null;
      if (scoring.hintPenalties.length === 0)
        return { level: 0, exhausted: true, unavailable: true, target };
      if (state.stepHints >= scoring.hintPenalties.length)
        return { level: state.stepHints, exhausted: true, target };
      const level = state.stepHints + 1;
      const penalty = scoring.hintPenalties[level - 1];
      state.stepHints = level;
      state.hintsUsed += 1;
      state.score -= penalty;
      const result = { level, penalty, target, exhausted: false };
      if (level === 1) result.text = target.hint;
      else {
        const origin = state.lastGuess;
        // Um ponto próximo, mas não exatamente no alvo, para enquadrar a área.
        result.nearby = destinationPoint(
          target,
          random() * 360,
          target.radiusM * (1.2 + random() * 0.8),
        );
        if (origin) {
          result.fromLastGuess = {
            distance: distanceMeters(origin, target),
            direction: compassLabel(bearingDegrees(origin, target)),
          };
        }
      }
      return result;
    },

    /** Revela o alvo atual sem pontuar e avança. */
    reveal() {
      const target = currentTarget();
      if (state.phase !== 'playing' || !target) return null;
      state.revealed += 1;
      const seconds = (now() - state.stepStartedAt) / 1000;
      const missionComplete = finishStep({
        target,
        outcome: 'revealed',
        seconds,
        points: 0,
      });
      return { target, missionComplete };
    },

    /** Encerra a partida (abortar). */
    abort() {
      state = idleState();
    },

    currentTarget,
    get phase() {
      return state.phase;
    },
    get mission() {
      return state.mission;
    },
    get stepIndex() {
      return state.stepIndex;
    },
    get stepHints() {
      return state.stepHints;
    },
    /** Nível da partida atual (1–5). */
    get tier() {
      return state.tier;
    },
    /** Regras do nível atual (SPY_TIERS). */
    get rules() {
      return tier;
    },
    /** Pontuação efetiva do nível atual. */
    get scoring() {
      return scoring;
    },
    /** Dicas restantes para o alvo atual. */
    hintsLeft() {
      return Math.max(0, scoring.hintPenalties.length - state.stepHints);
    },
    get score() {
      return state.score;
    },
    /** Tempo da missão em ms (congelado no debriefing). */
    elapsedMs,
    /** Segundos gastos no alvo atual. */
    stepElapsedS() {
      if (state.phase !== 'playing') return 0;
      return (now() - state.stepStartedAt) / 1000;
    },
    /** Resumo para a tela de debriefing. */
    summary() {
      const total = state.mission?.targets.length ?? 0;
      const maxScore = maxMissionScore(total, state.tier);
      return {
        mission: state.mission,
        tier: state.tier,
        tierName: tier.name,
        multiplier: tier.multiplier,
        campaign: state.campaign,
        score: state.score,
        maxScore,
        found: state.found,
        revealed: state.revealed,
        total,
        wrongGuesses: state.wrongGuesses,
        hintsUsed: state.hintsUsed,
        elapsedMs: elapsedMs(),
        rank: rankFor(state.score, maxScore),
        results: [...state.results],
      };
    },
  };
}

const BEST_KEY = 'gev:spy-game:best:v1';

/** Lê o recorde salvo ({score, missionId, codename, at}) ou null. */
export function readBestScore(storage) {
  try {
    const raw = storage?.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.score) ? parsed : null;
  } catch {
    return null;
  }
}

/** Salva o recorde se `entry.score` superar o atual. Retorna true se for recorde novo. */
export function recordBestScore(storage, entry) {
  const best = readBestScore(storage);
  if (best && best.score >= entry.score) return false;
  try {
    storage?.setItem(BEST_KEY, JSON.stringify(entry));
  } catch {
    // Armazenamento indisponível (modo privado): o recorde vale só nesta sessão.
  }
  return true;
}
