# Jogabilidade e IA — desenho

Data: 2026-11-19 · Branch: `claude/pacman-improvements-b8201c`
Cobre os itens 4, 6, 7, 8, 9 e 10 do `TODO2.TXT`, mais bugs encontrados na leitura do código.

## Problemas encontrados

| # | Problema | Onde |
|---|----------|------|
| B1 | Comer é feito duas vezes: `movePacman` → `checkAndEatPoint` zera a célula e ativa o power-up (15 frames, assusta até os "olhos"); o bloco de `updateGame` encontra a célula vazia, então pontos por nível, `powerUpsCollected` e reset do combo nunca rodam. | `pacman-movement.ts`, `game.ts` |
| B2 | Pac-Man renasce em `y = 7`, fora do grid (0–6). | `game.ts` `resetPacman` |
| B3 | Power-up não se renova se outro for comido com ele ativo; duração `30` fixa no código, `PACMAN_POWERUP_DURATION` (15) não é a usada no caminho que deveria valer. | `game.ts` |
| B4 | Estilo do jogador lido de `process.env.PLAYER_STYLE`, ignorando `config.playerStyle`; a Action fixa `'oportunista'` e descarta o `player_style`. | `pacman-movement.ts`, `github-action/src/index.js` |
| B5 | `Math.random()` em fantasmas: SVG muda a cada geração, impossível testar ou reproduzir. | `ghosts-movement.ts` |
| B6 | Fantasma comido que renasce durante o power-up sai assustado e pode ser comido de novo. | `game.ts`, `ghosts-movement.ts` |
| B7 | `console.log` em todo frame. | `pacman-movement.ts` |

## Parte 1 — Fundação

- **Uma regra de comer**, só em `game.ts`. `movePacman` apenas move.
- **`activatePowerUp`** único:
  - duração `PACMAN_POWERUP_DURATION = 30`;
  - renova o tempo se já ativo (combo mantido);
  - assusta só fantasmas fora da casa e que não são `eyes`.
- **Combo** 200 → 400 → 800 → 1600; zera quando o power-up acaba ou o Pac-Man morre.
- **Piscar**: nos últimos 6 frames os fantasmas assustados alternam visual (estado novo `flashing` no snapshot/renderer).
- **Correções**: renascimento em `(26, 5)` (logo abaixo da casa dos fantasmas, que ocupa x 25–27, y 2–3); estilo vindo de `store.config.playerStyle`; Action repassa `player_style`.
- **RNG com semente**: mulberry32 em `src/utils/rng.ts`, instância em `store.rng`. Semente padrão = hash de `username + data (AAAA-MM-DD)`; `config.seed` opcional sobrepõe.
- **Testes**: Vitest (`pnpm test`).

## Parte 2 — Túneis

- Linha 3: sair à esquerda da coluna 0 → coluna 52; à direita da 52 → coluna 0. Vale para Pac-Man, fantasmas e olhos.
- `MovementUtils.getNeighbors(x, y): Point2d[]` — vizinhos válidos já com wrap; substitui `getValidMoves` + `x + dx` nos chamadores.
- `MovementUtils.gridDistance(a, b)` — Manhattan considerando o atalho: `min(direto, via túnel)`.
- Fantasmas no túnel (colunas 0–1 e 51–52 da linha 3) movem 1 a cada 2 frames.
- Visual:
  - marca em cada boca do túnel; tokens de tema `tunnelColor` (cinza) e `tunnelActiveColor` (`#00FFFF`, nunca amarelo); ativa com Pac-Man a ≤ 3 casas;
  - salto sem deslizar: no frame do wrap, keyframes "sai meia célula para fora" → "aparece meia célula fora do lado oposto" no mesmo instante → "entra"; `clipPath` do tamanho do grid esconde o excedente.

## Parte 3 — Fantasmas assustados

- Invertem a direção no instante do power-up.
- Velocidade: 1 movimento a cada 2 frames (contador, não sorteio); no túnel, 1 a cada 4.
- Em cada cruzamento, cada saída exceto a reversa recebe nota = fuga (`gridDistance` ao Pac-Man após o passo) − penalidade de beco sem saída + ruído do `store.rng`; escolha por sorteio ponderado. Reverte só em beco.
- Fim do power-up: voltam ao modo scatter/chase em curso sem reiniciar o timer do modo.
- Fantasma comido renasce **perigoso** (B6).

## Parte 4 — IA do Pac-Man

- **A\***: custo do passo = `1 + perigo × pesoSegurança + revisita`; heurística = `gridDistance` (admissível, custo ≥ 1). Recompensas ficam fora do custo. Replaneja a cada frame. Fila com heap binário.
- **Alvo**: BFS de distância real a partir do Pac-Man; nota = `valor / passos` + bônus por vizinhas com pontos. Valor do power-up por estilo:
  - agressivo: alto com fantasma perigoso a ≤ 8 passos (antes "sempre": gastava o power-up com fantasmas ainda na casa e comia menos fantasmas que o oportunista);
  - oportunista: alto com fantasma perigoso a ≤ 5 passos;
  - conservador: só com fantasma perigoso a ≤ 3 passos (emergência).
- **Perigo previsto**: BFS a partir de cada fantasma perigoso até horizonte por estilo (conservador 4, oportunista 3, agressivo 1); casa à frente da direção do fantasma pesa mais; fantasma piscando conta como 0,5.
- **Pesos dinâmicos**: segurança sobe com fantasma próximo e cai durante power-up; pontos sobem quando restam poucas células. Bases = pesos atuais de cada estilo.
- **Revisita com decaimento**: `Map<célula, frame>`; penalidade `50 × max(0, 1 − idade/50)`.
- **Limpeza**: logs atrás de `config.debug`; remover `pacman-movement-backup.ts`.

## Testes (Vitest, semente fixa)

- Comer pontua por nível; power-up conta, renova e mantém combo; combo zera ao fim/morte.
- Renascimento dentro do grid.
- Vizinhos com/sem túnel; `gridDistance` usa atalho; renderer não gera keyframe no meio do mapa no wrap.
- Fantasma no túnel leva 2 frames por casa; assustado anda em frames alternados, não reverte em corredor, reverte ao assustar, se afasta mais que um passeio aleatório em 20 frames; renasce perigoso.
- A\* contorna paredes e usa túnel quando mais curto; conservador desvia de fantasma adjacente, agressivo não; revisita decai a zero.
- Partida completa termina dentro de um limite de frames para os 3 estilos (estatísticas impressas, sem asserção comparativa).

## Fora do escopo

Novos temas, placar no SVG, velocidade configurável, preview local, ESLint/CI — ficam para outra rodada.
