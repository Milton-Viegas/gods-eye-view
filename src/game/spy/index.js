/**
 * Modo Espião — "Operação Olho de Deus".
 *
 * Liga o motor puro (engine.js) e a interface DOM (hud.js) ao globo Cesium:
 * cliques viram palpites (lat/lon), a câmera voa até os alvos e marcadores DOM
 * acompanham posições do mundo a cada quadro renderizado. Não precisa de chave,
 * backend nem token: funciona no globo sem chave (imagens Esri) e também sobre
 * os Google Photorealistic 3D Tiles quando disponíveis.
 */
import * as Cesium from 'cesium';
import { claimPointer, releasePointer } from '../../data/inputOwnership.js';
import { AGENT_CODENAMES, SAO_PAULO_VIEW, SPY_MISSIONS } from './missions.js';
import {
  createSpyEngine,
  formatDistance,
  formatScore,
  readBestScore,
  recordBestScore,
  timeBonus,
} from './engine.js';
import { createSpyHud } from './hud.js';
import './spy.css';

const AUTO_OPEN_KEY = 'gev:spy-game:auto-open:v1';
const CODENAME_KEY = 'gev:spy-game:codename:v1';
const POINTER_OWNER = 'spy-game';
/** Altura aproximada do terreno de SP acima do elipsoide (fallback nos 3D Tiles). */
const SAO_PAULO_SURFACE_M = 760;

function safeStorage(windowRef) {
  try {
    const storage = windowRef.localStorage;
    storage.getItem('gev:probe');
    return storage;
  } catch {
    return null;
  }
}

function sanitizeCodename(value) {
  const clean = String(value ?? '')
    .toUpperCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18);
  return clean || null;
}

function randomCodename(random = Math.random) {
  return AGENT_CODENAMES[Math.floor(random() * AGENT_CODENAMES.length)];
}

/**
 * Monta o Modo Espião sobre um Cesium.Viewer existente.
 * @param {{viewer: Cesium.Viewer, documentRef?: Document, windowRef?: Window, autoOpen?: boolean}} options
 */
