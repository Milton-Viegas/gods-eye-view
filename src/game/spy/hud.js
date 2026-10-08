/**
 * DOM do Modo Espião: tela de briefing, HUD da missão, registro de pistas e
 * debriefing. Toda a interface em pt-BR. Sem Cesium: o controlador
 * (index.js) liga estes elementos ao globo.
 */
import { TARGET_KIND_LABELS } from './missions.js';
import { formatClock, formatDistance, formatScore } from './engine.js';
import {
  MAX_TIER,
  SPY_TIERS,
  UNLOCK_RATIO,
  tierLabel,
  tierRules,
  unlockThreshold,
} from './difficulty.js';

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

/** "3 min" / "90 s" */
function formatWindow(seconds) {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
}

/** Resumo das regras de um nível para o briefing. */
export function describeTier(level) {
  const tier = tierRules(level);
  const hints = tier.hintPenalties.length
    ? `Dicas ${tier.hintPenalties.map((p) => `−${p}`).join(' / ')}`
    : 'Sem dicas';
  return [
    `Raio ${formatDistance(tier.minRadiusM)}–${formatDistance(tier.maxRadiusM)}`,
    `bônus zera em ${formatWindow(tier.timeBonusWindowS)}`,
    `erro −${tier.wrongPenalty}`,
    hints,
    tier.hardClues ? 'pistas vagas' : 'pistas completas',
    `pontos ×${String(tier.multiplier).replace('.', ',')}`,
  ].join(' · ');
}

const formatTime = (ms) => formatClock(ms);

/**
 * @param {object} options
 * @param {Document} options.documentRef
 * @param {ReadonlyArray<object>} options.missions
 * @param {object} options.handlers onStart({missionId, tier, campaign}, codename), onConsole(), onHint(), onReveal(), onAbort(), onReplay(), onOpen(), onAutoOpenChange(bool), onRerollCodename(), onRankingRequest({mission, tier}), onSubmitRetry(), onShowRanking()
 */
