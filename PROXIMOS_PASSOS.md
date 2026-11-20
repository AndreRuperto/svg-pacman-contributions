# Próximos passos

- **Data:** 2026-11-20
- **Branch:** `claude/lint-e-revisao` (base: `main`). Rodada 1 no PR #2 e rodada 2 no PR #3, ambas mergeadas
- **Plano:** `docs/plans/2026-11-19-jogabilidade.md` · **Desenho:** `docs/plans/2026-11-19-jogabilidade-design.md`

## O que foi feito nesta sessão (Tasks 0–12 do plano)

- **0. Vitest** instalado e configurado (`pnpm test`).
- **1. RNG com semente** (mulberry32): semente padrão = `usuário:AAAA-MM-DD` (UTC), sobreposta por `config.seed`.
- **2. Estado do jogo no store**: `frame`, combo e modo dos fantasmas saíram de variáveis de módulo para `store.game`; `Game.step(store)` testável quadro a quadro.
- **3. Regras de comer**: cada célula é comida uma vez; power-up renova a duração; combo 200 → 400 → 800 → 1600; colisão por troca de posição (Pac-Man e fantasma cruzando).
- **4. Renascimento** sempre dentro do grid; `player_style` vem da config e da Action (`action.yml`); alvo do Pac-Man é limpo ao renascer.
- **5–6. Túneis** na linha 3 (bordas esquerda e direita): vizinhos e distância entendem o túnel; Pac-Man, fantasmas e olhos atravessam.
- **7. Velocidade**: fantasmas mais lentos no túnel e assustados; viram de costas quando o power-up começa; deixam de ficar assustados quando o Pac-Man morre.
- **8. Fuga com ruído** reproduzível (usa `store.rng`).
- **9. Renderizador SVG**: salto do túnel sem atravessar a tela, recorte da arena, bocas do túnel acendendo em ciano, fantasma piscando no fim do power-up, renascimento salta sem deslizar, boca virada para a direita simétrica.
- **10. IA do Pac-Man**: A* com custo de perigo previsto por estilo, pesos dinâmicos, revisita com decaimento, alvo "grudento".
- **Correções após a Task 10**:
  - armadilha da porta da casa: fantasma saindo da casa conta como perigo, e a casa do fantasma perigoso + a casa à frente dele viram custo infinito no A* (antes o Pac-Man renascia e morria em loop, até ~250 mortes);
  - agressivo ajustado: `powerupRange: 8` (vai no power-up com fantasma a até 8 passos);
  - loop do SVG limitado a 6000 frames (`console.warn` se estourar).
- **11. Limpeza**: removidos `pacman-movement-backup.ts`, `hasWall` (não usado) e o bloco `__loggedGhosts`; novo `tests/full-game.test.ts` (uma partida completa por estilo, grava `outputs/partida-<estilo>.svg`).
- **12. Build e docs**:
  - `github-action/dist/index.js` regerado com **esbuild** (mesmo formato do artefato que já estava commitado: arquivo único);
  - `dist/pacman-contribution-graph.min.js` regerado com webpack;
  - configs do webpack renomeadas para `.cjs` (`webpack.common.cjs`, `webpack.prod.cjs`), pois o pacote é `"type": "module"` e o `build:web` quebrava com `require is not defined`;
  - README: tabela de entradas da Action (com `player_style`), opções da biblioteca (`seed`, `debug`), túneis, semente estável no dia, comandos de teste.

## Estado atual

- **Funciona:** `pnpm test` (13 arquivos, 47 testes) e `pnpm exec tsc --noEmit` verdes. Partida completa termina nos três estilos (semente `partida`, mapa aleatório de 150 células):
  - conservador: 920 frames, 6 mortes, 13 fantasmas, combo 2, 21429 pts;
  - agressivo: 815 frames, 6 mortes, 12 fantasmas, combo 4, 25830 pts;
  - oportunista: 925 frames, 3 mortes, 20 fantasmas, combo 4, 99787 pts.
- **Conferido só de forma estrutural:** os SVGs de `outputs/` são XML válido e nenhum personagem sai do grid (só ±1 célula nos quadros do salto do túnel). **Falta a revisão visual no navegador** (Task 11, Step 5).
- **Não testado:** a Action rodando de verdade no GitHub (o bundle carrega e para em `Input required and not supplied: github_user_name`, como esperado sem entradas).
- **Atenção no build da Action:** o script `pnpm run build:action` usa **ncc**, que gera `index.js` + um chunk `886.index.js` + vários `.d.ts`. O artefato commitado foi gerado com esbuild (script de `github-action/package.json`):
  ```bash
  node node_modules/.pnpm/esbuild@0.25.2/node_modules/esbuild/bin/esbuild github-action/src/index.js --bundle --platform=node --target=node20 --outfile=github-action/dist/index.js
  ```
  O esbuild não está nas `devDependencies` da raiz (vem como dependência do `tsx`).

