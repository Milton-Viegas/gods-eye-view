/**
 * Ranking Global do Modo Espião — Vercel Function (Node.js, Web API).
 *
 *   GET  /api/spy-leaderboard?mission=<id|all>&tier=<1-5|all>&limit=20
 *   POST /api/spy-leaderboard {action:"start", missionId, tier}       → {runId}
 *   POST /api/spy-leaderboard {codename, missionId, tier, score,
 *                              durationMs, targetsHit, runId}         → {rank,total}
 *
 * Armazenamento (o primeiro disponível):
 *   1. Vercel Blob — quando o projeto tem um Blob store conectado
 *      (BLOB_STORE_ID + OIDC, ou BLOB_READ_WRITE_TOKEN). Um JSON único com
 *      escrita condicional por ETag.
 *   2. Vercel Runtime Cache (@vercel/functions getCache) — nativo, sem
 *      provisionamento; regional e sujeito a despejo LRU (melhor esforço).
 *   3. Memória do processo — só em desenvolvimento local.
 *
 * Regras de validação e o quadro em si ficam em src/game/spy/leaderboardCore.js
 * (testado em Node); aqui só entram HMAC, armazenamento e HTTP.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { get as blobGet, put as blobPut } from '@vercel/blob';
import { getCache } from '@vercel/functions';
import {
  issueRunToken,
  missionById,
  normalizeBoard,
  parseStartRequest,
  pruneBoard,
  queryBoard,
  submitScore,
} from '../src/game/spy/leaderboardCore.js';

const BOARD_PATH = 'spy-leaderboard/board-v1.json';
const CACHE_KEY = 'gev-spy-leaderboard:board:v1';
const CACHE_TTL_S = 60 * 60 * 24 * 365;
const MAX_BODY_BYTES = 4096;

// ── HMAC ─────────────────────────────────────────────────────────────
let fallbackSecret = null;
function secret() {
  const fromEnv = process.env.SPY_LEADERBOARD_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  // Sem segredo configurado (dev local): chave efêmera por processo.
  fallbackSecret ??= randomBytes(32).toString('base64url');
  return fallbackSecret;
}
const sign = (text) =>
  createHmac('sha256', secret()).update(text).digest('base64url');

// ── Armazenamento ────────────────────────────────────────────────────
function hasBlob() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
  );
}

let blobAccess =
  process.env.SPY_BLOB_ACCESS === 'public' ? 'public' : 'private';

async function withBlobAccess(fn) {
  try {
    return await fn(blobAccess);
  } catch (error) {
    // O store pode ter sido criado como público ou privado: tenta o outro modo uma vez.
    const message = String(error?.message ?? error);
    if (!/access|private|public/i.test(message)) throw error;
    const other = blobAccess === 'private' ? 'public' : 'private';
    const result = await fn(other);
    blobAccess = other;
    return result;
  }
}

const blobStore = {
  name: 'vercel-blob',
  async read() {
    return withBlobAccess(async (access) => {
      let result;
      try {
        result = await blobGet(BOARD_PATH, { access, useCache: false });
      } catch (error) {
        if (/not.?found/i.test(`${error?.name} ${error?.message}`))
          return { board: null, etag: null };
        throw error;
      }
      if (!result || result.statusCode !== 200)
        return { board: null, etag: null };
      const text = await new Response(result.stream).text();
      return { board: JSON.parse(text), etag: result.blob.etag };
    });
  },
  async write(board, etag) {
    return withBlobAccess((access) =>
      blobPut(BOARD_PATH, JSON.stringify(board), {
        access,
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
      }),
    );
  },
};

function runtimeCacheAvailable() {
  const context = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
  return Boolean(
    context?.cache ||
    (process.env.RUNTIME_CACHE_ENDPOINT && process.env.RUNTIME_CACHE_HEADERS),
  );
}

const cacheStore = {
  get name() {
    return runtimeCacheAvailable() ? 'vercel-runtime-cache' : 'memory';
  },
  async read() {
    const board = await getCache({ namespace: 'gev-spy' }).get(CACHE_KEY);
    return { board: board ?? null, etag: null };
  },
  async write(board) {
    await getCache({ namespace: 'gev-spy' }).set(CACHE_KEY, board, {
      ttl: CACHE_TTL_S,
      tags: ['gev-spy-leaderboard'],
      name: 'spy-leaderboard',
    });
  },
};

const store = () => (hasBlob() ? blobStore : cacheStore);

async function loadBoard() {
  const s = store();
  const { board, etag } = await s.read();
  return { board: normalizeBoard(board), etag, storage: s.name };
}

/** Lê-modifica-grava com até 3 tentativas (conflito de ETag no Blob). */
async function updateBoard(mutate) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { board, etag, storage } = await loadBoard();
    const result = mutate(board);
    if (!result.ok) return { result, storage };
    try {
      await store().write(board, etag);
      return { result, storage };
    } catch (error) {
      lastError = error;
      if (
        !/precondition|etag|already exists|412|409/i.test(
          String(error?.message ?? error),
        )
      )
        throw error;
    }
  }
  throw lastError;
}

