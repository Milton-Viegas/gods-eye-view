/**
 * Níveis de dificuldade e campanha do Modo Espião.
 *
 * Dados e regras puras (sem DOM/Cesium/Node): usados pelo motor do jogo no
 * navegador e também pela função serverless do Ranking Global para validar a
 * pontuação enviada (api/spy-leaderboard.js).
 */

/** Constantes de pontuação comuns a todos os níveis. */
export const SPY_BASE_SCORING = Object.freeze({
  /** Pontos por alvo encontrado (antes do multiplicador). */
  base: 500,
  /** Bônus máximo de tempo por alvo (antes do multiplicador). */
  timeBonusMax: 500,
});

/**
 * Os cinco níveis. O raio efetivo de um alvo é
 * `clamp(alvo.radiusM × radiusScale, minRadiusM, maxRadiusM)`, arredondado
 * para dezenas de metros — lugares grandes (estádios, parques) continuam um
 * pouco mais generosos que um prédio.
 */
export const SPY_TIERS = Object.freeze(
  [
    {
      level: 1,
      name: 'Recruta',
      radiusScale: 1.5,
      minRadiusM: 900,
      maxRadiusM: 2000,
      timeBonusWindowS: 180,
      wrongPenalty: 25,
      hintPenalties: [50, 100],
      multiplier: 1,
      hardClues: false,
    },
    {
      level: 2,
      name: 'Agente de Campo',
      radiusScale: 1,
      minRadiusM: 600,
      maxRadiusM: 1400,
      timeBonusWindowS: 150,
      wrongPenalty: 50,
      hintPenalties: [100, 200],
      multiplier: 1.25,
      hardClues: false,
    },
    {
      level: 3,
      name: 'Agente Sênior',
      radiusScale: 0.75,
      minRadiusM: 450,
      maxRadiusM: 1000,
      timeBonusWindowS: 120,
      wrongPenalty: 75,
      hintPenalties: [150, 300],
      multiplier: 1.5,
      hardClues: false,
    },
    {
      level: 4,
      name: 'Agente Especial',
      radiusScale: 0.5,
      minRadiusM: 300,
      maxRadiusM: 700,
      timeBonusWindowS: 90,
      wrongPenalty: 100,
      hintPenalties: [250],
      multiplier: 2,
      hardClues: true,
    },
    {
      level: 5,
      name: 'Agente Fantasma',
      radiusScale: 0.35,
      minRadiusM: 200,
      maxRadiusM: 500,
      timeBonusWindowS: 60,
      wrongPenalty: 150,
      hintPenalties: [],
      multiplier: 3,
      hardClues: true,
    },
  ].map((tier) =>
    Object.freeze({
      ...tier,
      hintPenalties: Object.freeze([...tier.hintPenalties]),
    }),
  ),
);

export const MIN_TIER = 1;
export const MAX_TIER = SPY_TIERS.length;

/** Fração da pontuação máxima necessária para liberar o próximo nível. */
export const UNLOCK_RATIO = 0.4;

/** Pausa entre um alvo e a próxima pista (ms) — o relógio continua correndo. */
export const STEP_TRANSITION_MS = 2800;
/** Tempo mínimo plausível para um humano achar um alvo (anti-trapaça). */
export const MIN_HUMAN_SECONDS_PER_HIT = 3;

/** Normaliza qualquer entrada para um nível inteiro válido (padrão 1). */
export function clampTier(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MIN_TIER;
  return Math.min(MAX_TIER, Math.max(MIN_TIER, n));
}

/** Regras do nível (objeto congelado de SPY_TIERS). */
export function tierRules(level) {
  return SPY_TIERS[clampTier(level) - 1];
}

/** "N3 · Agente Sênior · ×1,5" */
export function tierLabel(level, { short = false } = {}) {
  const tier = tierRules(level);
  const mult = `×${String(tier.multiplier).replace('.', ',')}`;
  return short
    ? `N${tier.level} ${mult}`
    : `Nível ${tier.level} · ${tier.name} · ${mult}`;
}

/** Raio de acerto efetivo (m) de um alvo num nível. */
export function effectiveRadius(target, level) {
  const tier = tierRules(level);
  const scaled = (Number(target?.radiusM) || 800) * tier.radiusScale;
  const clamped = Math.min(tier.maxRadiusM, Math.max(tier.minRadiusM, scaled));
  return Math.round(clamped / 10) * 10;
}

/** Pista mostrada no nível (vaga nos níveis 4 e 5, quando existir). */
export function clueFor(target, level) {
  return tierRules(level).hardClues && target?.clueHard
    ? target.clueHard
    : target?.clue;
}

/** Pontos de um acerto (base + bônus) já com o multiplicador do nível. */
export function hitPoints(bonus, level) {
  const tier = tierRules(level);
  return Math.round(
    (SPY_BASE_SCORING.base + Math.max(0, bonus)) * tier.multiplier,
  );
}

/** Pontuação máxima teórica de uma missão com `targetCount` alvos no nível. */
export function maxMissionScore(targetCount, level) {
  return (
    Math.max(0, targetCount) * hitPoints(SPY_BASE_SCORING.timeBonusMax, level)
  );
}

