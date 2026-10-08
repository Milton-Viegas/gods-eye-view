# 🕵️ Modo Espião (Operação Olho de Deus)

Um jogo de espionagem jogável direto no globo 3D. Ao abrir o app, o briefing **Operação Olho de Deus** aparece; escolha um codinome, o modo, o nível e uma missão e clique em **Iniciar missão**. O console normal continua a um clique (**Ir para o console normal**) e o botão **MODO ESPIÃO** reabre o jogo a qualquer momento.

- **Objetivo:** cada missão tem 5 alvos (pontos mortos, informantes, casas seguras) em lugares reais de São Paulo. Leia a pista criptografada, voe pelo globo e **clique no local** do alvo.
- **Quente/frio:** errou? O termômetro mostra _Fervendo, Quente, Morno, Frio_ ou _Congelando_ e a distância (ex.: "Frio — 4,2 km").
- **Pontuação:** cada acerto vale `(500 + bônus de tempo de até 500) × multiplicador do nível`. Erros e dicas descontam pontos; **Revelar** pula o alvo sem pontuar.

## Níveis e campanha

| Nível | Nome            | Raio de acerto\* | Bônus zera em | Erro | Dicas (H)                       | Pistas    | Multiplicador |
| ----- | --------------- | ---------------- | ------------- | ---- | ------------------------------- | --------- | ------------- |
| 1     | Recruta         | 900–2.000 m      | 3 min         | −25  | −50 texto / −100 triangulação   | completas | ×1            |
| 2     | Agente de Campo | 600–1.400 m      | 2,5 min       | −50  | −100 / −200                     | completas | ×1,25         |
| 3     | Agente Sênior   | 450–1.000 m      | 2 min         | −75  | −150 / −300                     | completas | ×1,5          |
| 4     | Agente Especial | 300–700 m        | 90 s          | −100 | só −250 (texto, sem satélite)   | vagas     | ×2            |
| 5     | Agente Fantasma | 200–500 m        | 60 s          | −150 | nenhuma                         | vagas     | ×3            |

\* raio = raio-base do alvo × (1,5 · 1 · 0,75 · 0,5 · 0,35), limitado à faixa do nível — estádios e parques continuam um pouco mais generosos que um prédio.

- **Campanha:** cada missão é jogada no seu nível. Comece no Nível 1; concluir uma missão do nível atual com **≥ 40% da pontuação máxima** libera o próximo (progresso salvo em `localStorage`, chave `gev:spy-game:progress:v1`).
- **Treino livre:** qualquer missão em qualquer nível (vale para o ranking, mas não libera níveis).

## Missões

| Nível | Operação                 | Alvos |
| ----- | ------------------------ | ----- |
| 1 | **Garoa** — O Traidor do Centro | MASP, Copan, Estação da Luz, Mercadão, Catedral da Sé |
| 1 | **Sol Nascente** — A Partitura Roubada | Theatro Municipal, Pateo do Collegio, Praça da Liberdade, Igreja Achiropita (Bixiga), Japan House |
| 2 | **Carcará** — Dinheiro Sujo na Faria Lima | Largo da Batata, Beco do Batman, Jockey Club, Ponte Estaiada, Estádio do Morumbi |
| 2 | **Asas de Aço** — Fuga pelos Céus | Farol Santander, Edifício Itália, Campo de Marte, Neo Química Arena, Congonhas |
| 3 | **Casa Segura** — O Vazamento nas Casas Seguras | Alameda Santos, Rua dos Pinheiros, Ibirapuera, Vila Nova Conceição, Av. Giovanni Gronchi |
| 3 | **Independência** — O Grito Interceptado | Museu do Ipiranga, Oca do Ibirapuera, Jardim Botânico, Zoológico, Autódromo de Interlagos |
| 4 | **Jaraguá** — O Sinal do Pico | Nubank Parque (ex-Allianz), Memorial da América Latina, Praça do Relógio (USP), Parque Villa-Lobos, Pico do Jaraguá |
| 5 | **Fantasma** — O Agente que Não Existe | Edifício Martinelli, Sala São Paulo, Pacaembu, Catedral Ortodoxa, Sambódromo do Anhembi |

Coordenadas conferidas com OpenStreetMap/Wikipedia (todas a menos de 200 m do local real).

## Ranking Global

Ao fim de cada missão o debriefing envia a pontuação automaticamente e mostra sua posição; a aba **RANKING GLOBAL** do briefing lista o top 20 por missão e nível. Sem conexão (ou rodando com `npm run dev`, que não tem a função), o jogo segue normal com o recorde local.

Backend: Vercel Function em [`api/spy-leaderboard.js`](../../../api/spy-leaderboard.js).

- `GET /api/spy-leaderboard?mission=<id|all>&tier=<1-5|all>&limit=20` → `{ok, storage, total, entries:[{position, codename, missionId, missionCodename, tier, score, durationMs, targetsHit, at}]}`
- `POST /api/spy-leaderboard {"action":"start","missionId","tier"}` → `{runId}` (token HMAC emitido no início da missão)
- `POST /api/spy-leaderboard {codename, missionId, tier, score, durationMs, targetsHit, runId}` → `{rank, total, personalBest}`

Armazenamento: **Vercel Blob** quando o projeto tem um Blob store conectado (`BLOB_STORE_ID`/OIDC ou `BLOB_READ_WRITE_TOKEN`); senão o **Vercel Runtime Cache** (nativo, sem provisionamento, mas regional e sujeito a despejo); em dev, memória. A resposta do GET informa qual está ativo (`storage`).

Anti-trapaça (leve): codinome saneado (sem HTML, máx. 20 caracteres, filtro de palavrões); `runId` assinado (HMAC com `SPY_LEADERBOARD_SECRET`) amarrado a missão e nível, válido por 6 h e de uso único; a duração declarada não pode passar do tempo real desde o início; duração mínima humana; teto de pontuação calculado a partir de alvos, nível e duração; limite de taxa por IP. Codinomes que começam com `TESTE-QA` são aceitos mas ficam fora do ranking público e expiram em 1 h.

## Testes e automação

- `npm test` inclui `engine.test.mjs` (motor, níveis, integridade das missões), `leaderboard.test.mjs` (regras, tokens, quadro, cliente) e `leaderboardApi.test.mjs` (a função serverless com armazenamento em memória).
- **URL:** `?spy=1` força o briefing; `?spy=0` não abre automaticamente; `?spytest=1` liga os ganchos de QA em `window.gevSpyGame` (`start`, `guess(lat, lon)`, `hint`, `reveal`, `state`) e **desliga o envio ao ranking**. Em produção, sem `?spytest=1`, esses ganchos não existem.

## Arquivos

- `missions.js` — missões, pistas (normal e vaga), dicas e coordenadas reais (dados puros).
- `difficulty.js` — os 5 níveis, raio efetivo, pontuação máxima, validação anti-trapaça e progresso da campanha.
- `engine.js` — distância, termômetro, pontuação por nível, máquina de estados e recorde local.
- `leaderboardCore.js` — regras do Ranking Global (codinome, tokens, quadro) compartilhadas com a função serverless.
- `leaderboardClient.js` — chamadas a `/api/spy-leaderboard` com tolerância a falhas.
- `hud.js` — interface DOM em pt-BR: briefing com abas, níveis, ranking, painel da missão e debriefing.
- `index.js` — liga tudo ao `Cesium.Viewer`: clique → lat/lon, voos de câmera, marcadores.
- `spy.css` — visual de terminal (verde fósforo/âmbar).