export function createSpyHud({ documentRef = document, missions, handlers }) {
  const doc = documentRef;
  const reducedMotion =
    doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')
      ?.matches ?? false;
  let selectedMission = 'random';
  let selectedTier = 1;
  let campaign = true;
  let unlockedTier = 1;
  let activeTab = 'missions';

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
    maxlength: '20',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Seu codinome',
  });
  const missionBriefingText = h(doc, 'p', {
    className: 'spy-briefing-text',
    'aria-live': 'polite',
  });
  const bestLine = h(doc, 'p', { className: 'spy-best' });
  const progressLine = h(doc, 'p', {
    className: 'spy-progress',
    id: 'spy-progress',
  });
  const tierRulesLine = h(doc, 'p', {
    className: 'spy-tier-rules',
    id: 'spy-tier-rules',
  });
  const testBadge = h(doc, 'span', {
    className: 'spy-test-badge',
    text: 'MODO TESTE · SEM RANKING',
    hidden: true,
  });
  const autoOpenBox = h(doc, 'input', {
    type: 'checkbox',
    id: 'spy-autoopen',
    onChange: (event) => handlers.onAutoOpenChange(!event.target.checked),
  });

  // Modo: campanha × treino livre
  const modeButtons = [];
  const modeRow = h(doc, 'div', {
    className: 'spy-segmented',
    role: 'radiogroup',
    'aria-label': 'Modo de jogo',
  });
  for (const [id, label, title] of [
    [
      'campaign',
      'CAMPANHA',
      'Avance de nível em nível: cada missão no seu nível',
    ],
    ['free', 'TREINO LIVRE', 'Qualquer missão em qualquer nível'],
  ]) {
    const btn = h(doc, 'button', {
      type: 'button',
      className: 'spy-seg',
      role: 'radio',
      'aria-checked': 'false',
      title,
      dataset: { mode: id },
      text: label,
      onClick: () => setMode(id === 'campaign'),
    });
    modeButtons.push(btn);
    modeRow.append(btn);
  }

  // Níveis
  const tierButtons = [];
  const tierRow = h(doc, 'div', {
    className: 'spy-tier-list',
    id: 'spy-tier-list',
    role: 'radiogroup',
    'aria-label': 'Nível de dificuldade',
  });
  for (const tier of SPY_TIERS) {
    const btn = h(
      doc,
      'button',
      {
        type: 'button',
        className: 'spy-tier',
        role: 'radio',
        'aria-checked': 'false',
        dataset: { tier: String(tier.level) },
        onClick: () => selectTier(tier.level),
      },
      [
        h(doc, 'span', { className: 'spy-tier-num', text: `N${tier.level}` }),
        h(doc, 'span', { className: 'spy-tier-name', text: tier.name }),
        h(doc, 'span', {
          className: 'spy-tier-mult',
          text: `×${String(tier.multiplier).replace('.', ',')}`,
        }),
        h(doc, 'span', {
          className: 'spy-tier-lock',
          'aria-hidden': 'true',
          text: '🔒',
        }),
      ],
    );
    tierButtons.push(btn);
    tierRow.append(btn);
  }

  const missionButtons = [];
  const missionList = h(doc, 'div', {
    className: 'spy-mission-list',
    role: 'radiogroup',
    'aria-label': 'Escolha a missão',
  });
  const randomBriefing =
    'Missão sorteada pela central entre as do nível escolhido. Você só descobre o alvo quando o canal seguro abrir. Boa sorte, agente.';
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
      `N${m.tier}`,
    );

  function visibleMissionIds() {
    return missions
      .filter((m) => !campaign || m.tier === selectedTier)
      .map((m) => m.id);
  }

  function refreshMissionList() {
    const visible = new Set(['random', ...visibleMissionIds()]);
    for (const btn of missionButtons)
      btn.hidden = !visible.has(btn.dataset.mission);
    if (!visible.has(selectedMission)) selectedMission = 'random';
  }

  function refreshTiers() {
    for (const btn of tierButtons) {
      const level = Number(btn.dataset.tier);
      const locked = campaign && level > unlockedTier;
      const on = level === selectedTier;
      btn.disabled = locked;
      btn.classList.toggle('locked', locked);
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-checked', String(on));
      btn.title = locked
        ? `Nível ${level} bloqueado — conclua uma missão do nível ${level - 1} com pelo menos ${Math.round(UNLOCK_RATIO * 100)}% da pontuação máxima.`
        : describeTier(level);
    }
    for (const btn of modeButtons) {
      const on = (btn.dataset.mode === 'campaign') === campaign;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-checked', String(on));
    }
    tierRulesLine.textContent = `${tierLabel(selectedTier)} — ${describeTier(selectedTier)}`;
    const nextNeeded =
      unlockedTier < MAX_TIER
        ? ` Próximo: conclua uma missão do Nível ${unlockedTier} com ≥ ${formatScore(unlockThreshold(5, unlockedTier))} pts (${Math.round(UNLOCK_RATIO * 100)}% do máximo).`
        : ' Todos os níveis liberados.';
    progressLine.textContent = campaign
      ? `Campanha: Nível ${unlockedTier} de ${MAX_TIER} liberado.${nextNeeded}`
      : 'Treino livre: qualquer missão em qualquer nível. A pontuação também vale para o Ranking Global, mas não libera níveis da campanha.';
  }

  function setMode(isCampaign) {
    campaign = isCampaign;
    if (campaign && selectedTier > unlockedTier) selectedTier = unlockedTier;
    refreshTiers();
    refreshMissionList();
    selectMission(selectedMission);
  }

  function selectTier(level) {
    if (campaign && level > unlockedTier) return;
    selectedTier = level;
    refreshTiers();
    refreshMissionList();
    selectMission(selectedMission);
  }

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

  // ── Ranking Global (aba do briefing) ───────────────────────────
  const rankMissionSelect = h(
    doc,
    'select',
    {
      id: 'spy-rank-mission',
      className: 'spy-select',
      'aria-label': 'Filtrar ranking por missão',
      onChange: () => requestRanking(),
    },
    [
      h(doc, 'option', { value: 'all', text: 'Todas as missões' }),
      ...missions.map((m) =>
        h(doc, 'option', { value: m.id, text: m.codename }),
      ),
    ],
  );
  const rankTierSelect = h(
    doc,
    'select',
    {
      id: 'spy-rank-tier',
      className: 'spy-select',
      'aria-label': 'Filtrar ranking por nível',
      onChange: () => requestRanking(),
    },
    [
      h(doc, 'option', { value: 'all', text: 'Todos os níveis' }),
      ...SPY_TIERS.map((t) =>
        h(doc, 'option', {
          value: String(t.level),
          text: `Nível ${t.level} · ${t.name}`,
        }),
      ),
    ],
  );
  const rankStatus = h(doc, 'p', {
    className: 'spy-rank-status',
    id: 'spy-rank-status',
    'aria-live': 'polite',
  });
  const rankList = h(doc, 'ol', {
    className: 'spy-rank-list',
    id: 'spy-rank-list',
  });

  function requestRanking() {
    rankStatus.textContent = 'Consultando a central…';
    rankStatus.dataset.tone = 'info';
    rankList.replaceChildren();
    handlers.onRankingRequest?.({
      mission: rankMissionSelect.value,
      tier: rankTierSelect.value,
    });
  }

  const tabs = {};
  const tabPanels = {};
  const tabBar = h(doc, 'div', {
    className: 'spy-tabs',
    role: 'tablist',
    'aria-label': 'Seções do briefing',
  });
  function selectTab(id) {
    activeTab = id;
    for (const [key, tab] of Object.entries(tabs)) {
      const on = key === id;
      tab.classList.toggle('selected', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tabPanels[key].hidden = !on;
    }
    if (id === 'ranking') requestRanking();
  }
  for (const [id, label] of [
    ['missions', 'MISSÕES'],
    ['ranking', 'RANKING GLOBAL'],
  ]) {
    tabs[id] = h(doc, 'button', {
      type: 'button',
      role: 'tab',
      id: `spy-tab-${id}`,
      className: 'spy-tab',
      'aria-controls': `spy-tabpanel-${id}`,
      'aria-selected': 'false',
      text: label,
      onClick: () => selectTab(id),
    });
    tabBar.append(tabs[id]);
  }

  tabPanels.missions = h(
    doc,
    'div',
    {
      id: 'spy-tabpanel-missions',
      role: 'tabpanel',
      'aria-labelledby': 'spy-tab-missions',
    },
    [
      h(doc, 'div', { className: 'spy-row' }, [
        h(doc, 'span', { className: 'spy-label', text: 'MODO' }),
        modeRow,
      ]),
      h(doc, 'div', { className: 'spy-row' }, [
        h(doc, 'span', { className: 'spy-label', text: 'NÍVEL' }),
        tierRow,
        tierRulesLine,
        progressLine,
      ]),
      h(doc, 'div', { className: 'spy-row' }, [
        h(doc, 'span', { className: 'spy-label', text: 'MISSÃO' }),
        missionList,
      ]),
      h(doc, 'div', { className: 'spy-briefing-box' }, [
        h(doc, 'span', { className: 'spy-label', text: 'BRIEFING' }),
        missionBriefingText,
      ]),
      h(doc, 'details', { className: 'spy-howto' }, [
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
            text: 'Cada nível encolhe o raio de acerto e a janela do bônus de tempo, aumenta a penalidade por erro, encarece (ou remove) as dicas e multiplica os pontos. Nos níveis 4 e 5 as pistas ficam vagas.',
          }),
          h(doc, 'li', {
            text: 'Campanha: conclua uma missão com pelo menos 40% da pontuação máxima para liberar o próximo nível. Treino livre: jogue qualquer missão em qualquer nível.',
          }),
          h(doc, 'li', {
            text: 'Ao terminar, sua pontuação vai para o Ranking Global (por missão e nível).',
          }),
        ]),
      ]),
    ],
  );

  tabPanels.ranking = h(
    doc,
    'div',
    {
      id: 'spy-tabpanel-ranking',
      role: 'tabpanel',
      'aria-labelledby': 'spy-tab-ranking',
      hidden: true,
    },
    [
      h(doc, 'div', { className: 'spy-rank-filters' }, [
        rankMissionSelect,
        rankTierSelect,
        h(doc, 'button', {
          type: 'button',
          className: 'spy-btn spy-btn-ghost spy-btn-small',
          text: 'ATUALIZAR',
          onClick: () => requestRanking(),
        }),
      ]),
      rankStatus,
      rankList,
      h(doc, 'p', {
        className: 'spy-footnote',
        text: 'Top 20 da Agência. Cada codinome aparece uma vez por missão e nível (vale a melhor marca). Pontuações impossíveis são recusadas pela central.',
      }),
    ],
  );

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
        testBadge,
        h(doc, 'span', { className: 'spy-classified', text: 'ULTRASSECRETO' }),
      ]),
      h(doc, 'h2', { id: 'spy-briefing-title', className: 'spy-title' }, [
        'OPERAÇÃO ',
        h(doc, 'span', { className: 'spy-accent', text: 'OLHO DE DEUS' }),
      ]),
      h(doc, 'p', {
        className: 'spy-lead',
        text: 'Modo Espião: decifre as pistas, voe pelo globo 3D e clique no local exato de cada alvo em São Paulo. Oito operações, cinco níveis e um ranking global.',
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
      tabBar,
      tabPanels.missions,
      tabPanels.ranking,
      bestLine,
      h(doc, 'div', { className: 'spy-actions' }, [
        h(doc, 'button', {
          type: 'button',
          id: 'spy-start',
          className: 'spy-btn spy-btn-primary',
          text: 'INICIAR MISSÃO',
          onClick: () =>
            handlers.onStart(
              {
                missionId: selectedMission,
                tier: selectedTier,
                campaign,
                pool: campaign ? visibleMissionIds() : null,
              },
              codenameInput.value,
            ),
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
  const statTier = h(doc, 'span', {
    className: 'spy-stat-value spy-tier-value',
    id: 'spy-tier',
  });
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
      stat('NÍVEL', statTier),
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
  const submitStatus = h(doc, 'p', {
    className: 'spy-submit-status',
    id: 'spy-submit-status',
    'aria-live': 'polite',
  });
  const submitBtn = h(doc, 'button', {
    type: 'button',
    id: 'spy-submit',
    className: 'spy-btn spy-btn-small',
    text: 'ENVIAR AO RANKING GLOBAL',
    hidden: true,
    onClick: () => handlers.onSubmitRetry?.(),
  });
  const debriefRanking = h(doc, 'div', { className: 'spy-debrief-ranking' }, [
    h(doc, 'span', { className: 'spy-label', text: 'RANKING GLOBAL' }),
    submitStatus,
    h(doc, 'div', { className: 'spy-panel-actions' }, [
      submitBtn,
      h(doc, 'button', {
        type: 'button',
        id: 'spy-view-ranking',
        className: 'spy-btn spy-btn-small spy-btn-ghost',
        text: 'VER RANKING',
        onClick: () => handlers.onShowRanking?.(),
      }),
    ]),
  ]);
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
      debriefRanking,
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

    showBriefing({
      codename,
      best,
      autoOpen,
      progress,
      tab,
      filter,
      testMode,
    }) {
      codenameInput.value = codename;
      autoOpenBox.checked = !autoOpen;
      testBadge.hidden = !testMode;
      unlockedTier = progress?.unlockedTier ?? 1;
      if (campaign && selectedTier > unlockedTier) selectedTier = unlockedTier;
      if (filter) {
        rankMissionSelect.value = filter.mission ?? 'all';
        rankTierSelect.value = String(filter.tier ?? 'all');
      }
      refreshTiers();
      refreshMissionList();
      bestLine.textContent = best
        ? `Recorde: ${formatScore(best.score)} pts — Agente ${best.codename || '?'} (${best.missionName || 'missão'})`
        : 'Nenhum recorde ainda. Seja o primeiro a entrar para a história da Agência.';
      debrief.hidden = true;
      briefing.hidden = false;
      selectMission(selectedMission);
      selectTab(tab ?? activeTab);
      doc.defaultView?.requestAnimationFrame?.(() =>
        doc.getElementById('spy-start')?.focus({ preventScroll: true }),
      );
    },
    /** Preenche a aba Ranking Global com a resposta de /api/spy-leaderboard. */
    setRanking(result, { highlight } = {}) {
      rankList.replaceChildren();
      if (!result?.ok) {
        rankStatus.dataset.tone = 'warm';
        rankStatus.textContent = result?.offline
          ? `Ranking Global fora do ar (${result?.error || 'sem conexão'}). Seu recorde local continua salvo neste navegador.`
          : `Não foi possível carregar o ranking: ${result?.error || 'erro desconhecido'}.`;
        return;
      }
      if (!result.entries.length) {
        rankStatus.dataset.tone = 'info';
        rankStatus.textContent =
          'Nenhum agente no ranking com esse filtro ainda. A vaga de nº 1 é sua.';
        return;
      }
      rankStatus.dataset.tone = 'success';
      rankStatus.textContent = `${result.total} registro${result.total === 1 ? '' : 's'} · mostrando o top ${result.entries.length}`;
      for (const e of result.entries) {
        const mine = highlight && e.codename === highlight;
        rankList.append(
          h(doc, 'li', { className: `spy-rank-item${mine ? ' mine' : ''}` }, [
            h(doc, 'span', {
              className: 'spy-rank-pos',
              text: `#${e.position}`,
            }),
            h(doc, 'span', { className: 'spy-rank-name', text: e.codename }),
            h(doc, 'span', {
              className: 'spy-rank-meta',
              text: `${String(e.missionCodename || e.missionId).replace('OPERAÇÃO ', '')} · N${e.tier} · ${formatTime(e.durationMs)}`,
            }),
            h(doc, 'strong', {
              className: 'spy-rank-score',
              text: formatScore(e.score),
            }),
          ]),
        );
      }
    },
    get rankingFilter() {
      return { mission: rankMissionSelect.value, tier: rankTierSelect.value };
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

    showMission({ mission, codename, tier }) {
      statMission.textContent = mission.codename.replace('OPERAÇÃO ', '');
      statTier.textContent = tierLabel(tier, { short: true });
      statTier.title = tierLabel(tier);
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
    /** Texto do botão de dica conforme o nível: custo da próxima ou "SEM DICAS". */
    setHintCost(cost) {
      if (cost == null) {
        hintBtn.textContent = 'SEM DICAS';
        hintBtn.disabled = true;
        hintBtn.title = 'Este nível não tem dicas.';
      } else {
        hintBtn.textContent = `DICA (H) −${cost}`;
        hintBtn.title = `A próxima dica custa ${cost} pontos.`;
      }
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

    showDebrief({ summary, codename, best, isRecord, unlocked, testMode }) {
      const rows = [
        ['Agente', codename],
        ['Operação', summary.mission?.codename ?? '—'],
        [
          'Nível',
          `${tierLabel(summary.tier)}${summary.campaign ? ' (campanha)' : ' (treino livre)'}`,
        ],
        ['Máximo possível', `${formatScore(summary.maxScore)} pts`],
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
        unlocked
          ? h(doc, 'p', {
              className: 'spy-unlock',
              id: 'spy-unlock',
              text: `🔓 NÍVEL ${unlocked} LIBERADO — ${tierRules(unlocked).name}! Novas missões disponíveis na campanha.`,
            })
          : summary.campaign &&
              summary.tier < MAX_TIER &&
              summary.score < unlockThreshold(summary.total, summary.tier)
            ? h(doc, 'p', {
                className: 'spy-dim',
                text: `Para liberar o Nível ${summary.tier + 1}, faça pelo menos ${formatScore(unlockThreshold(summary.total, summary.tier))} pts numa missão deste nível.`,
              })
            : null,
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
      api.setSubmitStatus(
        testMode
          ? {
              tone: 'warm',
              text: 'Modo de teste (?spytest=1): esta partida não vai para o Ranking Global.',
            }
          : { tone: 'info', text: 'Enviando ao Ranking Global…' },
      );
      briefing.hidden = true;
      debrief.hidden = false;
      doc.defaultView?.requestAnimationFrame?.(() =>
        doc.getElementById('spy-replay')?.focus({ preventScroll: true }),
      );
    },
    /** Estado do envio ao ranking no debriefing. */
    setSubmitStatus({ tone = 'info', text, retry = false }) {
      submitStatus.dataset.tone = tone;
      submitStatus.textContent = text;
      submitBtn.hidden = !retry;
      submitBtn.disabled = false;
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
