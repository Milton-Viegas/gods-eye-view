# 🕵️ Modo Espião (Operação Olho de Deus)

Um jogo de espionagem jogável direto no globo 3D — sem chave de API, sem backend. Ao abrir o app, o briefing **Operação Olho de Deus** aparece; escolha um codinome e uma missão e clique em **Iniciar missão**. O console normal continua a um clique (**Ir para o console normal**) e o botão **MODO ESPIÃO** reabre o jogo a qualquer momento.

- **Objetivo:** cada missão tem 5 alvos (pontos mortos, informantes, casas seguras) em lugares reais de São Paulo. Leia a pista criptografada, voe pelo globo e **clique no local** do alvo.
- **Quente/frio:** errou? O termômetro mostra *Fervendo, Quente, Morno, Frio* ou *Congelando* e a distância (ex.: "Frio — 4,2 km"). Cada erro custa 50 pontos.
- **Pontuação:** 500 pontos por alvo + bônus de tempo de até 500 (zera em 2 minutos). **H** = dica (−100 na primeira, −200 na triangulação por satélite, que aproxima a câmera). **Revelar** pula o alvo sem pontuar.
- **Missões:** *Operação Garoa* (Centro e Paulista: MASP, Copan, Luz, Mercadão, Sé), *Operação Carcará* (Zona Oeste: Largo da Batata, Beco do Batman, Jockey, Ponte Estaiada, Morumbi) e *Operação Casa Segura* (casas seguras da carteira Viegas: Jardins, Pinheiros, Ibirapuera, Vila Nova Conceição, Morumbi). Ou deixe a central sortear.
- **Debriefing:** pontuação final, patente e recorde salvo no navegador (`localStorage`). **Jogar novamente** volta ao briefing.
- **URL:** `?spy=1` força o briefing; `?spy=0` não abre automaticamente. Código nesta pasta.

## Arquivos

- `missions.js` — missões, pistas, dicas e coordenadas reais (dados puros).
- `engine.js` — distância, termômetro quente/frio, pontuação, máquina de estados e recorde (sem Cesium/DOM; testado em `engine.test.mjs`).
- `hud.js` — interface DOM em pt-BR: briefing, painel da missão, registro de pistas, debriefing.
- `index.js` — liga tudo ao `Cesium.Viewer`: clique → lat/lon, voos de câmera, marcadores com anel de varredura.
- `spy.css` — visual de terminal (verde fósforo/âmbar).

O jogo é carregado sob demanda por `src/main.js` depois que o console fica pronto; uma falha no jogo nunca derruba o console. Funciona no globo sem chave (imagens Esri) e também sobre os Google Photorealistic 3D Tiles.
