/**
 * Núcleo puro do Ranking Global do Modo Espião (sem DOM, sem Node, sem
 * armazenamento). A função serverless api/spy-leaderboard.js injeta o HMAC e o
 * armazenamento; os testes usam as mesmas funções em Node.
 *
 * Modelo: um único documento JSON
 *   { version, updatedAt, entries: Entry[], runs: {id, at}[] }
 * Entry = { id, codename, missionId, tier, score, durationMs, targetsHit, at, qa? }
 */
import { SPY_MISSIONS } from './missions.js';
import { MAX_TIER, MIN_TIER, validateRunClaim } from './difficulty.js';

export const LEADERBOARD_VERSION = 1;
/** Quantas entradas guardar por missão × nível. */
export const BUCKET_LIMIT = 50;
/** Tamanho padrão/máximo de uma consulta. */
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
/** Validade de um runId (token de partida). */
export const RUN_TOKEN_TTL_MS = 6 * 3600 * 1000;
/** Folga entre o relógio do servidor e a duração declarada. */
export const CLOCK_SLACK_MS = 15_000;
/** Entradas de QA ("TESTE-QA…") ficam ocultas e somem depois disto. */
export const QA_TTL_MS = 3600 * 1000;
export const QA_PREFIX = 'TESTE-QA';
export const CODENAME_MAX = 20;

const MISSIONS_BY_ID = new Map(SPY_MISSIONS.map((m) => [m.id, m]));

/** Missão conhecida pelo id, ou null. */
export function missionById(id) {
  return MISSIONS_BY_ID.get(String(id ?? '')) ?? null;
}

/** Palavrões comuns (pt-BR/en), comparados sem acento. Lista curta de propósito. */
const BLOCKLIST = [
  'porra',
  'caralho',
  'buceta',
  'puta',
  'viado',
  'merda',
  'cuzao',
  'fdp',
  'arrombado',
  'piroca',
  'fuck',
  'shit',
  'nazi',
  'hitler',
];

/**
 * Codinome seguro: sem HTML, só letras/números/espaço/-/_/., maiúsculo,
 * no máximo 20 caracteres. Retorna null quando sobra nada.
 */
export function sanitizeCodename(value) {
  const text = String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFC')
    .toUpperCase()
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CODENAME_MAX)
    .trim();
  if (!text) return null;
  const folded = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (BLOCKLIST.some((word) => folded.includes(word))) return 'AGENTE ANÔNIMO';
  return text;
}

export function isQaCodename(codename) {
  return String(codename ?? '').startsWith(QA_PREFIX);
}

export function createEmptyBoard(now = Date.now()) {
  return {
    version: LEADERBOARD_VERSION,
    updatedAt: new Date(now).toISOString(),
    entries: [],
    runs: [],
  };
}

/** Aceita qualquer coisa vinda do armazenamento e devolve um quadro válido. */
export function normalizeBoard(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries))
    return createEmptyBoard(now);
  return {
    version: LEADERBOARD_VERSION,
    updatedAt:
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : new Date(now).toISOString(),
    entries: raw.entries.filter(
      (e) =>
        e &&
        typeof e === 'object' &&
        Number.isFinite(e.score) &&
        typeof e.codename === 'string',
    ),
    runs: Array.isArray(raw.runs)
      ? raw.runs.filter((r) => r && typeof r.id === 'string')
      : [],
  };
}

/** Ordem do ranking: pontos ↓, tempo ↑, data ↑. */
export function compareEntries(a, b) {
  return (
    b.score - a.score ||
    a.durationMs - b.durationMs ||
    String(a.at).localeCompare(String(b.at))
  );
}

const bucketKey = (e) => `${e.missionId}:${e.tier}`;

/** Remove QA expirado, runs vencidos e corta cada balde em BUCKET_LIMIT. */
export function pruneBoard(board, now = Date.now()) {
  const fresh = board.entries.filter(
    (e) => !e.qa || now - Date.parse(e.at) < QA_TTL_MS,
  );
  const buckets = new Map();
  for (const e of fresh.sort(compareEntries)) {
    const key = bucketKey(e);
    const list = buckets.get(key) ?? [];
    if (list.length < BUCKET_LIMIT) list.push(e);
    buckets.set(key, list);
  }
  board.entries = [...buckets.values()].flat().sort(compareEntries);
  board.runs = board.runs
    .filter((r) => now - r.at < RUN_TOKEN_TTL_MS + 3600 * 1000)
    .slice(-5000);
  return board;
}

/**
 * Consulta o quadro. mission: id ou 'all'; tier: 1–5 ou 'all'.
 * Entradas de QA só aparecem com includeQa.
 */
export function queryBoard(
  board,
  {
    mission = 'all',
    tier = 'all',
    limit = DEFAULT_LIMIT,
    includeQa = false,
  } = {},
) {
  const n = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(Number(limit)) || DEFAULT_LIMIT),
  );
  const tierNum =
    tier === 'all' || tier == null || tier === '' ? null : Number(tier);
  const list = board.entries
    .filter((e) => includeQa || !e.qa)
    .filter((e) => mission === 'all' || !mission || e.missionId === mission)
    .filter((e) => tierNum == null || e.tier === tierNum)
    .sort(compareEntries);
  return {
    total: list.length,
    entries: list.slice(0, n).map((e, i) => publicEntry(e, i + 1)),
  };
}

