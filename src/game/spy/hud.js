/**
 * DOM do Modo Espião: tela de briefing, HUD da missão, registro de pistas e
 * debriefing. Toda a interface em pt-BR. Sem Cesium: o controlador
 * (index.js) liga estes elementos ao globo.
 */
import { TARGET_KIND_LABELS } from './missions.js';
import { formatClock, formatDistance, formatScore } from './engine.js';

/** Pequeno criador de elementos; texto sempre via textContent. */
function h(doc, tag, props = {}, children = []) {
  const el = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'className') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function')
      el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    el.append(typeof child === 'string' ? doc.createTextNode(child) : child);
  }
  return el;
}

/**
 * Efeito máquina de escrever cancelável. Clicar no elemento completa o texto.
 * @returns {() => void} completa imediatamente
 */
function typewrite(el, text, { speedMs = 16, reducedMotion = false } = {}) {
  if (el._spyTypewriter) el._spyTypewriter();
  if (reducedMotion || !text) {
    el.textContent = text || '';
    return () => {};
  }
  let i = 0;
  let timer = null;
  const finish = () => {
    clearInterval(timer);
    el.textContent = text;
    el.classList.remove('spy-typing');
    el.removeEventListener('click', finish);
    el._spyTypewriter = null;
  };
  el.textContent = '';
  el.classList.add('spy-typing');
  timer = setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) finish();
  }, speedMs);
  el.addEventListener('click', finish);
  el._spyTypewriter = finish;
  return finish;
}

/**
 * @param {object} options
 * @param {Document} options.documentRef
 * @param {ReadonlyArray<object>} options.missions
 * @param {object} options.handlers onStart(missionId, codename), onConsole(), onHint(), onReveal(), onAbort(), onReplay(), onOpen(), onAutoOpenChange(bool), onRerollCodename()
 */
