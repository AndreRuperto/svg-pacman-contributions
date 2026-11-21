# Próximos passos

- **Data:** 2026-11-20
- **Branch:** `claude/site-no-ar`. Todo o código está na `main` (PRs #2 a #8 mergeados).
- **Plano e desenho da rodada 1:** `docs/plans/2026-11-19-jogabilidade.md` · `docs/plans/2026-11-19-jogabilidade-design.md`
- **Prancha de design (privada):** "SVG Pac-Man · Identidade e sistema de design", https://claude.ai/artifact/JMgq2AGqBKnyHFRLNT92cj. Cópia local dos arquivos em `C:\tmp\prancha-pacman\project\` (temporária).

## O que foi feito (19 e 20/11)

| PR | O quê |
|----|-------|
| #2 | Jogabilidade e IA: Vitest, sorteio com semente (usuário + dia UTC), estado do jogo no `store`, comer uma vez só, power-up que renova, combo, colisão por troca de casa, renascimento dentro do grid, `player_style` na Action, túneis na linha 3, fantasmas assustados (½ velocidade, viram de costas, fuga com ruído), A* com perigo previsto por estilo, revisita com decaimento, correção do loop de morte na porta da casa, limite de 6000 frames, build da Action com esbuild, `build:web` consertado. |
| #3 | CI (tipos, testes, bundle da Action atualizado), preview local (`pnpm preview`), velocidade da animação (`speed` / `animationSpeed`), alvo da IA por estilo, teto ×3 no multiplicador de eficiência. |
| #4 | ESLint no CI, Prettier configurado, combo de fantasmas parando em 1600, revisão visual no navegador, 5 temas novos (`arcade`, `neon`, `alto-contraste`, `gitlab`, `gitlab-dark`), cores do Pac-Man / poder / pisca vindas do tema, placar no fim do SVG, testes de contraste dos 8 temas. |
| #5 | Contorno nos sprites que sumiam (assustado no arcade, olhos nos temas claros). |
| #6 | Fantasmas próprios em vetor (direção "A · Lençol" da prancha) no lugar dos 21 PNGs copiados do fliperama; cores dos fantasmas por tema. |
| #7 | Meses do banner sempre em português (antes seguiam o idioma da máquina: no runner saíam em inglês). |
| #8 | Este arquivo atualizado. |

Também: a Action rodou de verdade no repositório do perfil (`AndreRuperto/AndreRuperto`, workflow "Alternador Snake/Pac-Man"). O README do perfil mostra o banner novo no tema `brasa`, com placar, fantasmas em vetor e meses em português.

## Estado atual

- **Funciona:** `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm test` (132 testes) sem erros; CI verde na `main`; SVG publicado no perfil conferido (229 px de altura, placar, nenhum PNG embutido, meses `nov.` … `nov.`).
- **Conferido no navegador:** salto do túnel, bocas em ciano, fantasmas assustados e piscando, os 8 temas com placar, fantasmas em vetor no `github-dark` e no `github`.
- **Fantasmas em vetor conferidos no navegador nos 8 temas** (20/11). No `neon`, o 4º fantasma era branco e se confundia com o fantasma piscando: virou coral claro `#FFC9C9`, e um teste novo garante que nenhum fantasma normal fique parecido com o pisca.
- **Alternador do perfil:** alterna Snake e Pac-Man a cada execução (cron de 12 h). Para forçar o Pac-Man, pode ser preciso disparar duas vezes (ver `mode.txt` na branch `output`).

## Próximos passos (prioridade)

- [x] **Site do ranking no ar:** https://svg-pacman-ranking.up.railway.app (PR #10). Railway, projeto `svg-pacman-ranking`: serviços `web` (`pnpm site:web`) e `cron` (`pnpm site:cron`, `0 1 * * *` UTC) + Postgres. Variáveis: `DATABASE_URL` (referência ao Postgres) e `GITHUB_TOKEN` (no `web`; o `cron` usa `${{web.GITHUB_TOKEN}}`). Histórico de @AndreRuperto carregado em 20/11: 591 partidas (8 abr. 2025 a 19 nov. 2026), 586 com o SVG publicado, recorde 69.990 em 1 out. 2026.
- [ ] **Token do GitHub vence:** quando vencer, o cron para de jogar. Gerar outro (classic, sem nenhum escopo) e trocar `GITHUB_TOKEN` no serviço `web` do Railway; o `cron` acompanha pela referência.
- [x] O gráfico "Pontos por dia" cobre o histórico inteiro (desde a entrada no ranking), com a média de todas as partidas; acima de 60 partidas desenha só a linha.
- [x] README do projeto: seção "🏆 Ranking" com o link do site e como entrar.
- [ ] Prancha: trocar os placeholders das telas "Site 1–3" pelos dados reais.
- [ ] Rodar o cron fora do horário (para um jogador novo, por exemplo): a CLI do Railway não tem "rodar agora". Opções: botão "Run now" do cron no painel, ou mudar a agenda para `*/5 * * * *` com patch JSON (`railway environment edit --json`) e voltar para `0 1 * * *` depois.
- [ ] Decidir se apaga os assets antigos que o código não usa mais (`src/assets/img/ghosts/*.png`, `src/assets/gifs/*.gif`, `src/assets/ghosts_constants.txt`). São cópias da arte do fliperama; por ora ficam (decisão de 20/11).
- [ ] Opcional: rodar `pnpm format` no projeto inteiro num PR só de formatação e então ativar `pnpm format:check` no CI.
- [ ] Opcional: SVG responsivo (`viewBox` + largura 100%) e acessibilidade (`<title>`/`aria-label` no SVG, `prefers-reduced-motion`), itens 41–42 do `TODO2.TXT`.
- [ ] Opcional: itens restantes do `TODO2.TXT` (sistema de replay, modo de comparação lado a lado, validação de entrada da Action, retry na API do GitHub).

## Problemas conhecidos

- **Animação do site pode divergir da partida salva.** `/api/partida` joga o dia de novo com as contribuições de *agora* (o GitHub pode ter mudado a janela daquele dia), então pontos, mortes ou fantasmas podem não bater com o que o cron gravou. Hoje o `web` só registra um `console.warn` com login e data quando isso acontece. Correção futura:
  - [ ] guardar as contribuições da janela (ou um hash delas) na partida, e desenhar a animação a partir delas.

## Decisões tomadas

- Estado do jogo em `store.game` e sorteios só via `store.rng`: mesma semente, mesma partida; a animação só muda de um dia para o outro.
- Todo movimento passa por `MovementUtils.getNeighbors` / `gridDistance` (já entendem o túnel).
- Cores e medidas do SVG saem dos tokens de tema (`GameTheme`) definidos na prancha. Se mudar algo no código, atualizar a prancha.
- Texto dentro do SVG usa a fonte monoespaçada do sistema: o README mostra o SVG como `<img>`, que não carrega fontes externas.
- Fantasmas: desenho próprio em vetor (A · Lençol). As direções B · Visor e C · Pixel ficam registradas na prancha como alternativas.
- Pontuação: multiplicador de eficiência com teto ×3; combo de fantasmas para em 1600 por fantasma.
- `outputs/**/*.svg` fica fora do git.

## Comandos para retomar

```bash
pnpm install
pnpm test                               # todos os testes
pnpm lint                               # ESLint
pnpm exec tsc --noEmit                  # tipos
pnpm preview --theme neon --no-open     # gera outputs/preview-<estilo>-<tema>.svg
pnpm test tests/full-game.test.ts       # partida completa por estilo em outputs/
pnpm run build:action                   # github-action/dist/index.js (esbuild)
pnpm run build:web                      # dist/pacman-contribution-graph.min.js
gh workflow run alternador.yml -R AndreRuperto/AndreRuperto   # roda o banner do perfil
```

Para ver a animação parada num instante: o servidor de `outputs/` está em `.claude/launch.json` (`python -m http.server 8765 -d outputs`); no navegador, `document.documentElement.pauseAnimations()` e `setCurrentTime(segundos)`.