## Próximos passos (prioridade)

Rodada 2 (branch `claude/proximos-passos`, 2026-11-19), já feito:
- [x] PR #2 mergeado na `main`.
- [x] Build da Action unificado: `pnpm run build:action` usa esbuild (esbuild nas devDependencies) e reproduz o arquivo versionado.
- [x] CI (`.github/workflows/ci.yml`): `tsc --noEmit`, `pnpm test` e confere se o bundle da Action está atualizado.
- [x] IA: limiar do alvo "grudento" por estilo (`stickyDanger` 4/8/12) e largar o alvo pelo power-up quando um fantasma se aproxima; `safestNeighbor` evita casas letais e recém-visitadas.
- [x] Preview local: `pnpm preview` (mapa sorteado ou `--user` com `GITHUB_TOKEN`).
- [x] Velocidade da animação: `speed` na Action, `animationSpeed` na biblioteca.

Pendente:
- [x] Pontuação final: multiplicador de eficiência `1 + fantasmas/mortes` com teto de ×3 (antes chegava a ×28).
- [x] Revisão visual no navegador (servidor local em `outputs/`, `.claude/launch.json`): salto do túnel (x 1160 → −24 → 6, sem cruzar a tela), bocas em ciano, fantasmas azuis e piscando em branco. Achou e corrigiu o combo sem teto (482.850 → 84.450 pts).
- [ ] Rodar a Action de verdade no GitHub (workflow do perfil) e conferir o SVG publicado.
- [x] Prancha "SVG Pac-Man · Identidade e sistema de design": https://claude.ai/artifact/JMgq2AGqBKnyHFRLNT92cj (privada). O código segue os tokens dela; se mudar cor ou medida no código, atualizar a prancha.
- [x] 5 temas novos (`arcade`, `neon`, `alto-contraste`, `gitlab`, `gitlab-dark`) e tokens novos em todo tema (`textStrong`, `pacmanColor`, `pacmanStroke`, `pacmanPowerupColor`, `flashColor`); testes de contraste para os 8 temas.
- [x] Placar no fim do SVG (pontos, fantasmas, maior combo, mortes, duração), fonte monoespaçada do sistema, SVG com 229 px de altura.
- [x] Fliperama: o fantasma assustado sumia nas células azuis → contorno branco de 1 px (token `spriteOutline`).
- [x] Temas claros: os olhos do fantasma comido sumiam no branco → contorno escuro de 1 px (`spriteOutline`).
- [x] ESLint (typescript-eslint) no CI com `pnpm lint`; Prettier configurado (`pnpm format`), sem reformatar o código existente.
- [x] Fantasmas próprios em vetor (prancha "4 · Fantasmas", direção A · Lençol): substituem os 21 PNGs copiados do fliperama; cores por tema (`ghostColors`, `ghostOutline`, `scaredColor`, `scaredFace`, `flashFace`).
- [ ] Decidir: apagar os assets antigos que não são mais usados pelo código (`src/assets/img/ghosts/*.png`, `src/assets/gifs/*.gif`, `src/assets/ghosts_constants.txt`). São cópias da arte do fliperama.
- [ ] Opcional: aplicar `pnpm format` no projeto inteiro num PR só de formatação e então ativar `format:check` no CI.

## Decisões tomadas

- Estado do jogo em `store.game` (nada de variável de módulo) para o jogo ser testável e reproduzível.
- Todo movimento passa por `MovementUtils.getNeighbors` / `gridDistance` (que já entendem o túnel).
- Sorteios só via `store.rng`: mesma semente, mesma partida.
- `outputs/**/*.svg` fica fora do git (`.gitignore`).

## Comandos para retomar

```bash
pnpm install
pnpm test                               # todos os testes
pnpm test tests/full-game.test.ts       # partida completa + SVGs em outputs/
pnpm exec tsc --noEmit                  # tipos
pnpm run build:web                      # dist/pacman-contribution-graph.min.js
pnpm run build:action                   # github-action/dist/index.js (esbuild)
pnpm preview                            # preview local do SVG
node github-action/dist/index.js        # deve parar pedindo github_user_name
```
