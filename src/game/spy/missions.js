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
 * @property {string} clueHard Pista vaga usada nos níveis 4 e 5.
 * @property {string} hint Dica (custa pontos).
 * @property {string} intel Texto de inteligência revelado ao acertar.
 */

export const TARGET_KIND_LABELS = Object.freeze({
  'ponto-morto': 'PONTO MORTO',
  informante: 'INFORMANTE',
  'casa-segura': 'CASA SEGURA',
  alvo: 'ALVO PRINCIPAL',
});

/**
 * `tier` é o nível da campanha em que a missão aparece (1 = Recruta …
 * 5 = Agente Fantasma; ver difficulty.js). No Treino livre qualquer missão
 * pode ser jogada em qualquer nível.
 * @type {ReadonlyArray<{id:string,codename:string,title:string,tagline:string,tier:number,briefing:string,targets:SpyTarget[]}>}
 */
export const SPY_MISSIONS = Object.freeze([
  {
    id: 'garoa',
    codename: 'OPERAÇÃO GAROA',
    title: 'O Traidor do Centro',
    tagline: 'Centro histórico e Av. Paulista',
    tier: 1,
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
        clueHard:
          'Arte suspensa no ar sobre um vazio enorme, no espigão mais alto da cidade. O primeiro microfilme está na sombra.',
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
        clueHard:
          'Uma onda deitada de concreto, a maior do seu tipo no país. O informante mora num dos seus mais de mil números.',
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
        clueHard:
          'Relógio inglês, tijolo aparente e apitos há mais de um século. Ao lado, um jardim velho como o Império.',
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
        clueHard:
          'Vitrais, frutas exóticas e um sanduíche que desafia a gravidade, perto de um rio que ninguém mais vê.',
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
        clueHard:
          'O ponto de onde todas as distâncias do estado são medidas. Torres pontudas vigiam o traidor.',
        hint: 'Praça da Sé, Centro.',
        intel:
          'SABIÁ capturado nas escadarias da catedral. Lista de informantes recuperada!',
      },
    ],
  },
  {
    id: 'sol-nascente',
    codename: 'OPERAÇÃO SOL NASCENTE',
    title: 'A Partitura Roubada',
    tagline: 'Centro velho, Liberdade e Bixiga',
    tier: 1,
    briefing:
      'Uma partitura cifrada com as frequências de rádio da Agência sumiu de um cofre do Theatro Municipal. O ladrão, conhecido apenas como KABUKI, está atravessando o Centro velho rumo ao bairro oriental. Siga o rastro de pistas entre teatros, igrejas e lanternas vermelhas antes que a partitura seja transmitida.',
    targets: [
      {
        id: 'theatro-municipal',
        name: 'Theatro Municipal de São Paulo',
        kind: 'ponto-morto',
        lat: -23.5453,
        lon: -46.6386,
        radiusM: 700,
        clue: 'Uma ópera de pedra inspirada no Palais Garnier, palco da Semana de Arte Moderna de 1922. O cofre arrombado fica atrás das cortinas, de frente para o Viaduto do Chá.',
        clueHard:
          'Cem anos atrás, artistas modernos vaiados subiram neste palco. Hoje o cofre dele está vazio.',
        hint: 'Praça Ramos de Azevedo, junto ao Vale do Anhangabaú.',
        intel:
          'O cofre foi aberto com uma chave antiga. Pegadas de barro levam ao lugar onde a cidade nasceu.',
      },
      {
        id: 'pateo-collegio',
        name: 'Pateo do Collegio',
        kind: 'informante',
        lat: -23.5481,
        lon: -46.6328,
        radiusM: 700,
        clue: 'Em 1554, padres jesuítas fincaram aqui um colégio de taipa — e São Paulo nasceu. Nosso informante finge ser guia no museu da fundação.',
        clueHard:
          'O lugar exato onde a cidade nasceu, em taipa e catequese, quase quinhentos anos atrás.',
        hint: 'Centro histórico, entre a Praça da Sé e a Rua Boa Vista.',
        intel:
          'O guia confirma: KABUKI comprou um bilhete de metrô para a estação com um tori vermelho na saída.',
      },
      {
        id: 'liberdade',
        name: 'Praça da Liberdade',
        kind: 'ponto-morto',
        lat: -23.555,
        lon: -46.6355,
        radiusM: 700,
        clue: 'Lanternas suzuranto iluminam a rua, a feira de domingo vende guioza e um portal vermelho anuncia o maior bairro japonês fora do Japão. A partitura foi copiada numa barraca da praça.',
        clueHard:
          'Lanternas vermelhas, feira de domingo e o maior bairro de imigrantes do Sol Nascente fora de casa.',
        hint: 'Saída da estação Japão-Liberdade (Linha 1-Azul).',
        intel:
          'Cópia da partitura apreendida. A original seguiu para uma igreja de cantina italiana, bairro acima.',
      },
      {
        id: 'achiropita',
        name: 'Igreja Nossa Senhora Achiropita — Bixiga',
        kind: 'informante',
        lat: -23.5574,
        lon: -46.6468,
        radiusM: 700,
        clue: 'No bairro das cantinas e cortiços italianos, uma santa calabresa ganha festa de rua todo agosto, com fogazza e macarronada. O padre ouviu a confissão de KABUKI.',
        clueHard:
          'Uma festa de agosto com cheiro de molho de tomate, em honra de uma santa trazida da Calábria.',
        hint: 'Bela Vista (Bixiga), Rua Treze de Maio.',
        intel:
          'O padre revela: KABUKI vai entregar a partitura numa casa de cultura japonesa na avenida mais famosa da cidade.',
      },
      {
        id: 'japan-house',
        name: 'Japan House São Paulo — Av. Paulista',
        kind: 'alvo',
        lat: -23.5707,
        lon: -46.6445,
        radiusM: 750,
        clue: 'Uma fachada de ripas de hinoki desenhada por Kengo Kuma, no começo da Avenida Paulista, perto do Paraíso. KABUKI espera o comprador na loja do térreo.',
        clueHard:
          'Madeira japonesa trançada como um cesto gigante, na ponta da avenida que fica mais perto do Paraíso.',
        hint: 'Av. Paulista, 52, perto da Praça Oswaldo Cruz.',
        intel:
          'KABUKI rendido entre as ripas de hinoki. Partitura recuperada intacta!',
      },
    ],
  },
  {
    id: 'faria-lima',
    codename: 'OPERAÇÃO CARCARÁ',
    title: 'Dinheiro Sujo na Faria Lima',
    tagline: 'Zona Oeste e Marginal Pinheiros',
    tier: 2,
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
        clueHard:
          'Um tubérculo batiza a praça onde a linha amarela respira. Siga a pasta prateada.',
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
        clueHard:
          'Uma viela onde nenhuma parede ficou cinza. O morcego guarda o pen-drive.',
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
        clueHard:
          'Ferraduras batem na terra ao lado do rio, sob uma tribuna dos anos 40.',
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
        clueHard:
          'Cabos em leque e um X gigante sobre águas escuras. Troca de motorista à meia-noite.',
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
        clueHard:
          'Um colosso de concreto tricolor na colina mais rica do outro lado do rio.',
        hint: 'Morumbi, Praça Roberto Gomes Pedrosa.',
        intel: 'Chefe CARCARÁ preso no camarote. Carteiras cripto congeladas!',
      },
    ],
  },
  {
    id: 'asas-de-aco',
    codename: 'OPERAÇÃO ASAS DE AÇO',
    title: 'Fuga pelos Céus',
    tagline: 'Arranha-céus, aeroportos e a arena da Zona Leste',
    tier: 2,
    briefing:
      'O traficante de armas CONDOR planeja fugir de São Paulo com um protótipo de drone militar. Ele usa os arranha-céus como torres de observação e os aeroportos como rota de fuga. Rastreie cada posto de vigia, siga o helicóptero e intercepte CONDOR antes da decolagem.',
    targets: [
      {
        id: 'farol-santander',
        name: 'Farol Santander (Edifício Altino Arantes)',
        kind: 'ponto-morto',
        lat: -23.5458,
        lon: -46.6341,
        radiusM: 700,
        clue: 'Primo paulistano do Empire State, este antigo banco art déco foi o prédio mais alto da cidade por anos. No mirante do 26º andar, CONDOR deixou uma câmera apontada para o céu.',
        clueHard:
          'Um banco art déco que imita Nova York, coroado por um farol no Triângulo Histórico.',
        hint: 'Rua João Brícola, perto da Rua XV de Novembro, Centro.',
        intel:
          'A câmera filmava o prédio mais alto do Centro, aquele com restaurante no topo.',
      },
      {
        id: 'edificio-italia',
        name: 'Edifício Itália (Terraço Itália)',
        kind: 'informante',
        lat: -23.5456,
        lon: -46.6436,
        radiusM: 700,
        clue: 'Quarenta e seis andares e um restaurante panorâmico no topo, na esquina da Ipiranga com a São Luís. Nosso informante é garçom no terraço.',
        clueHard:
          'Um gigante de 165 metros com nome de país europeu e jantar no último andar.',
        hint: 'Av. Ipiranga com Av. São Luís, ao lado da Praça da República.',
        intel:
          'O garçom ouviu CONDOR reservar um helicóptero num velho aeródromo da Zona Norte.',
      },
      {
        id: 'campo-de-marte',
        name: 'Aeroporto Campo de Marte',
        kind: 'ponto-morto',
        lat: -23.5094,
        lon: -46.6393,
        radiusM: 1100,
        clue: 'Batizado com o nome do deus da guerra, este aeródromo às margens do Tietê é a casa dos helicópteros da cidade. O protótipo foi escondido num hangar.',
        clueHard:
          'Um aeródromo com nome de deus da guerra, colado no rio que corta a Zona Norte.',
        hint: 'Santana, Av. Santos Dumont, ao norte da Marginal Tietê.',
        intel:
          'Hangar vazio. O helicóptero voou para leste, rumo a uma arena alvinegra.',
      },
      {
        id: 'neo-quimica-arena',
        name: 'Neo Química Arena (Itaquera)',
        kind: 'informante',
        lat: -23.5454,
        lon: -46.4743,
        radiusM: 1000,
        clue: 'Estádio da abertura da Copa de 2014, casa do time alvinegro mais popular de São Paulo, no extremo leste. O piloto pousou no estacionamento.',
        clueHard:
          'Onde a Copa do Mundo de 2014 começou, bem longe do Centro, no lado em que o sol nasce.',
        hint: 'Itaquera, Zona Leste, perto da estação Corinthians-Itaquera.',
        intel:
          'O piloto confessou: CONDOR vai embarcar num jatinho no aeroporto dentro da cidade, ao sul.',
      },
      {
        id: 'congonhas',
        name: 'Aeroporto de Congonhas',
        kind: 'alvo',
        lat: -23.6261,
        lon: -46.6564,
        radiusM: 1300,
        clue: 'Uma pista curta cercada de prédios, a ponte aérea para o Rio e aviões passando rente aos telhados de Moema e do Campo Belo. CONDOR está no saguão, de bilhete na mão.',
        clueHard:
          'Aviões descem entre prédios residenciais na zona sul; a ponte aérea parte daqui.',
        hint: 'Campo Belo / Vila Congonhas, Av. Washington Luís.',
        intel:
          'CONDOR detido no portão de embarque. Protótipo de drone apreendido!',
      },
    ],
  },
  {
    id: 'casa-segura',
    codename: 'OPERAÇÃO CASA SEGURA',
    title: 'O Vazamento nas Casas Seguras',
    tagline: 'Jardins, Ibirapuera, Itaim e Morumbi',
    tier: 3,
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
        clueHard:
          'ALFA: uma alameda batizada por um porto, a uma quadra do espigão.',
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
        clueHard:
          'BRAVO: rua e bairro dividem o nome de árvores que já não estão lá.',
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
        clueHard:
          'Uma marquise que serpenteia entre a cúpula branca e o obelisco. O informante corre ali.',
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
        clueHard:
          'CHARLIE: o metro quadrado mais disputado do país, colado no grande parque.',
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
        clueHard:
          'DELTA: uma avenida com nome de presidente estrangeiro, subindo a colina das mansões.',
        hint: 'Morumbi, Av. Giovanni Gronchi.',
        intel:
          'Fragmento 4/4: código "OLHO DE DEUS" completo. Infiltrado detido na casa DELTA!',
      },
    ],
  },
  {
    id: 'independencia',
    codename: 'OPERAÇÃO INDEPENDÊNCIA',
    title: 'O Grito Interceptado',
    tagline: 'Zona Sul: Ipiranga, Ibirapuera, Parque do Estado e Interlagos',
    tier: 3,
    briefing:
      'A célula IPÊ-ROXO pretende sabotar o sistema de energia da Zona Sul durante o Grande Prêmio. As mensagens trocadas citam lugares históricos ligados à Independência e às matas do Parque do Estado. Decifre cada ponto de encontro, colete as peças do detonador e chegue ao autódromo antes da largada.',
    targets: [
      {
        id: 'museu-ipiranga',
        name: 'Museu do Ipiranga (Museu Paulista)',
        kind: 'ponto-morto',
        lat: -23.5856,
        lon: -46.6097,
        radiusM: 900,
        clue: 'Às margens do riacho onde Dom Pedro teria gritado "Independência ou Morte", um palácio eclético guarda o quadro de Pedro Américo. A primeira peça está nos jardins franceses.',
        clueHard:
          'Um palácio-museu de frente para um jardim em leque, à beira do riacho do grito de 1822.',
        hint: 'Parque da Independência, bairro do Ipiranga.',
        intel:
          'Peça 1/3 do detonador recuperada. Um bilhete fala em "cúpula branca no parque grande".',
      },
      {
        id: 'oca-ibirapuera',
        name: 'Oca — Parque Ibirapuera',
        kind: 'informante',
        lat: -23.5869,
        lon: -46.6554,
        radiusM: 800,
        clue: 'Uma cúpula branca de Niemeyer, sem janelas, pousada como um disco voador no gramado do parque mais famoso da cidade. O informante monta uma exposição lá dentro.',
        clueHard:
          'Um disco voador branco de concreto, sem janelas, pousado no gramado de 1954.',
        hint: 'Parque Ibirapuera, perto do Portão 3 e da marquise.',
        intel:
          'O informante viu IPÊ-ROXO comprando mudas raras num jardim de estufas e orquídeas, mais ao sul.',
      },
      {
        id: 'jardim-botanico',
        name: 'Jardim Botânico de São Paulo',
        kind: 'ponto-morto',
        lat: -23.6415,
        lon: -46.6257,
        radiusM: 1000,
        clue: 'Estufas de vidro, um lago de vitórias-régias e trilhas na nascente do riacho do Ipiranga, dentro do Parque do Estado. A segunda peça está enterrada num canteiro.',
        clueHard:
          'Estufas de vidro escondidas na mata onde nasce o riacho do grito.',
        hint: 'Parque Estadual das Fontes do Ipiranga, Água Funda.',
        intel:
          'Peça 2/3 recuperada. Rastros de patas grandes levam ao vizinho de muro: um lar de mais de mil animais.',
      },
      {
        id: 'zoologico',
        name: 'Zoológico de São Paulo',
        kind: 'informante',
        lat: -23.6527,
        lon: -46.6164,
        radiusM: 1000,
        clue: 'Girafas, leões e um lago cheio de aves migratórias no maior zoológico do país. Nosso tratador de elefantes tem notícias de IPÊ-ROXO.',
        clueHard:
          'Mais de mil bichos vizinhos das estufas, no mesmo pedaço de Mata Atlântica.',
        hint: 'Av. Miguel Stéfano, Parque do Estado (Água Funda).',
        intel:
          'O tratador conta: IPÊ-ROXO comprou credencial de mecânico para a corrida de amanhã.',
      },
      {
        id: 'interlagos',
        name: 'Autódromo de Interlagos (José Carlos Pace)',
        kind: 'alvo',
        lat: -23.7018,
        lon: -46.6969,
        radiusM: 1300,
        clue: 'Um circuito que corre no sentido anti-horário entre duas represas, palco das vitórias de Senna e do S do Senna. IPÊ-ROXO está nos boxes com a terceira peça.',
        clueHard:
          'Motores rugindo entre duas represas, numa curva em S que leva o nome de um tricampeão.',
        hint: 'Interlagos, entre as represas Guarapiranga e Billings.',
        intel:
          'IPÊ-ROXO detido no pit lane. Detonador desmontado antes da largada!',
      },
    ],
  },
  {
    id: 'jaragua',
    codename: 'OPERAÇÃO JARAGUÁ',
    title: 'O Sinal do Pico',
    tagline: 'Zona Oeste e Noroeste: arenas, USP e o ponto mais alto da cidade',
    tier: 4,
    briefing:
      'Um transmissor clandestino está sequestrando as torres de TV do ponto mais alto da cidade para vazar documentos da Agência. A operadora RÁDIO-PIRATA usa estádios, campi e parques da Zona Oeste para trocar cartões de memória. As pistas deste nível são vagas: confie no seu conhecimento da cidade.',
    targets: [
      {
        id: 'nubank-parque',
        name: 'Nubank Parque (ex-Allianz Parque)',
        kind: 'informante',
        lat: -23.5275,
        lon: -46.6785,
        radiusM: 800,
        clue: 'A arena alviverde da Pompeia, palco de títulos e megashows, trocou de nome em 2026 — agora leva o de um banco roxo. Nosso informante trabalha na bilheteria.',
        clueHard:
          'Gramado verde, nome roxo novo e o velho Palestra Itália no mesmo endereço.',
        hint: 'Rua Palestra Itália, Perdizes/Pompeia.',
        intel:
          'O informante recebeu um cartão de memória para entregar perto de uma mão gigante de concreto.',
      },
      {
        id: 'memorial-america-latina',
        name: 'Memorial da América Latina',
        kind: 'ponto-morto',
        lat: -23.5272,
        lon: -46.664,
        radiusM: 800,
        clue: 'Niemeyer desenhou uma esplanada de concreto com uma mão aberta sangrando o mapa do continente. O cartão está sob a escultura, ao lado da estação Barra Funda.',
        clueHard:
          'Uma mão de concreto sangra um continente inteiro, ao lado dos trilhos.',
        hint: 'Barra Funda, Av. Auro Soares de Moura Andrade.',
        intel:
          'Cartão de memória 1/2 recuperado. Ele contém a planta de uma torre com relógio numa universidade.',
      },
      {
        id: 'usp-relogio',
        name: 'Praça do Relógio — Cidade Universitária (USP)',
        kind: 'ponto-morto',
        lat: -23.5596,
        lon: -46.7241,
        radiusM: 900,
        clue: 'Na maior universidade do país, uma torre de 50 metros com relógio marca o centro do campus do Butantã. O cartão foi colado sob um banco da praça.',
        clueHard:
          'Uma torre marca as horas no meio de um campus gigante do outro lado do rio.',
        hint: 'Cidade Universitária, Butantã, Av. Prof. Luciano Gualberto.',
        intel:
          'Cartão 2/2 recuperado. RÁDIO-PIRATA treina ciclismo num parque às margens do Pinheiros.',
      },
      {
        id: 'villa-lobos',
        name: 'Parque Villa-Lobos',
        kind: 'informante',
        lat: -23.5463,
        lon: -46.7237,
        radiusM: 1000,
        clue: 'Um parque que leva o nome de um maestro, com ciclovia, orquidário e um anfiteatro de concertos, construído sobre um antigo aterro na beira do rio. Nosso ciclista disfarçado espera lá.',
        clueHard:
          'Um maestro dá nome ao verde que nasceu de um aterro à beira do rio.',
        hint: 'Alto de Pinheiros, Av. Professor Fonseca Rodrigues.',
        intel:
          'O ciclista seguiu RÁDIO-PIRATA até a estrada que sobe ao pico com antenas de TV.',
      },
      {
        id: 'pico-jaragua',
        name: 'Pico do Jaraguá',
        kind: 'alvo',
        lat: -23.457,
        lon: -46.7665,
        radiusM: 1200,
        clue: 'O ponto mais alto da cidade, a 1.135 metros, coroado por torres de TV e cercado por terra indígena guarani. O transmissor pirata está no topo.',
        clueHard: 'O teto da cidade, eriçado de antenas, a noroeste de tudo.',
        hint: 'Parque Estadual do Jaraguá, Zona Noroeste, perto da Rodovia Anhanguera.',
        intel:
          'Transmissor desligado e RÁDIO-PIRATA capturada no mirante. Vazamento contido!',
      },
    ],
  },
  {
    id: 'fantasma',
    codename: 'OPERAÇÃO FANTASMA',
    title: 'O Agente que Não Existe',
    tagline: 'Alvos pequenos espalhados pela cidade — só para veteranos',
    tier: 5,
    briefing:
      'Codinome ESPECTRO: um agente que não aparece em nenhuma câmera e muda de identidade a cada encontro. Ele vai entregar o arquivo mestre da Agência no meio do carnaval. Os alvos são pequenos, o raio de acerto é mínimo e não há dicas. Nível 5 — boa sorte, Agente Fantasma.',
    targets: [
      {
        id: 'martinelli',
        name: 'Edifício Martinelli',
        kind: 'ponto-morto',
        lat: -23.5455,
        lon: -46.6352,
        radiusM: 600,
        clue: 'O primeiro arranha-céu da cidade, erguido nos anos 1920 por um imigrante italiano que morou na cobertura para provar que o prédio não cairia. ESPECTRO deixou o primeiro sinal na mansão do topo.',
        clueHard:
          'O avô dos arranha-céus paulistanos, cor-de-rosa, cujo dono morou no topo para provar que ele não cairia.',
        hint: 'Av. São João com a Rua Líbero Badaró, Centro.',
        intel: 'Sinal decodificado: "onde trens viraram sinfonia".',
      },
      {
        id: 'sala-sao-paulo',
        name: 'Sala São Paulo (Estação Júlio Prestes)',
        kind: 'informante',
        lat: -23.5342,
        lon: -46.6398,
        radiusM: 650,
        clue: 'Uma antiga estação ferroviária do café virou a casa da Osesp, com um teto móvel que ajusta a acústica. Nosso violinista viu ESPECTRO no saguão.',
        clueHard: 'Onde trens viraram sinfonia.',
        hint: 'Praça Júlio Prestes, Campos Elísios.',
        intel:
          'O violinista ouviu ESPECTRO marcar encontro num estádio art déco com nome de charmoso bairro.',
      },
      {
        id: 'pacaembu',
        name: 'Estádio do Pacaembu (Mercado Livre Arena Pacaembu)',
        kind: 'ponto-morto',
        lat: -23.5486,
        lon: -46.6654,
        radiusM: 800,
        clue: 'Estádio municipal de 1940, encaixado num vale, com o Museu do Futebol sob as arquibancadas e a Praça Charles Miller na porta. O arquivo trocou de mãos no portão principal.',
        clueHard:
          'Um vale vira arquibancada; um museu de bola mora embaixo dela.',
        hint: 'Praça Charles Miller, Pacaembu.',
        intel:
          'Rastro de incenso: ESPECTRO foi se esconder sob cúpulas bizantinas na Rua Vergueiro.',
      },
      {
        id: 'catedral-ortodoxa',
        name: 'Catedral Metropolitana Ortodoxa',
        kind: 'informante',
        lat: -23.5756,
        lon: -46.6402,
        radiusM: 600,
        clue: 'Cúpulas inspiradas em Santa Sofia de Istambul, ícones dourados e missas em árabe, no bairro do Paraíso. O sacristão é nosso.',
        clueHard: 'Istambul em miniatura, no Paraíso.',
        hint: 'Rua Vergueiro, Paraíso, perto da estação Paraíso.',
        intel:
          'O sacristão revela: ESPECTRO vai sumir entre plumas e paetês, na passarela das escolas de samba.',
      },
      {
        id: 'sambodromo',
        name: 'Sambódromo do Anhembi',
        kind: 'alvo',
        lat: -23.5165,
        lon: -46.6452,
        radiusM: 900,
        clue: 'Uma passarela de 530 metros projetada por Niemeyer onde as escolas de samba desfilam em fevereiro, ao lado do Tietê. ESPECTRO está fantasiado no meio da bateria.',
        clueHard: 'Plumas, paetês e uma bateria inteira, à beira do rio.',
        hint: 'Complexo do Anhembi, Santana, ao lado da Marginal Tietê.',
        intel:
          'ESPECTRO desmascarado na dispersão. Arquivo mestre recuperado — você é uma lenda!',
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