export function createSpyHud({ documentRef = document, missions, handlers }) {
  const doc = documentRef;
  const reducedMotion =
    doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')
      ?.matches ?? false;
  let selectedMission = 'random';

  // ── Botão lançador (sempre visível) ─────────────────────────────
  const launcher = h(
    doc,
    'button',
    {
      type: 'button',
      id: 'spy-launcher',
      className: 'spy-launcher',
      title: 'Abrir o Modo Espião (Operação Olho de Deus)',
      'aria-label': 'Abrir o Modo Espião',
      onClick: () => handlers.onOpen(),
    },
    [
      h(doc, 'span', { className: 'spy-launcher-dot', 'aria-hidden': 'true' }),
      h(doc, 'span', { text: 'MODO ESPIÃO' }),
    ],
  );

  // ── Briefing (tela de entrada) ──────────────────────────────────
  const codenameInput = h(doc, 'input', {
    type: 'text',
    id: 'spy-codename',
    className: 'spy-input',
    maxlength: '18',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Seu codinome',
  });
  const missionBriefingText = h(doc, 'p', {
    className: 'spy-briefing-text',
    'aria-live': 'polite',
  });
  const bestLine = h(doc, 'p', { className: 'spy-best' });
  const autoOpenBox = h(doc, 'input', {
    type: 'checkbox',
    id: 'spy-autoopen',
    onChange: (event) => handlers.onAutoOpenChange(!event.target.checked),
  });

  const missionButtons = [];
  const missionList = h(doc, 'div', {
    className: 'spy-mission-list',
    role: 'radiogroup',
    'aria-label': 'Escolha a missão',
  });
  const randomBriefing =
    'Missão sorteada pela central. Você só descobre o alvo quando o canal seguro abrir. Boa sorte, agente.';
  const addMissionButton = (id, title, subtitle, badge) => {
    const btn = h(
      doc,
      'button',
      {
        type: 'button',
        className: 'spy-mission',
        role: 'radio',
        'aria-checked': 'false',
        dataset: { mission: id },
        onClick: () => selectMission(id),
      },
      [
        h(doc, 'span', { className: 'spy-mission-title', text: title }),
        h(doc, 'span', { className: 'spy-mission-sub', text: subtitle }),
        badge ? h(doc, 'span', { className: 'spy-badge', text: badge }) : null,
      ],
    );
    missionButtons.push(btn);
    missionList.append(btn);
  };
  addMissionButton(
    'random',
    'MISSÃO ALEATÓRIA',
    'A central escolhe por você',
    '?',
  );
  for (const m of missions)
    addMissionButton(
      m.id,
      m.codename,
      `${m.title} · ${m.tagline}`,
      m.difficulty,
    );

  function selectMission(id) {
    selectedMission = id;
    for (const btn of missionButtons) {
      const on = btn.dataset.mission === id;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-checked', String(on));
    }
    const mission = missions.find((m) => m.id === id);
    typewrite(
      missionBriefingText,
      mission ? mission.briefing : randomBriefing,
      {
        reducedMotion,
      },
    );
  }

  const briefing = h(
    doc,
    'div',
    {
      id: 'spy-briefing',
      className: 'spy-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'spy-briefing-title',
      hidden: true,
    },
    h(doc, 'div', { className: 'spy-card spy-briefing-card' }, [
      h(doc, 'div', { className: 'spy-scanlines', 'aria-hidden': 'true' }),
      h(doc, 'header', { className: 'spy-card-header' }, [
        h(doc, 'span', {
          className: 'spy-kicker',
          text: 'AGÊNCIA OLHO DE DEUS · CANAL SEGURO',
        }),
        h(doc, 'span', { className: 'spy-classified', text: 'ULTRASSECRETO' }),
      ]),
      h(doc, 'h2', { id: 'spy-briefing-title', className: 'spy-title' }, [
        'OPERAÇÃO ',
        h(doc, 'span', { className: 'spy-accent', text: 'OLHO DE DEUS' }),
      ]),
      h(doc, 'p', {
        className: 'spy-lead',
        text: 'Modo Espião: decifre as pistas, voe pelo globo 3D e clique no local exato de cada alvo em São Paulo.',
      }),
      h(doc, 'div', { className: 'spy-row' }, [
        h(doc, 'label', {
          className: 'spy-label',
          for: 'spy-codename',
          text: 'CODINOME',
        }),
        h(doc, 'div', { className: 'spy-codename-row' }, [
          h(doc, 'span', { className: 'spy-prefix', text: 'AGENTE' }),
          codenameInput,
          h(doc, 'button', {
            type: 'button',
            className: 'spy-btn spy-btn-ghost spy-btn-small',
            title: 'Sortear outro codinome',
            text: 'SORTEAR',
            onClick: () => handlers.onRerollCodename(),
          }),
        ]),
      ]),
      h(doc, 'div', { className: 'spy-row' }, [
        h(doc, 'span', { className: 'spy-label', text: 'MISSÃO' }),
        missionList,
      ]),
      h(doc, 'div', { className: 'spy-briefing-box' }, [
        h(doc, 'span', { className: 'spy-label', text: 'BRIEFING' }),
        missionBriefingText,
      ]),
      h(doc, 'details', { className: 'spy-howto', open: true }, [
        h(doc, 'summary', { text: 'Como jogar' }),
        h(doc, 'ul', {}, [
          h(doc, 'li', {
            text: 'Leia a pista criptografada no painel da missão.',
          }),
          h(doc, 'li', {
            text: 'Arraste para girar o globo, role o mouse (ou pinça) para dar zoom.',
          }),
          h(doc, 'li', {
            text: 'Clique no local que você acha que é o alvo. Acerte dentro do raio para avançar.',
          }),
          h(doc, 'li', {
            text: 'Errou? O termômetro diz se está Fervendo, Quente, Morno, Frio ou Congelando — e a distância.',
          }),
          h(doc, 'li', {
            text: 'Quanto mais rápido, maior o bônus. Erro: −50. Dica (tecla H): −100 / −200.',
          }),
        ]),
      ]),
      bestLine,
      h(doc, 'div', { className: 'spy-actions' }, [
        h(doc, 'button', {
          type: 'button',
          id: 'spy-start',
          className: 'spy-btn spy-btn-primary',
          text: 'INICIAR MISSÃO',
          onClick: () => handlers.onStart(selectedMission, codenameInput.value),
        }),
        h(doc, 'button', {
          type: 'button',
          id: 'spy-console',
          className: 'spy-btn spy-btn-ghost',
          text: 'IR PARA O CONSOLE NORMAL',
          onClick: () => handlers.onConsole(),
        }),
      ]),
      h(doc, 'label', { className: 'spy-check' }, [
        autoOpenBox,
        h(doc, 'span', {
          text: 'Não abrir o Modo Espião automaticamente (o botão MODO ESPIÃO continua disponível)',
        }),
      ]),
    ]),
  );

  // ── HUD da missão ───────────────────────────────────────────────
  const statMission = h(doc, 'span', { className: 'spy-stat-value' });
  const statAgent = h(doc, 'span', { className: 'spy-stat-value' });
  const statClock = h(doc, 'span', {
    className: 'spy-stat-value',
    id: 'spy-clock',
  });
  const statScore = h(doc, 'span', {
    className: 'spy-stat-value',
    id: 'spy-score',
  });
  const statStep = h(doc, 'span', { className: 'spy-stat-value' });
  const statBonus = h(doc, 'span', { className: 'spy-stat-value spy-bonus' });
  const stat = (label, valueEl) =>
    h(doc, 'div', { className: 'spy-stat' }, [
      h(doc, 'span', { className: 'spy-stat-label', text: label }),
      valueEl,
    ]);
  const topbar = h(
    doc,
    'div',
    { id: 'spy-topbar', className: 'spy-topbar', hidden: true },
    [
      stat('OPERAÇÃO', statMission),
      stat('AGENTE', statAgent),
      stat('TEMPO', statClock),
      stat('PONTOS', statScore),
      stat('ALVO', statStep),
      stat('BÔNUS', statBonus),
    ],
  );

  const clueKind = h(doc, 'span', { className: 'spy-clue-kind' });
  const clueText = h(doc, 'p', {
    className: 'spy-clue-text',
    id: 'spy-clue',
    'aria-live': 'polite',
  });
  const hintText = h(doc, 'p', { className: 'spy-hint-text', hidden: true });
  const thermo = h(
    doc,
    'div',
    { className: 'spy-thermo', 'aria-hidden': 'true' },
    [h(doc, 'div', { className: 'spy-thermo-fill' })],
  );
  const thermoLabel = h(doc, 'span', {
    className: 'spy-thermo-label',
    text: 'SEM LEITURA',
  });
  const logList = h(doc, 'ol', { className: 'spy-log', 'aria-live': 'polite' });
  const hintBtn = h(doc, 'button', {
    type: 'button',
    className: 'spy-btn spy-btn-small',
    id: 'spy-hint',
    text: 'DICA (H)',
    onClick: () => handlers.onHint(),
  });
  const panelBody = h(doc, 'div', { className: 'spy-panel-body' });
  const panel = h(
    doc,
    'aside',
    {
      id: 'spy-panel',
      className: 'spy-panel',
      hidden: true,
      'aria-label': 'Painel da missão',
    },
    [
      h(doc, 'div', { className: 'spy-scanlines', 'aria-hidden': 'true' }),
      h(doc, 'header', { className: 'spy-panel-header' }, [
        h(doc, 'span', { className: 'spy-kicker', text: 'DOSSIÊ DA MISSÃO' }),
        h(doc, 'button', {
          type: 'button',
          className: 'spy-icon-btn',
          title: 'Minimizar painel',
          'aria-label': 'Minimizar painel',
          text: '–',
          onClick: () => panel.classList.toggle('collapsed'),
        }),
      ]),
      panelBody,
    ],
  );
  panelBody.append(
    h(doc, 'div', { className: 'spy-clue-head' }, [clueKind]),
    clueText,
    hintText,
    h(doc, 'div', { className: 'spy-thermo-row' }, [thermo, thermoLabel]),
    h(doc, 'div', { className: 'spy-panel-actions' }, [
      hintBtn,
      h(doc, 'button', {
        type: 'button',
        className: 'spy-btn spy-btn-small spy-btn-ghost',
        id: 'spy-reveal',
        text: 'REVELAR (0 pts)',
        title: 'Revela o alvo atual sem pontuar',
        onClick: () => handlers.onReveal(),
      }),
      h(doc, 'button', {
        type: 'button',
        className: 'spy-btn spy-btn-small spy-btn-danger',
        id: 'spy-abort',
        text: 'ABORTAR',
        onClick: () => handlers.onAbort(),
      }),
    ]),
    h(doc, 'span', { className: 'spy-label', text: 'REGISTRO DE PISTAS' }),
    logList,
    h(doc, 'p', {
      className: 'spy-footnote',
      text: 'Clique no globo para marcar seu palpite. H = dica.',
    }),
  );

  const toast = h(doc, 'div', {
    id: 'spy-toast',
    className: 'spy-toast',
    role: 'status',
    hidden: true,
  });
  const markerLayer = h(doc, 'div', {
    id: 'spy-markers',
    className: 'spy-markers',
    'aria-hidden': 'true',
  });

  // ── Debriefing ──────────────────────────────────────────────────
  const debriefBody = h(doc, 'div', { className: 'spy-debrief-body' });
  const debrief = h(
    doc,
    'div',
    {
      id: 'spy-debrief',
      className: 'spy-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'spy-debrief-title',
      hidden: true,
    },
    h(doc, 'div', { className: 'spy-card spy-debrief-card' }, [
      h(doc, 'div', { className: 'spy-scanlines', 'aria-hidden': 'true' }),
      h(doc, 'header', { className: 'spy-card-header' }, [
        h(doc, 'span', {
          className: 'spy-kicker',
          text: 'DEBRIEFING · RELATÓRIO FINAL',
        }),
        h(doc, 'span', { className: 'spy-classified', text: 'CONFIDENCIAL' }),
      ]),
      h(doc, 'h2', {
        id: 'spy-debrief-title',
        className: 'spy-title',
        text: 'MISSÃO CONCLUÍDA',
      }),
      debriefBody,
      h(doc, 'div', { className: 'spy-actions' }, [
        h(doc, 'button', {
          type: 'button',
          id: 'spy-replay',
          className: 'spy-btn spy-btn-primary',
          text: 'JOGAR NOVAMENTE',
          onClick: () => handlers.onReplay(),
        }),
        h(doc, 'button', {
          type: 'button',
          className: 'spy-btn spy-btn-ghost',
          text: 'VOLTAR AO CONSOLE',
          onClick: () => handlers.onConsole(),
        }),
      ]),
    ]),
  );

  const root = h(doc, 'div', { id: 'spy-game-root', className: 'spy-root' }, [
    markerLayer,
    launcher,
    topbar,
    panel,
    toast,
    briefing,
    debrief,
  ]);
  doc.body.append(root);

  let toastTimer = null;
  let clueFinish = () => {};

  const api = {
    root,
    markerLayer,
    launcher,

    showBriefing({ codename, best, autoOpen }) {
      codenameInput.value = codename;
      autoOpenBox.checked = !autoOpen;
      bestLine.textContent = best
        ? `Recorde: ${formatScore(best.score)} pts — Agente ${best.codename || '?'} (${best.missionName || 'missão'})`
        : 'Nenhum recorde ainda. Seja o primeiro a entrar para a história da Agência.';
      debrief.hidden = true;
      briefing.hidden = false;
      selectMission(selectedMission);
      doc.defaultView?.requestAnimationFrame?.(() =>
        doc.getElementById('spy-start')?.focus({ preventScroll: true }),
      );
    },
    hideBriefing() {
      briefing.hidden = true;
    },
    setCodename(value) {
      codenameInput.value = value;
    },
    get briefingOpen() {
      return !briefing.hidden;
    },

    showMission({ mission, codename }) {
      statMission.textContent = mission.codename.replace('OPERAÇÃO ', '');
      statAgent.textContent = codename;
      logList.replaceChildren();
      topbar.hidden = false;
      panel.hidden = false;
      panel.classList.remove('collapsed');
      launcher.hidden = true;
    },
    hideMission() {
      topbar.hidden = true;
      panel.hidden = true;
      launcher.hidden = false;
      toast.hidden = true;
    },

    setClue({ target, index, total }) {
      clueKind.textContent = `ALVO ${index + 1}/${total} · ${TARGET_KIND_LABELS[target.kind] || 'ALVO'}`;
      statStep.textContent = `${index + 1}/${total}`;
      hintText.hidden = true;
      hintText.textContent = '';
      hintBtn.disabled = false;
      api.setThermo(null);
      clueFinish = typewrite(clueText, target.clue, { reducedMotion });
    },
    showHint(text) {
      clueFinish();
      hintText.hidden = false;
      hintText.textContent = hintText.textContent
        ? `${hintText.textContent}\n${text}`
        : text;
    },
    setHintAvailable(available) {
      hintBtn.disabled = !available;
    },

    setStatus({ elapsedMs, score, bonus }) {
      statClock.textContent = formatClock(elapsedMs);
      statScore.textContent = formatScore(score);
      statBonus.textContent = `+${bonus}`;
    },

    setThermo(temperature, distance) {
      const level = temperature?.level ?? 'none';
      thermo.dataset.level = level;
      panel.dataset.level = level;
      thermoLabel.textContent = temperature
        ? `${temperature.label.toUpperCase()}${Number.isFinite(distance) ? ` · ${formatDistance(distance)}` : ''}`
        : 'SEM LEITURA';
    },

    log(text, tone = 'info') {
      const stamp = new Date();
      const time = `${String(stamp.getHours()).padStart(2, '0')}:${String(stamp.getMinutes()).padStart(2, '0')}:${String(stamp.getSeconds()).padStart(2, '0')}`;
      const item = h(
        doc,
        'li',
        { className: `spy-log-item spy-tone-${tone}` },
        [
          h(doc, 'span', { className: 'spy-log-time', text: time }),
          h(doc, 'span', { text }),
        ],
      );
      logList.prepend(item);
      while (logList.children.length > 30) logList.lastChild.remove();
    },

    toast(text, tone = 'info', ms = 2600) {
      clearTimeout(toastTimer);
      toast.textContent = text;
      toast.className = `spy-toast spy-tone-${tone}`;
      toast.hidden = false;
      // Reinicia a animação de entrada.
      void toast.offsetWidth;
      toast.classList.add('show');
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toast.hidden = true;
      }, ms);
    },

    showDebrief({ summary, codename, best, isRecord }) {
      const rows = [
        ['Agente', codename],
        ['Operação', summary.mission?.codename ?? '—'],
        [
          'Alvos encontrados',
          `${summary.found}/${summary.total}${summary.revealed ? ` (${summary.revealed} revelado${summary.revealed > 1 ? 's' : ''})` : ''}`,
        ],
        ['Tempo total', formatClock(summary.elapsedMs)],
        ['Palpites errados', String(summary.wrongGuesses)],
        ['Dicas usadas', String(summary.hintsUsed)],
        ['Patente', summary.rank],
      ];
      const results = h(
        doc,
        'ol',
        { className: 'spy-debrief-targets' },
        summary.results.map((r) =>
          h(doc, 'li', { className: r.outcome === 'found' ? 'ok' : 'miss' }, [
            h(doc, 'span', { text: r.outcome === 'found' ? '✔' : '✖' }),
            h(doc, 'span', { text: r.target.name }),
            h(doc, 'span', {
              className: 'spy-dim',
              text:
                r.outcome === 'found'
                  ? `+${r.points} · ${formatClock(r.seconds * 1000)}`
                  : 'revelado',
            }),
          ]),
        ),
      );
      debriefBody.replaceChildren(
        h(doc, 'div', { className: 'spy-final-score' }, [
          h(doc, 'span', { className: 'spy-label', text: 'PONTUAÇÃO FINAL' }),
          h(doc, 'strong', {
            id: 'spy-final-score',
            text: formatScore(summary.score),
          }),
          isRecord
            ? h(doc, 'span', {
                className: 'spy-record',
                text: '★ NOVO RECORDE ★',
              })
            : best
              ? h(doc, 'span', {
                  className: 'spy-dim',
                  text: `Recorde: ${formatScore(best.score)} pts (Agente ${best.codename || '?'})`,
                })
              : null,
        ]),
        h(
          doc,
          'dl',
          { className: 'spy-debrief-stats' },
          rows.flatMap(([k, v]) => [
            h(doc, 'dt', { text: k }),
            h(doc, 'dd', { text: v }),
          ]),
        ),
        results,
      );
      briefing.hidden = true;
      debrief.hidden = false;
      doc.defaultView?.requestAnimationFrame?.(() =>
        doc.getElementById('spy-replay')?.focus({ preventScroll: true }),
      );
    },
    hideDebrief() {
      debrief.hidden = true;
    },
    get debriefOpen() {
      return !debrief.hidden;
    },

    destroy() {
      clearTimeout(toastTimer);
      root.remove();
    },
  };
  return api;
}