// ── Limite de taxa (por instância, barato) ───────────────────────────
const hits = new Map();
function rateLimited(ip, bucket, max, windowMs = 60_000) {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

function clientIp(request) {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

// ── HTTP ─────────────────────────────────────────────────────────────
function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  });
}

const fail = (status, code, message, extra = {}) =>
  json(status, { ok: false, code, error: message, ...extra });

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const mission = url.searchParams.get('mission') || 'all';
    const tierParam = url.searchParams.get('tier') || 'all';
    if (mission !== 'all' && !missionById(mission))
      return fail(400, 'mission', 'Missão desconhecida.');
    const tier = tierParam === 'all' ? 'all' : Number(tierParam);
    if (tier !== 'all' && !(Number.isInteger(tier) && tier >= 1 && tier <= 5))
      return fail(400, 'tier', 'Nível inválido.');
    const includeQa = url.searchParams.get('qa') === '1';
    const { board, storage } = await loadBoard();
    pruneBoard(board);
    const result = queryBoard(board, {
      mission,
      tier,
      limit: url.searchParams.get('limit') ?? undefined,
      includeQa,
    });
    return json(200, {
      ok: true,
      storage,
      mission,
      tier,
      updatedAt: board.updatedAt,
      ...result,
    });
  } catch (error) {
    console.error('[spy-leaderboard] GET', error);
    return fail(503, 'storage', 'Ranking indisponível no momento.');
  }
}

export async function POST(request) {
  const ip = clientIp(request);
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES)
      return fail(413, 'size', 'Requisição grande demais.');
    body = JSON.parse(text || '{}');
  } catch {
    return fail(400, 'json', 'JSON inválido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return fail(400, 'json', 'JSON inválido.');

  try {
    if (body.action === 'start') {
      if (rateLimited(ip, 'start', 30))
        return fail(429, 'rate', 'Muitas partidas seguidas. Respire, agente.');
      const parsed = parseStartRequest(body);
      if (!parsed.ok) return fail(400, parsed.code, parsed.message);
      const now = Date.now();
      const runId = issueRunToken({
        missionId: parsed.mission.id,
        tier: parsed.tier,
        now,
        nonce: randomBytes(12).toString('base64url'),
        sign,
      });
      return json(200, {
        ok: true,
        runId,
        issuedAt: new Date(now).toISOString(),
      });
    }

    if (rateLimited(ip, 'submit', 8))
      return fail(
        429,
        'rate',
        'Muitos envios seguidos. Tente de novo em um minuto.',
      );
    const { result, storage } = await updateBoard((board) =>
      submitScore(board, body, {
        sign,
        now: Date.now(),
        nonce: randomBytes(9).toString('base64url'),
      }),
    );
    if (!result.ok) return fail(result.status, result.code, result.message);
    return json(200, {
      ok: true,
      storage,
      rank: result.rank,
      total: result.total,
      personalBest: result.personalBest,
      entry: result.entry,
    });
  } catch (error) {
    console.error('[spy-leaderboard] POST', error);
    return fail(503, 'storage', 'Ranking indisponível no momento.');
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { allow: 'GET, POST, OPTIONS' },
  });
}
