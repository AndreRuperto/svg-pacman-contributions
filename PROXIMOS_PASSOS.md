# Próximos passos

- **Data:** 2026-11-22
- **Branch de trabalho:** `chatgpt/replay-fiel-20261122` (PR #16). A `main` continua como versão publicada até a CI aprovar o merge.
- **Site:** https://svg-pacman-ranking.up.railway.app
- **Planos e desenhos:**
  - jogo: `docs/plans/2026-11-19-jogabilidade.md` · `docs/plans/2026-11-19-jogabilidade-design.md`
  - site: `docs/plans/2026-11-20-site-ranking.md` · `docs/plans/2026-11-20-site-ranking-design.md`
- **Prancha de design:** "SVG Pac-Man · Identidade e sistema de design" (artifact `JMgq2AGqBKnyHFRLNT92cj`). **Não existe mais em 21/11:** foi apagada ou o acesso caiu. Cópia local dos quadros em `C:\tmp\prancha-pacman\project\` (pasta temporária, pode sumir).

## O que foi feito (19 a 21/11)

### Jogo e banner

| PR | O quê |
|----|-------|
| #2 | Jogabilidade e IA: Vitest, sorteio com semente (usuário + dia UTC), estado do jogo no `store`, comer uma vez só, power-up que renova, combo, colisão por troca de casa, renascimento dentro do grid, `player_style` na Action, túneis na linha 3, fantasmas assustados (½ velocidade, viram de costas, fuga com ruído), A* com perigo previsto por estilo, revisita com decaimento, correção do loop de morte na porta da casa, limite de 6000 frames, build da Action com esbuild, `build:web` consertado. |
| #3 | CI (tipos, testes, bundle da Action atualizado), preview local (`pnpm preview`), velocidade da animação (`speed` / `animationSpeed`), alvo da IA por estilo, teto ×3 no multiplicador de eficiência. |
| #4 | ESLint no CI, Prettier configurado, combo de fantasmas parando em 1600, 5 temas novos (`arcade`, `neon`, `alto-contraste`, `gitlab`, `gitlab-dark`), cores vindas do tema, placar no fim do SVG, testes de contraste dos 8 temas. |
| #5 | Contorno nos sprites que sumiam (assustado no arcade, olhos nos temas claros). |
| #6 | Fantasmas próprios em vetor ("A · Lençol") no lugar dos 21 PNGs copiados do fliperama; cores dos fantasmas por tema. |
| #7 | Meses do banner sempre em português. |
| #9 | No `neon`, o 4º fantasma deixa de ser branco (confundia com o pisca). |

### Site do ranking

| PR | O quê |
|----|-------|
| #10 | O site inteiro. **Motor:** joga qualquer dia (`config.date`), `playDay()` sem rede, fim de jogo garantido e bug do domingo corrigido. **Site:** cron, Postgres, API, as três telas, limite por IP, cache e CSP. |
| #11 | Gráfico do jogador com o histórico inteiro; README com a seção "🏆 Ranking". |
| #12 | Partida abre na própria lista com uma seta (sem o "Ver a partida"). |
| #13 | "Ver como foi publicado" abre uma página do site que mostra o SVG antigo com os fantasmas (o raw do GitHub bloqueava as imagens embutidas). |
| #14 | Logo "A · Mordida na grade": cabeçalho, favicon, ícone de tela inicial e prévia de link. |

Os PRs #8 e este são só de anotações.

## Estado atual

- **Testes:** CI com ESLint, TypeScript, Vitest, contrato do PostgreSQL 16 real e verificação do bundle da Action. O contrato antes pulado agora é executado no banco descartável do runner. O PR #16 depende de todos os passos verdes.
- **Railway, projeto `svg-pacman-ranking`:**
  - `web` roda `pnpm site:web`, no domínio `svg-pacman-ranking.up.railway.app`;
  - `cron` roda `pnpm site:cron` em `0 1 * * *` UTC;
  - o Postgres não tem endereço público.
  - Variáveis: `DATABASE_URL`, que aponta para o Postgres, e `GITHUB_TOKEN`, no `web`. O `cron` usa `${{web.GITHUB_TOKEN}}`.
  - O deploy é automático a cada push na `main`.
- **Dados no site:**
  - @AndreRuperto tem 592 partidas (8 abr. 2025 a 20 nov. 2026), 586 delas com o SVG publicado;
  - o recorde é 69.990, em 1 out. 2026;
  - o cron das 01:00 UTC já roda sozinho e grava uma partida por dia.
- **Banner do perfil:** o workflow "Alternador Snake/Pac-Man" do `AndreRuperto/AndreRuperto` alterna Snake e Pac-Man a cada 12 h. O Pac-Man sai no tema `brasa`.
- **Conferido no navegador** (celular e computador):
  - ranking, jogador com o gráfico inteiro e a partida que abre na lista;
  - página do publicado com os fantasmas;
  - a logo no cabeçalho, o favicon e a prévia de link;
  - os 8 temas do banner.

## PR #16 — replay fiel e qualidade (22/11/2026)

- [x] Salvar snapshot compacto das contribuições junto ao placar (schema aditivo JSONB).
- [x] Usar snapshot para partidas novas e bloquear animação se a reexecução divergir do resultado persistido.
- [x] Mostrar aviso na página das partidas antigas sem snapshot.
- [x] Testes reais de PostgreSQL no CI e testes de serialização do snapshot.
- [x] Identificar token expirado do GitHub (401) e retornar falha do cron sem revelar credenciais.
- [x] SVG com viewBox, título, descrição e regra de movimento reduzido; validar compatibilidade visual depois.
- [x] Validação de entradas da Action, documentação operacional e CONTRIBUTING.md.
- [ ] Atualizar o bundle distribuído da Action e aprovar a CI completa.
- [ ] Merge do PR #16, conferir deploy Railway dos serviços web e cron.

## Próximos passos (prioridade)

- [ ] **Token do GitHub:** a rotina agora identifica 401 e encerra com falha visível, sem consultas repetidas (PR #16). A rotação do segredo no Railway continua manual; não armazenar ou expor o valor.
- [ ] **Prancha de design:** ela não existe mais. Decidir se recria, a partir da cópia local em `C:\tmp\prancha-pacman\project\` enquanto ela existir.
- [ ] **Assets antigos:** decidir se apaga os que o código não usa mais (`src/assets/img/ghosts/*.png`, `src/assets/gifs/*.gif`, `src/assets/ghosts_constants.txt`). São cópias da arte do fliperama. Ficam por decisão de 20/11.
- [x] **Replay de partidas novas:** cron guarda snapshot compacto e servidor só entrega replay se métricas e versão coincidirem (PR #16). Partidas legadas permanecem com aviso de reconstrução aproximada; ver "Problemas conhecidos".
- [ ] **Opcional:**
  - rodar `pnpm format` no projeto inteiro, num PR só de formatação, e então ativar `pnpm format:check` no CI;
  - conferir em navegadores e leitores de tela o SVG com `viewBox`, `<title>`, `<desc>` e regra `prefers-reduced-motion` adicionados no PR #16;
  - os itens restantes do `TODO2.TXT`: comparação lado a lado, investigação do retry da API, cobertura visual cross-browser e futuras estratégias de snapshot de gameHistory se o motor evoluir. Validação das entradas da Action incluída no PR #16.

## Problemas conhecidos

- **Partidas históricas anteriores ao snapshot:** o calendário original não foi preservado. Elas permanecem no ranking e podem ser reconstruídas a partir do GitHub atual, mas a UI informa explicitamente que os números podem divergir. Quando houver, o SVG publicado no perfil continua acessível. **Para novas partidas**, o cron grava o calendário em JSONB e a API confere as métricas da repetição antes de servir o SVG (PR #16). Mudanças futuras de algoritmo exigem versionamento para manter essa garantia.
- **Primeira abertura de uma partida é lenta:** leva alguns segundos, o tempo de buscar as contribuições e gerar o SVG. Depois vem do cache.

## Decisões tomadas

- **Jogo determinístico:** o estado fica em `store.game` e os sorteios só usam `store.rng`. Mesma semente, mesma partida. É isso que deixa o site jogar no lugar dos jogadores, sem confiar em números enviados.
- **Movimento:** todo passo usa `MovementUtils.getNeighbors` / `gridDistance`, que já entendem o túnel.
- **Cores e medidas:** saem dos tokens de tema (`GameTheme`).
- **Texto do SVG:** usa a fonte monoespaçada do sistema, porque o README mostra o SVG como `<img>`, sem fontes externas.
- **Fantasmas:** desenho próprio em vetor (A · Lençol).
- **Logo:** A · Mordida na grade.
- **Pontuação:** multiplicador de eficiência com teto ×3; combo de fantasmas para em 1600 por fantasma.
- **Site:**
  - o ranking usa o **último dia completo** em UTC;
  - quem entra no ranking entra por PR em `ranking/jogadores.json`;
  - o histórico é recalculado com as regras atuais;
  - partidas interrompidas contam no "último dia" e nos "7 dias", mas não no recorde.
- **Página do publicado:** o "Ver como foi publicado" mostra o SVG antigo como `<img>` numa página do site, porque aberto direto no `raw.githubusercontent.com` as imagens embutidas são bloqueadas.
- **Fora do git:** `outputs/**/*.svg`.

## Comandos para retomar

```bash
pnpm install
pnpm test                               # todos os testes
pnpm lint                               # ESLint
pnpm exec tsc --noEmit                  # tipos
pnpm preview --theme neon --no-open     # gera outputs/preview-<estilo>-<tema>.svg
pnpm run build:action                   # github-action/dist/index.js (esbuild)
pnpm run build:web                      # dist/pacman-contribution-graph.min.js
pnpm exec tsx tools/gerar-logo.ts       # regenera a logo em site/public/
gh workflow run alternador.yml -R AndreRuperto/AndreRuperto   # roda o banner do perfil

# site local (sem DATABASE_URL usa memória e preenche os últimos 14 dias)
GITHUB_TOKEN=$(gh auth token) PORT=3456 pnpm site:web

# Railway (CLI já logada)
railway logs --service web --lines 50
railway logs --service cron --lines 50
```

**Rodar o cron fora do horário** (para um jogador novo, por exemplo): a CLI do Railway não tem "rodar agora".
1. Use o botão "Run now" do cron no painel; ou
2. mude a agenda para `*/5 * * * *` com patch JSON:
   ```bash
   echo '{"services":{"96fea51a-3600-47e3-80c9-cd085b34786d":{"deploy":{"cronSchedule":"*/5 * * * *"}}}}' | railway environment edit --json
   ```
   Depois que rodar, volte para `0 1 * * *`. O comando `environment edit` sem `--json` pede confirmação e não aplica.
