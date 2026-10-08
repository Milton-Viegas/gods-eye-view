/**
 * Cliente do Ranking Global (/api/spy-leaderboard). Toda falha (offline, 404
 * no servidor de desenvolvimento, função fora do ar) vira `{ok:false}` — o
 * jogo segue funcionando só com o recorde local.
 */

export const LEADERBOARD_ENDPOINT = '/api/spy-leaderboard';
const TIMEOUT_MS = 8000;

async function request(fetchImpl, url, options = {}) {
  if (typeof fetchImpl !== 'function')
    return { ok: false, offline: true, error: 'Sem conexão.' };
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), TIMEOUT_MS)
    : null;
  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller?.signal,
      headers: { accept: 'application/json', ...(options.headers ?? {}) },
    });
    const type = response.headers?.get?.('content-type') ?? '';
    if (!type.includes('application/json')) {
      return {
        ok: false,
        offline: true,
        status: response.status,
        error: 'Ranking Global indisponível neste servidor.',
      };
    }
    const body = await response.json();
    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        status: response.status,
        code: body?.code,
        error: body?.error || `Erro ${response.status}`,
        offline: response.status === 404 || response.status >= 500,
      };
    }
    return body;
  } catch (error) {
    return {
      ok: false,
      offline: true,
      error:
        error?.name === 'AbortError'
          ? 'Tempo esgotado.'
          : 'Sem conexão com a central.',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {{fetchImpl?: typeof fetch, endpoint?: string, enabled?: boolean}} options
 * `enabled: false` (modo de teste ?spytest=1) desliga o registro e o envio de
 * pontuações; a leitura do ranking continua.
 */
export function createLeaderboardClient({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  endpoint = LEADERBOARD_ENDPOINT,
  enabled = true,
} = {}) {
  return {
    enabled,
    /** Top N: mission 'all' ou id; tier 'all' ou 1–5. */
    fetchTop({ mission = 'all', tier = 'all', limit = 20 } = {}) {
      const params = new URLSearchParams({
        mission: String(mission),
        tier: String(tier),
        limit: String(limit),
      });
      return request(fetchImpl, `${endpoint}?${params}`, { method: 'GET' });
    },
    /** Registra o início de uma partida e recebe um runId assinado. */
    async startRun({ missionId, tier }) {
      if (!enabled)
        return {
          ok: false,
          disabled: true,
          error: 'Modo de teste: ranking desligado.',
        };
      return request(fetchImpl, endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', missionId, tier }),
      });
    },
    /** Envia a pontuação final. */
    async submit({
      codename,
      missionId,
      tier,
      score,
      durationMs,
      targetsHit,
      runId,
    }) {
      if (!enabled)
        return {
          ok: false,
          disabled: true,
          error: 'Modo de teste: envio desligado.',
        };
      if (!runId)
        return {
          ok: false,
          offline: true,
          error: 'Partida não registrada na central.',
        };
      return request(fetchImpl, endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          codename,
          missionId,
          tier,
          score,
          durationMs: Math.round(durationMs),
          targetsHit,
          runId,
        }),
      });
    },
  };
}