/** Pontuação mínima (fração da máxima) para liberar o próximo nível. */
export function unlockThreshold(targetCount, level) {
  return Math.ceil(maxMissionScore(targetCount, level) * UNLOCK_RATIO);
}

/** Duração mínima plausível (ms) de uma partida humana. */
export function minPlausibleDurationMs(targetCount, targetsHit) {
  const steps = Math.max(0, targetCount - 1);
  return (
    steps * (STEP_TRANSITION_MS - 300) +
    Math.max(0, targetsHit) * MIN_HUMAN_SECONDS_PER_HIT * 1000
  );
}

/**
 * Teto de pontuação para uma partida com `targetsHit` acertos em `durationMs`.
 * O bônus de tempo cai linearmente com o tempo gasto em cada alvo. Se algum
 * alvo foi revelado, todo o tempo pode ter sido gasto nele — então só vale o
 * teto cheio. Com todos os alvos acertados, o melhor caso é gastar quase todo
 * o tempo num único alvo: (acertos−1) bônus cheios + o bônus do tempo
 * restante. Penalidades só reduzem a pontuação, então não entram no teto.
 */
export function maxPlausibleScore({
  targetCount,
  level,
  targetsHit,
  durationMs,
}) {
  const tier = tierRules(level);
  const hits = Math.max(0, Math.min(targetCount, Math.floor(targetsHit)));
  if (hits === 0) return 0;
  let lastBonus = SPY_BASE_SCORING.timeBonusMax;
  if (hits === targetCount) {
    const forcedS = (Math.max(0, targetCount - 1) * STEP_TRANSITION_MS) / 1000;
    const slackS = Math.max(0, durationMs / 1000 - forcedS);
    lastBonus = Math.max(
      0,
      SPY_BASE_SCORING.timeBonusMax * (1 - slackS / tier.timeBonusWindowS),
    );
  }
  const bonus = SPY_BASE_SCORING.timeBonusMax * (hits - 1) + lastBonus;
  return Math.ceil((hits * SPY_BASE_SCORING.base + bonus) * tier.multiplier);
}

/**
 * Valida uma pontuação declarada (cliente → servidor).
 * @returns {{ok: true} | {ok: false, code: string, message: string}}
 */
export function validateRunClaim({
  targetCount,
  level,
  score,
  durationMs,
  targetsHit,
}) {
  const fail = (code, message) => ({ ok: false, code, message });
  if (!Number.isInteger(targetCount) || targetCount < 1)
    return fail('mission', 'Missão inválida.');
  if (!Number.isInteger(level) || level < MIN_TIER || level > MAX_TIER)
    return fail('tier', 'Nível inválido.');
  if (!Number.isInteger(score)) return fail('score', 'Pontuação inválida.');
  if (score <= 0)
    return fail('score', 'Só pontuações positivas entram no ranking.');
  if (
    !Number.isInteger(targetsHit) ||
    targetsHit < 1 ||
    targetsHit > targetCount
  )
    return fail('targets', 'Número de alvos inválido.');
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    durationMs > 6 * 3600 * 1000
  )
    return fail('duration', 'Duração inválida.');
  if (durationMs < minPlausibleDurationMs(targetCount, targetsHit))
    return fail('too-fast', 'Rápido demais para um humano. Partida recusada.');
  if (score > maxPlausibleScore({ targetCount, level, targetsHit, durationMs }))
    return fail(
      'too-high',
      'Pontuação acima do máximo possível para esse tempo.',
    );
  return { ok: true };
}

// ── Progresso da campanha (localStorage) ─────────────────────────────

const PROGRESS_KEY = 'gev:spy-game:progress:v1';

function emptyProgress() {
  return { unlockedTier: MIN_TIER, best: {} };
}

/** Lê o progresso salvo: {unlockedTier, best: {"missão:nível": pontos}}. */
export function readProgress(storage) {
  try {
    const raw = storage?.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    return {
      unlockedTier: clampTier(parsed?.unlockedTier),
      best:
        parsed?.best && typeof parsed.best === 'object'
          ? { ...parsed.best }
          : {},
    };
  } catch {
    return emptyProgress();
  }
}

/**
 * Registra o fim de uma missão. Na campanha, atingir o limiar libera o nível
 * seguinte. Retorna {progress, unlocked: número do nível recém-liberado | null}.
 */
export function recordMissionResult(
  storage,
  { missionId, level, score, targetCount, campaign = true },
) {
  const progress = readProgress(storage);
  const tier = clampTier(level);
  const key = `${missionId}:${tier}`;
  if (!Number.isFinite(progress.best[key]) || score > progress.best[key])
    progress.best[key] = score;
  let unlocked = null;
  if (
    campaign &&
    tier === progress.unlockedTier &&
    tier < MAX_TIER &&
    score >= unlockThreshold(targetCount, tier)
  ) {
    progress.unlockedTier = tier + 1;
    unlocked = tier + 1;
  }
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Sem armazenamento: o progresso vale só nesta sessão.
  }
  return { progress, unlocked };
}