export function mountSpyGame({
  viewer,
  documentRef = document,
  windowRef = window,
  autoOpen,
}) {
  if (!viewer?.scene)
    throw new TypeError('O Modo Espião precisa de um Cesium.Viewer');
  const scene = viewer.scene;
  const storage = safeStorage(windowRef);
  const engine = createSpyEngine({ missions: SPY_MISSIONS });

  let codename =
    sanitizeCodename(storage?.getItem(CODENAME_KEY)) || randomCodename();
  let pointerLease = null;
  let tickTimer = null;
  let transitionTimer = null;
  let busy = false;
  let lastSurfaceHeight = null;
  /** @type {{position: Cesium.Cartesian3, el: HTMLElement, expiresAt: number}[]} */
  let markers = [];

  const body = documentRef.body;
  const setBodyState = () => {
    const playing = engine.phase === 'playing';
    body.classList.toggle('spy-game-playing', playing);
    body.classList.toggle(
      'spy-game-open',
      playing || hud.briefingOpen || hud.debriefOpen,
    );
  };

  const hud = createSpyHud({
    documentRef,
    missions: SPY_MISSIONS,
    handlers: {
      onOpen: () => openBriefing(),
      onConsole: () => closeToConsole(),
      onStart: (missionId, name) => startMission(missionId, name),
      onHint: () => useHint(),
      onReveal: () => revealTarget(),
      onAbort: () => abortMission(),
      onReplay: () => {
        clearMarkers();
        hud.hideDebrief();
        hud.hideMission();
        openBriefing();
      },
      onAutoOpenChange: (enabled) => {
        try {
          storage?.setItem(AUTO_OPEN_KEY, enabled ? 'on' : 'off');
        } catch {
          /* sem armazenamento */
        }
      },
      onRerollCodename: () => {
        let next = randomCodename();
        if (next === codename) next = randomCodename();
        codename = next;
        hud.setCodename(codename);
      },
    },
  });

  // ── Geometria: picking e alturas ───────────────────────────────
  function pickLatLon(windowPosition) {
    let cartesian;
    try {
      if (scene.globe?.show) {
        const ray = viewer.camera.getPickRay(windowPosition);
        if (ray) cartesian = scene.globe.pick(ray, scene);
      }
      if (!cartesian && scene.pickPositionSupported) {
        cartesian = scene.pickPosition(windowPosition);
      }
      if (!cartesian) {
        cartesian = viewer.camera.pickEllipsoid(
          windowPosition,
          scene.globe?.ellipsoid ?? Cesium.Ellipsoid.WGS84,
        );
      }
    } catch {
      cartesian = undefined;
    }
    if (!cartesian) return null;
    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    if (!carto || !Number.isFinite(carto.latitude)) return null;
    return {
      lat: Cesium.Math.toDegrees(carto.latitude),
      lon: Cesium.Math.toDegrees(carto.longitude),
      height: Number.isFinite(carto.height) ? carto.height : 0,
      cartesian,
    };
  }

  function surfaceHeight(lat, lon) {
    const carto = Cesium.Cartographic.fromDegrees(lon, lat);
    try {
      if (scene.globe?.show) {
        const h = scene.globe.getHeight(carto);
        return Number.isFinite(h) ? h : 0;
      }
      if (scene.sampleHeightSupported) {
        const h = scene.sampleHeight(carto);
        if (Number.isFinite(h)) return h;
      }
    } catch {
      /* fallback abaixo */
    }
    return lastSurfaceHeight ?? (scene.globe?.show ? 0 : SAO_PAULO_SURFACE_M);
  }

  function worldPosition(lat, lon, height) {
    return Cesium.Cartesian3.fromDegrees(lon, lat, height);
  }

  // ── Marcadores DOM ancorados no mundo ──────────────────────────
  const scratchWindow = new Cesium.Cartesian2();
  function updateMarkers() {
    if (!markers.length) return;
    const now = Date.now();
    const rect = scene.canvas.getBoundingClientRect();
    const occluder = new Cesium.EllipsoidalOccluder(
      Cesium.Ellipsoid.WGS84,
      viewer.camera.positionWC,
    );
    markers = markers.filter((m) => {
      if (m.expiresAt && m.expiresAt < now) {
        m.el.remove();
        return false;
      }
      return true;
    });
    for (const m of markers) {
      const win = Cesium.SceneTransforms.worldToWindowCoordinates(
        scene,
        m.position,
        scratchWindow,
      );
      const visible =
        win && Number.isFinite(win.x) && occluder.isPointVisible(m.position);
      if (!visible) {
        m.el.style.display = 'none';
        continue;
      }
      m.el.style.display = '';
      m.el.style.transform = `translate3d(${(rect.left + win.x).toFixed(1)}px, ${(rect.top + win.y).toFixed(1)}px, 0)`;
    }
  }
  const removePostRender = scene.postRender.addEventListener(updateMarkers);

  function addMarker({ lat, lon, height, kind, label, ttlMs = 0 }) {
    const el = documentRef.createElement('div');
    el.className = `spy-marker spy-marker-${kind}`;
    const ring = documentRef.createElement('span');
    ring.className = 'spy-marker-ring';
    const ring2 = documentRef.createElement('span');
    ring2.className = 'spy-marker-ring spy-marker-ring-2';
    const dot = documentRef.createElement('span');
    dot.className = 'spy-marker-dot';
    const text = documentRef.createElement('span');
    text.className = 'spy-marker-label';
    text.textContent = label;
    el.append(ring, ring2, dot, text);
    hud.markerLayer.append(el);
    const marker = {
      position: worldPosition(lat, lon, height),
      el,
      expiresAt: ttlMs ? Date.now() + ttlMs : 0,
    };
    markers.push(marker);
    if (ttlMs) {
      windowRef.setTimeout(() => {
        scene.requestRender();
        updateMarkers();
      }, ttlMs + 30);
    }
    scene.requestRender();
    updateMarkers();
    return marker;
  }

  function clearMarkers() {
    for (const m of markers) m.el.remove();
    markers = [];
  }

  // ── Câmera ─────────────────────────────────────────────────────
  function flyToSaoPaulo(duration = 3) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        SAO_PAULO_VIEW.lon,
        SAO_PAULO_VIEW.lat,
        SAO_PAULO_VIEW.heightM,
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }

  function flyToPoint(position, range = 2200, duration = 2.2) {
    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(position, 200),
      {
        offset: new Cesium.HeadingPitchRange(
          viewer.camera.heading,
          Cesium.Math.toRadians(-55),
          range,
        ),
        duration,
      },
    );
  }

  // ── Fluxo do jogo ──────────────────────────────────────────────
  function openBriefing() {
    if (engine.phase === 'playing') return;
    hud.hideDebrief();
    hud.showBriefing({
      codename,
      best: readBestScore(storage),
      autoOpen: storage?.getItem(AUTO_OPEN_KEY) !== 'off',
    });
    setBodyState();
  }

  function closeToConsole() {
    hud.hideBriefing();
    hud.hideDebrief();
    if (engine.phase !== 'playing') {
      clearMarkers();
      hud.hideMission();
    }
    setBodyState();
  }

  function startTick() {
    stopTick();
    const tick = () =>
      hud.setStatus({
        elapsedMs: engine.elapsedMs(),
        score: engine.score,
        bonus: timeBonus(engine.stepElapsedS()),
      });
    tick();
    tickTimer = windowRef.setInterval(tick, 250);
  }

  function stopTick() {
    if (tickTimer) windowRef.clearInterval(tickTimer);
    tickTimer = null;
  }

  function presentCurrentClue() {
    const target = engine.currentTarget();
    if (!target) return;
    hud.setClue({
      target,
      index: engine.stepIndex,
      total: engine.mission.targets.length,
    });
    hud.log(`Nova pista recebida (alvo ${engine.stepIndex + 1}).`, 'info');
  }

  function startMission(missionId, name) {
    codename = sanitizeCodename(name) || codename;
    try {
      storage?.setItem(CODENAME_KEY, codename);
    } catch {
      /* sem armazenamento */
    }
    clearMarkers();
    const mission = engine.start(
      missionId === 'random' ? undefined : missionId,
    );
    hud.hideBriefing();
    hud.hideDebrief();
    hud.showMission({ mission, codename });
    pointerLease = claimPointer(POINTER_OWNER);
    busy = false;
    flyToSaoPaulo();
    hud.log(
      `Canal seguro aberto. ${mission.codename}: ${mission.title}.`,
      'system',
    );
    presentCurrentClue();
    hud.toast(
      `${mission.codename} — boa sorte, Agente ${codename}.`,
      'system',
      3200,
    );
    startTick();
    setBodyState();
  }

  function advanceAfter(delayMs, missionComplete) {
    busy = true;
    windowRef.clearTimeout(transitionTimer);
    transitionTimer = windowRef.setTimeout(() => {
      busy = false;
      if (missionComplete) finishMission();
      else presentCurrentClue();
    }, delayMs);
  }

  function handleGuess(point) {
    if (engine.phase !== 'playing' || busy) return;
    lastSurfaceHeight = point.height;
    const result = engine.guess(point);
    if (result.result === 'hit') {
      const { target } = result;
      const height = Number.isFinite(point.height)
        ? point.height
        : surfaceHeight(target.lat, target.lon);
      addMarker({
        lat: target.lat,
        lon: target.lon,
        height,
        kind: 'found',
        label: `✔ ${target.name}`,
      });
      hud.setThermo({ level: 'found', label: 'NO ALVO' }, result.distance);
      hud.toast(
        `ALVO LOCALIZADO! +${result.points} pts (bônus ${result.bonus})`,
        'success',
        2800,
      );
      hud.log(`✔ ${target.name} — +${result.points} pts.`, 'success');
      hud.log(`INTEL: ${target.intel}`, 'intel');
      flyToPoint(worldPosition(target.lat, target.lon, height));
      advanceAfter(2800, result.missionComplete);
    } else if (result.result === 'miss') {
      const label = `${result.temperature.label} · ${formatDistance(result.distance)}`;
      addMarker({
        ...point,
        kind: `miss spy-level-${result.temperature.level}`,
        label,
        ttlMs: 6000,
      });
      hud.setThermo(result.temperature, result.distance);
      hud.toast(
        `${result.temperature.label.toUpperCase()} — ${formatDistance(result.distance)}  (−${result.penalty})`,
        result.temperature.level,
        2400,
      );
      hud.log(`✖ Palpite errado: ${label}.`, result.temperature.level);
    }
  }

  function useHint() {
    if (engine.phase !== 'playing' || busy) return;
    const result = engine.hint();
    if (!result) return;
    if (result.exhausted) {
      hud.toast(
        'Sem mais dicas para este alvo. Use REVELAR se estiver perdido.',
        'warm',
      );
      return;
    }
    if (result.level === 1) {
      hud.showHint(`DICA: ${result.text}`);
      hud.log(`Dica comprada (−${result.penalty}): ${result.text}`, 'hint');
      hud.toast(`Dica liberada (−${result.penalty})`, 'hint');
    } else {
      let text = 'TRIANGULAÇÃO: satélite reposicionado sobre a área do alvo.';
      if (result.fromLastGuess) {
        text += ` O alvo está a ${formatDistance(result.fromLastGuess.distance)} ao ${result.fromLastGuess.direction} do seu último palpite.`;
      }
      hud.showHint(text);
      hud.log(`Triangulação (−${result.penalty}).`, 'hint');
      hud.toast(`Triangulação de satélite (−${result.penalty})`, 'hint');
      const near = result.nearby;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(near.lon, near.lat, 7000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 2.2,
      });
      hud.setHintAvailable(false);
    }
  }

  function revealTarget() {
    if (engine.phase !== 'playing' || busy) return;
    const result = engine.reveal();
    if (!result) return;
    const { target } = result;
    const height = surfaceHeight(target.lat, target.lon);
    addMarker({
      lat: target.lat,
      lon: target.lon,
      height,
      kind: 'revealed',
      label: `◎ ${target.name}`,
    });
    hud.toast(`Alvo revelado: ${target.name} (0 pts)`, 'warm', 2800);
    hud.log(`◎ Revelado: ${target.name}.`, 'warm');
    hud.log(`INTEL: ${target.intel}`, 'intel');
    flyToPoint(worldPosition(target.lat, target.lon, height));
    advanceAfter(2800, result.missionComplete);
  }

  function releaseGame() {
    stopTick();
    windowRef.clearTimeout(transitionTimer);
    busy = false;
    if (pointerLease) releasePointer(pointerLease);
    pointerLease = null;
  }

  function abortMission() {
    if (engine.phase !== 'playing') return;
    const ok = windowRef.confirm
      ? windowRef.confirm('Abortar a missão? O progresso será perdido.')
      : true;
    if (!ok) return;
    releaseGame();
    engine.abort();
    clearMarkers();
    hud.hideMission();
    openBriefing();
  }

  function finishMission() {
    releaseGame();
    const summary = engine.summary();
    const best = readBestScore(storage);
    const isRecord =
      summary.score > 0 &&
      recordBestScore(storage, {
        score: summary.score,
        missionId: summary.mission.id,
        missionName: summary.mission.codename,
        codename,
        at: new Date().toISOString(),
      });
    hud.log(`Missão encerrada: ${formatScore(summary.score)} pts.`, 'system');
    hud.showDebrief({ summary, codename, best, isRecord });
    setBodyState();
  }

  // ── Entrada: clique no globo e teclado ─────────────────────────
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((event) => {
    if (engine.phase !== 'playing') return;
    const point = pickLatLon(event.position);
    if (!point) {
      hud.toast(
        'Sem leitura do solo aqui. Aproxime o zoom e tente de novo.',
        'cold',
      );
      return;
    }
    handleGuess(point);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  const onKeyDown = (event) => {
    if (
      event.target?.matches?.(
        'input, textarea, select, [contenteditable="true"]',
      )
    )
      return;
    if (
      engine.phase === 'playing' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const key = event.key?.toLowerCase();
      if (key === 'h') {
        // O console usa H para alternar o HUD; durante a missão, H é a dica.
        event.preventDefault();
        event.stopImmediatePropagation();
        useHint();
      }
      return;
    }
    if (event.key === 'Escape' && (hud.briefingOpen || hud.debriefOpen)) {
      event.stopImmediatePropagation();
      closeToConsole();
    }
  };
  windowRef.addEventListener('keydown', onKeyDown, true);

  // ── Abertura automática ────────────────────────────────────────
  const params = new URLSearchParams(windowRef.location?.search ?? '');
  const spyParam = params.get('spy');
  const shouldAutoOpen =
    autoOpen ??
    (spyParam === '1' ||
      (spyParam !== '0' && storage?.getItem(AUTO_OPEN_KEY) !== 'off'));
  if (shouldAutoOpen) openBriefing();

  const api = {
    open: openBriefing,
    start: (missionId = 'random', name = codename) =>
      startMission(missionId, name),
    /** Palpite programático (útil para testes/QA): {lat, lon}. */
    guess: (lat, lon) =>
      handleGuess({ lat, lon, height: surfaceHeight(lat, lon) }),
    hint: useHint,
    reveal: revealTarget,
    get state() {
      return {
        phase: engine.phase,
        mission: engine.mission?.id ?? null,
        step: engine.stepIndex,
        score: engine.score,
        target: engine.currentTarget()?.id ?? null,
      };
    },
    destroy() {
      releaseGame();
      windowRef.removeEventListener('keydown', onKeyDown, true);
      handler.destroy();
      removePostRender();
      clearMarkers();
      hud.destroy();
      body.classList.remove('spy-game-open', 'spy-game-playing');
    },
  };
  return api;
}
