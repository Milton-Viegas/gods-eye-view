/**
 * Missões do Modo Espião (Operação Olho de Deus).
 *
 * Todas as coordenadas são pontos reais e conhecidos de São Paulo (WGS84,
 * graus decimais). `radiusM` é o raio de aceitação do palpite: lugares grandes
 * (parques, estádios) aceitam um raio maior. As casas seguras da Operação Casa
 * Segura espelham os pontos de amostra da camada `listings-sp`
 * (src/layers/listingsSp/listings.geojson).
 *
 * Dados puros: nenhum import de Cesium ou DOM, para poderem ser testados em Node.
 */

/** Centro aproximado de São Paulo usado para a visão inicial da missão. */
export const SAO_PAULO_VIEW = Object.freeze({
  lat: -23.5735,
  lon: -46.6575,
  heightM: 26000,
});

/** @typedef {'ponto-morto'|'informante'|'casa-segura'|'alvo'} SpyTargetKind */

/**
 * @typedef {object} SpyTarget
 * @property {string} id
 * @property {string} name Nome revelado quando o alvo é encontrado.
 * @property {SpyTargetKind} kind
 * @property {number} lat
 * @property {number} lon
 * @property {number} radiusM
 * @property {string} clue Pista criptografada mostrada ao jogador.
 * @property {string} hint Dica (custa pontos).
 * @property {string} intel Texto de inteligência revelado ao acertar.
 */

export const TARGET_KIND_LABELS = Object.freeze({
  'ponto-morto': 'PONTO MORTO',
  informante: 'INFORMANTE',
  'casa-segura': 'CASA SEGURA',
  alvo: 'ALVO PRINCIPAL',
});