/** Campos públicos de uma entrada (sem id interno). */
export function publicEntry(e, position) {
  const mission = missionById(e.missionId);
  return {
    position,
    codename: e.codename,
    missionId: e.missionId,
    missionCodename: mission?.codename ?? e.missionId,
    tier: e.tier,
    score: e.score,
    durationMs: e.durationMs,
    targetsHit: e.targetsHit,
    at: e.at,
    ...(e.qa ? { qa: true } : {}),
  };
}

// ── Tokens de partida (runId) ────────────────────────────────────────

const toB64Url = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (text) => {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Emite um runId assinado: base64url(payload).assinatura.
 * @param {{missionId:string, tier:number, now:number, nonce:string, sign:(text:string)=>string}} options
 */
export function issueRunToken({ missionId, tier, now, nonce, sign }) {
  const payload = toB64Url(
    JSON.stringify({ r: nonce, m: missionId, t: tier, iat: now }),
  );
  return `${payload}.${sign(payload)}`;
}

/** Verifica um runId; retorna o payload {r, m, t, iat} ou null. */
export function verifyRunToken(token, { sign, now }) {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  if (!safeEqual(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(fromB64Url(payload));
    if (typeof data?.r !== 'string' || !Number.isFinite(data?.iat)) return null;
    if (now - data.iat > RUN_TOKEN_TTL_MS || data.iat - now > CLOCK_SLACK_MS)
      return null;
    return data;
  } catch {
    return null;
  }
}

/** Valida o corpo de "iniciar partida". */
export function parseStartRequest(body) {
  const mission = missionById(body?.missionId);
  if (!mission)
    return { ok: false, code: 'mission', message: 'Missão desconhecida.' };
  const tier = Number(body?.tier);
  if (!Number.isInteger(tier) || tier < MIN_TIER || tier > MAX_TIER)
    return { ok: false, code: 'tier', message: 'Nível inválido.' };
  return { ok: true, mission, tier };
}

/**
 * Valida e insere uma pontuação. Não toca no armazenamento: recebe o quadro
 * e devolve o resultado; quem chama persiste `board` quando `ok`.
 * @returns {{ok:false,status:number,code:string,message:string} | {ok:true, rank:number, total:number, personalBest:boolean, entry:object}}
 */
export function submitScore(board, body, { sign, now = Date.now(), nonce }) {
  const fail = (status, code, message) => ({
    ok: false,
    status,
    code,
    message,
  });
  const codename = sanitizeCodename(body?.codename);
  if (!codename) return fail(400, 'codename', 'Codinome inválido.');
  const mission = missionById(body?.missionId);
  if (!mission) return fail(400, 'mission', 'Missão desconhecida.');
  const tier = Number(body?.tier);
  const score = Number(body?.score);
  const durationMs = Math.round(Number(body?.durationMs));
  const targetsHit = Number(body?.targetsHit);

  const run = verifyRunToken(body?.runId, { sign, now });
  if (!run) return fail(403, 'run', 'Partida não registrada ou expirada.');
  if (run.m !== mission.id || run.t !== tier)
    return fail(403, 'run', 'Partida não confere com a missão/nível.');
  if (board.runs.some((r) => r.id === run.r))
    return fail(409, 'duplicate', 'Esta partida já foi enviada.');
  const serverElapsed = now - run.iat;
  if (durationMs > serverElapsed + CLOCK_SLACK_MS)
    return fail(422, 'clock', 'Duração maior que o tempo real da partida.');

  const claim = validateRunClaim({
    targetCount: mission.targets.length,
    level: tier,
    score,
    durationMs,
    targetsHit,
  });
  if (!claim.ok) return fail(422, claim.code, claim.message);

  const qa = isQaCodename(codename);
  const entry = {
    id: nonce ?? run.r,
    codename,
    missionId: mission.id,
    tier,
    score,
    durationMs,
    targetsHit,
    at: new Date(now).toISOString(),
    ...(qa ? { qa: true } : {}),
  };
  board.runs.push({ id: run.r, at: now });

  // Um lugar por codinome em cada missão × nível: fica a melhor marca.
  const sameBucket = (e) =>
    e.missionId === entry.missionId && e.tier === entry.tier;
  const previous = board.entries.find(
    (e) => sameBucket(e) && e.codename === codename,
  );
  const personalBest = !previous || compareEntries(entry, previous) < 0;
  if (personalBest) {
    board.entries = board.entries.filter((e) => e !== previous);
    board.entries.push(entry);
  }
  board.updatedAt = entry.at;
  pruneBoard(board, now);

  const bucket = board.entries
    .filter((e) => sameBucket(e) && (qa || !e.qa))
    .sort(compareEntries);
  const better = bucket.filter(
    (e) => e.codename !== codename && compareEntries(e, entry) < 0,
  ).length;
  const rank = better + 1;
  const total =
    bucket.length + (bucket.some((e) => e.codename === codename) ? 0 : 1);
  return {
    ok: true,
    rank,
    total,
    personalBest,
    entry: publicEntry(entry, rank),
  };
}