/** @type {ReadonlyArray<{id:string,codename:string,title:string,tagline:string,difficulty:string,briefing:string,targets:SpyTarget[]}>} */
export const SPY_MISSIONS = Object.freeze([
  {
    id: 'garoa',
    codename: 'OPERAÇÃO GAROA',
    title: 'O Traidor do Centro',
    tagline: 'Centro histórico e Av. Paulista',
    difficulty: 'Recruta',
    briefing:
      'Agente, temos um problema. SABIÁ, um agente duplo, roubou a lista de informantes da Agência e vai entregá-la a um comprador estrangeiro ainda hoje. Ele deixou pontos mortos pelo coração de São Paulo. Siga as pistas, recupere os microfilmes e capture SABIÁ antes que a lista saia do país.',
    targets: [
      {
        id: 'masp',
        name: 'MASP — Av. Paulista',
        kind: 'ponto-morto',
        lat: -23.5614,
        lon: -46.6559,
        radiusM: 900,
        clue: 'Quatro pernas vermelhas sustentam a arte acima da avenida mais famosa da cidade. Debaixo do vão livre de 74 metros, o primeiro microfilme espera por você.',
        hint: 'Avenida Paulista, em frente ao Parque Trianon.',
        intel:
          'Microfilme 1/3 recuperado sob o vão livre. Ele aponta para um prédio sinuoso no Centro.',
      },
      {
        id: 'copan',
        name: 'Edifício Copan',
        kind: 'informante',
        lat: -23.5465,
        lon: -46.6445,
        radiusM: 750,
        clue: 'Nosso informante mora numa onda de concreto desenhada por Niemeyer: mais de mil apartamentos, um CEP só dele e vista para a Praça da República.',
        hint: 'Centro, esquina da Av. Ipiranga com a Rua da Consolação.',
        intel:
          'O informante CORUJA confirma: SABIÁ pegou um trem rumo ao norte do Centro.',
      },
      {
        id: 'luz',
        name: 'Estação da Luz',
        kind: 'ponto-morto',
        lat: -23.5347,
        lon: -46.6352,
        radiusM: 750,
        clue: 'Tijolos ingleses, uma torre com relógio e trens chegando desde 1901. O segundo microfilme está escondido na estação ao lado do jardim público mais antigo da cidade.',
        hint: 'Bairro da Luz, vizinha da Pinacoteca e do Jardim da Luz.',
        intel:
          'Microfilme 2/3 recuperado num armário da plataforma. Cheiro de mortadela no papel…',
      },
      {
        id: 'mercadao',
        name: 'Mercado Municipal (Mercadão)',
        kind: 'informante',
        lat: -23.5417,
        lon: -46.6297,
        radiusM: 750,
        clue: 'Siga o cheiro de sanduíche de mortadela. Sob os vitrais coloridos, às margens do Tamanduateí, um feirante guarda o último microfilme.',
        hint: 'Rua da Cantareira, perto da Av. do Estado.',
        intel:
          'Microfilme 3/3 recuperado. SABIÁ vai "se confessar" no marco zero da cidade.',
      },
      {
        id: 'se',
        name: 'Catedral da Sé — Marco Zero',
        kind: 'alvo',
        lat: -23.5507,
        lon: -46.6343,
        radiusM: 700,
        clue: 'Torres góticas de 92 metros e o marco zero de onde se medem todas as estradas paulistas. SABIÁ está na praça. Feche o cerco!',
        hint: 'Praça da Sé, Centro.',
        intel:
          'SABIÁ capturado nas escadarias da catedral. Lista de informantes recuperada!',
      },
    ],
  },
  {
    id: 'faria-lima',
    codename: 'OPERAÇÃO CARCARÁ',
    title: 'Dinheiro Sujo na Faria Lima',
    tagline: 'Zona Oeste e Marginal Pinheiros',
    difficulty: 'Agente de campo',
    briefing:
      'A organização CARCARÁ está lavando dinheiro com criptoativos entre escritórios da zona oeste. Interceptamos as rotas dos mensageiros. Rastreie cada encontro, siga o carro-forte e descubra onde o chefe da quadrilha vai receber o pagamento final.',
    targets: [
      {
        id: 'largo-batata',
        name: 'Largo da Batata — Pinheiros',
        kind: 'informante',
        lat: -23.5668,
        lon: -46.6933,
        radiusM: 800,
        clue: 'O mensageiro desce do metrô da linha amarela num largo que leva o nome de um tubérculo. Ele carrega uma pasta prateada.',
        hint: 'Pinheiros, estação Faria Lima da Linha 4-Amarela.',
        intel:
          'Mensageiro seguido. Ele subiu a rua em direção a um beco grafitado.',
      },
      {
        id: 'beco-batman',
        name: 'Beco do Batman — Vila Madalena',
        kind: 'ponto-morto',
        lat: -23.5564,
        lon: -46.6878,
        radiusM: 700,
        clue: 'Cada muro desta viela boêmia é coberto de grafite. Um morcego deu nome ao lugar — e o pen-drive está atrás de um dos murais.',
        hint: 'Vila Madalena, perto da Rua Gonçalo Afonso.',
        intel:
          'Pen-drive recuperado: planilhas de apostas e o nome de um doleiro que frequenta corridas de cavalo.',
      },
      {
        id: 'jockey',
        name: 'Jockey Club de São Paulo',
        kind: 'informante',
        lat: -23.5856,
        lon: -46.6995,
        radiusM: 900,
        clue: 'Apostas altas: cavalos correm numa pista oval à beira do rio. O doleiro assiste às corridas da tribuna art déco.',
        hint: 'Cidade Jardim, às margens da Marginal Pinheiros.',
        intel:
          'O doleiro falou: o carro-forte cruza o rio à meia-noite por uma ponte em forma de X.',
      },
      {
        id: 'estaiada',
        name: 'Ponte Estaiada (Octávio Frias de Oliveira)',
        kind: 'ponto-morto',
        lat: -23.6114,
        lon: -46.6974,
        radiusM: 900,
        clue: 'Um mastro em X de 138 metros sustenta duas pistas curvas sobre o rio. É aqui que o carro-forte troca de motorista.',
        hint: 'Marginal Pinheiros, entre o Brooklin e o Morumbi.',
        intel:
          'Rastreador instalado no carro-forte. Destino: um estádio tricolor gigante.',
      },
      {
        id: 'morumbi',
        name: 'Estádio do Morumbi',
        kind: 'alvo',
        lat: -23.6,
        lon: -46.7202,
        radiusM: 1100,
        clue: 'O chefe CARCARÁ acha que vai sumir no meio de 66 mil torcedores do estádio tricolor. Ele está enganado.',
        hint: 'Morumbi, Praça Roberto Gomes Pedrosa.',
        intel: 'Chefe CARCARÁ preso no camarote. Carteiras cripto congeladas!',
      },
    ],
  },
  {
    id: 'casa-segura',
    codename: 'OPERAÇÃO CASA SEGURA',
    title: 'O Vazamento nas Casas Seguras',
    tagline: 'Jardins, Ibirapuera, Itaim e Morumbi',
    difficulty: 'Agente sênior',
    briefing:
      'A Agência mantém uma rede de casas seguras disfarçadas de imóveis de alto padrão da carteira Viegas. Uma delas foi comprometida e um agente infiltrado está vendendo nossas localizações. Visite cada casa segura, colete os fragmentos do código e descubra onde o infiltrado vai se encontrar com o contato.',
    targets: [
      {
        id: 'sh-jardins',
        name: 'Casa segura ALFA — Alameda Santos, Jardins',
        kind: 'casa-segura',
        lat: -23.5618,
        lon: -46.6625,
        radiusM: 800,
        clue: 'Casa segura ALFA: um apartamento numa alameda que leva o nome de uma cidade portuária, a uma quadra da avenida mais famosa de SP, no bairro que parece um jardim.',
        hint: 'Jardins, Alameda Santos, paralela à Av. Paulista.',
        intel:
          'Fragmento 1/4: "OLHO". O cofre foi aberto — por alguém com a chave.',
      },
      {
        id: 'sh-pinheiros',
        name: 'Casa segura BRAVO — Rua dos Pinheiros',
        kind: 'casa-segura',
        lat: -23.5675,
        lon: -46.6915,
        radiusM: 800,
        clue: 'Casa segura BRAVO: no bairro batizado pelas árvores que um dia cobriram a várzea, numa rua com o mesmo nome do bairro, perto da Faria Lima.',
        hint: 'Pinheiros, Rua dos Pinheiros.',
        intel:
          'Fragmento 2/4: "DE". Câmeras mostram o infiltrado correndo no parque.',
      },
      {
        id: 'ibirapuera',
        name: 'Parque Ibirapuera — Marquise',
        kind: 'informante',
        lat: -23.5874,
        lon: -46.6576,
        radiusM: 1300,
        clue: 'Encontro sob a marquise sinuosa do maior parque urbano da cidade, entre a Oca branca e o obelisco. Nosso informante faz cooper ali todo dia.',
        hint: 'Parque Ibirapuera, Vila Mariana / Moema.',
        intel:
          'O informante viu o infiltrado entrar num prédio na Vila Nova Conceição, logo ao lado do parque.',
      },
      {
        id: 'sh-vnc',
        name: 'Casa segura CHARLIE — Vila Nova Conceição',
        kind: 'casa-segura',
        lat: -23.5925,
        lon: -46.6685,
        radiusM: 800,
        clue: 'Casa segura CHARLIE: o metro quadrado mais caro do país, num bairro "novo" encostado no Ibirapuera, entre o Itaim e Moema.',
        hint: 'Vila Nova Conceição, perto da Praça Pereira Coutinho.',
        intel:
          'Fragmento 3/4: "DEUS". O infiltrado marcou o encontro final numa casa da Av. Giovanni Gronchi.',
      },
      {
        id: 'sh-morumbi',
        name: 'Casa segura DELTA — Av. Giovanni Gronchi, Morumbi',
        kind: 'alvo',
        lat: -23.6185,
        lon: -46.7205,
        radiusM: 1000,
        clue: 'Casa segura DELTA: uma mansão numa avenida com nome de presidente italiano, no bairro verde do estádio tricolor, do outro lado do rio. O infiltrado está lá dentro.',
        hint: 'Morumbi, Av. Giovanni Gronchi.',
        intel:
          'Fragmento 4/4: código "OLHO DE DEUS" completo. Infiltrado detido na casa DELTA!',
      },
    ],
  },
]);

/** Codinomes sugeridos para o agente. */
export const AGENT_CODENAMES = Object.freeze([
  'CORUJA',
  'JAGUATIRICA',
  'TUCANO',
  'ONÇA',
  'GAVIÃO',
  'LOBO-GUARÁ',
  'SUCURI',
  'BEM-TE-VI',
  'MICO-LEÃO',
  'TAMANDUÁ',
  'ARARA',
  'QUATI',
]);
