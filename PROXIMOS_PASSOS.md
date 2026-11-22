# Próximos passos

- **Data:** 2026-11-22
- **Branch:** `main`. PR #16 mergeado com sucesso em `8e61fbc` (22/11/2026).
- **Site:** https://svg-pacman-ranking.up.railway.app
- **Planos e desenhos:**
  - jogo: `docs/plans/2026-11-19-jogabilidade.md` · `docs/plans/2026-11-19-jogabilidade-design.md`
  - site: `docs/plans/2026-11-20-site-ranking.md` · `docs/plans/2026-11-20-site-ranking-design.md`
- **Prancha original recuperada em 22/11/2026:** o usuário forneceu o ZIP completo `SVG Pac-Man · Identidade e sistema de design-project.zip`, com `canvas.json` e 12 artboards `.dc.html` (identidade, componentes, temas, banner, celular, placar, fantasmas, logo e quatro telas). **É um projeto de design com exemplos ilustrativos, não um print do site em produção.** As referências foram inspecionadas e aplicadas na V1; o ZIP original ainda não foi versionado no GitHub.

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

- **Testes:** ESLint, TypeScript, Vitest e contrato do PostgreSQL 16 real aprovados na CI do PR #16, junto à validação do bundle compilado da Action. O contrato antes pulado agora executa em banco descartável.
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
- [x] Bundle recompilado e sincronizado pelo workflow (`c54ed6d`), com CI completa aprovada no PR #16.
- [x] PR #16 mergeado (`8e61fbc`) e Railway confirmado com deploy `SUCCESS` nos serviços `web` e `cron` em 22/11/2026.

## PR #17 — Replay verificável, cache persistente e métricas (22/11/2026)

**Objetivo:** confiar no resultado da partida e tornar rápidas as aberturas seguintes sem reenviar o jogo ao motor.
**Implementado no PR #17, mergeado na `main` em `38d506e` (22/11/2026):**

- [x] Assinatura SHA-256 de placar, versão do motor e snapshot original: qualquer mudança exige regeneração; não é assinatura de autenticidade de usuário.
- [x] Cache persistente comprimido em PostgreSQL (`svg_cache`), somente para replays com snapshot verificado; arquivos acima de 12 MiB descomprimidos ou 2 MiB comprimidos não entram; limpeza de registros com mais de 30 dias.
- [x] Fallback sem derrubar a rota: se cache estiver inacessível/corrompido, gerar SVG com o motor e conferir pontuação antes de entregar.
- [x] `Server-Timing: replay;dur=...`, `X-Pacman-Cache: memoria|persistente|gerado`, `X-Pacman-Replay: verificado|reconstrucao`; logs de tempo real de geração sem token de acesso.
- [x] Teste de integração sem rede `runCron → snapshot → playDay → API → cache` incluindo reabertura em novo processo lógico e divergência de placar.
- [x] Testes de CI + PostgreSQL real aprovados no [PR #17](https://github.com/AndreRuperto/svg-pacman-contributions/pull/17) e merge realizado no commit `38d506e`.
- [ ] Verificar em produção **primeira partida real com snapshot pós-PR #16**. O cron normal executa `0 1 * * *` UTC; uma execução de deploy do serviço não equivale a uma rodada do cron. Não marcar como concluído apenas porque o deploy foi `SUCCESS`.
- [ ] Medir latências de cache frio/quente **no ambiente real**. Hipótese-alvo: cache persistente mais rápido que renderizar novamente; não inventar números ou SLA antes de medir.
- [ ] Pré-renderização agendada dos últimos dias (etapa futura, apenas após medir, para não saturar CPU/banco ou a API GitHub). O cache atual já torna aberturas futuras persistentes sem pré-renderizar.

**Deploy verificado:** Railway registrou `SUCCESS` para **web** e **cron** no commit `38d506e` em 22/11/2026; a avaliação de saúde do ambiente não apontou problemas ativos. Isso **não comprova** que o cron programado gerou uma partida com snapshot depois desse deploy.

### Protocolo de validação pós-deploy

1. Confirmar que a execução programada do `cron` ocorreu depois do PR #16, sem erro e com `jogadas > 0` para ao menos um participante.
2. Abrir a partida nova no site e validar o SVG: `HTTP 200`, `X-Pacman-Replay=verificado`, plaquetas/métricas batendo no banco e SVG carregado.
3. Reabrir a mesma URL: `X-Pacman-Cache=memoria`; reiniciar o serviço `web` **somente em janela controlada**, reabrir e conferir `X-Pacman-Cache=persistente`. Evitar reinícios desnecessários em produção; o teste de CI cobre esse cenário automaticamente.
4. Testar um dia histórico: `X-Pacman-Replay=reconstrucao`, aviso na página, sem cache persistente e sem rebatizar de “verificado”.
5. Comparar o `Server-Timing` de cache frio/persistente/RAM (P50 e P95 em amostra adequada); registrar resultados reais, navegador, data e links dos logs, sem expor credenciais.
6. Testar uma divergência apenas em ambiente isolado com dados sintéticos; resposta precisa ser `503`, e nenhuma animação incorreta deve ser armazenada.

## Próxima fase visual — direção proposta e documentação

**O que eu considero correto melhorar:** manter a identidade **arcade editorial**, deixando o produto mais limpo, legível e orientado a informações, sem redesenhar o jogo como um cassino neon. A animação deve ser protagonista nas páginas de partida, e o ranking deve funcionar como uma tabela de dados de boa qualidade.

**Documento executável e completo:** [Redesign do ranking, histórico e partida — 22/11/2026](docs/plans/2026-11-22-redesign-ranking.md). O documento cobre diagnóstico por arquivo, tokens, componentes, wireframes em texto, estados, telas, acessibilidade, viewports, QA e critérios de pronto. Essa especificação está no Git, para não repetir a perda da antiga prancha temporária.

| Fase visual futura | Mudança recomendada | Principal critério de aceite |
|---|---|---|
| V1 · Ranking | Melhorar hierarquia título→métrica→período→tabela; destacar valor ativo e líder sem poluição; aproveitar a largura funcional até ~1200px se houver densidade; evitar painel lateral vazio | Tabela desktop clara e cartões mobile com posição, avatar, login e pontos; sem scroll horizontal do documento |
| V2 · Perfil | KPIs alinhados em desktop e grade 2×2 mobile; gráfico amarelo com média ciano, quebras reais nos dias sem partida; histórico com hierarquia de datas | Perfis com 1 e 300+ partidas legíveis; paginação, gráfico e `<details>` funcionando sem JavaScript |
| V3 · Partida | Replay antes das estatísticas secundárias; arena proporcional 1166:229, navegação 44px, seletor de tema discreto e métricas em grade responsiva | Status exibido coincide com resultado real da API; erro nunca parece “replay verificado”; mobile sem sobreposição |
| V4 · Acessibilidade | Foco, contraste WCAG 2.2 AA, teclado, zoom 200%, `prefers-reduced-motion` e testes com SVG/SMIL | Chrome/Firefox/WebKit quando disponíveis; registrar plataformas não testadas |
| V5 · Prancha persistente | Salvar capturas de interface real em `docs/design/`, com largura/versão/estado; comparação antes/depois | Referência independente de links temporários, sem exemplos/placares fictícios expostos como dados reais |

**Tokens a preservar:** fundo `#0B0D12`, superfície `#161A22`, texto `#E8EAF0`, amarelo `#FFD23F`, ciano `#00E5FF`, contorno `#2A303C`, raios 12px, toques ≥44px e espaçamentos em múltiplos de 4px. Marca Silkscreen, títulos Space Grotesk, corpo Inter e placares JetBrains Mono.

**O que não fazer:** não acrescentar cards vazios “para ocupar espaço”, não esconder as datas com carrosséis, não usar neon decorativo em excesso, não inventar métricas nem alterar pontos por motivo estético. Refatorar CSS só depois de medir estilos computados, ordem de importações e especificidade, preservando as URLs atuais.

**Sequência:** PR #17 confiabilidade → V1 ranking → V2 perfil → V3 partida → V4 acessibilidade → V5 prancha e limpeza. **O visual continua planejado, não foi redesenhado no PR #17.**

## V1 visual — ranking inspirado na prancha original (22/11/2026)

**Fonte restaurada:** o ZIP `SVG Pac-Man · Identidade e sistema de design-project.zip` contém `SiteRankingDesktop.dc.html` (1280×860), `SiteRanking.dc.html` (390×844), `SiteJogador.dc.html`, `SitePartida.dc.html`, `Logo.dc.html` e outros artboards. Jogadores e números em colchetes são **placeholders**. O site usa somente seus dados reais, nunca os do mockup.

**Mudanças feitas na branch `chatgpt/ranking-design-original-v1-20261122`:**
- [x] Hierarquia: título → descrição → filtros → data/contagem → classificação, sem cards decorativos.
- [x] Desktop: tabela com fundo e cabeçalho próprios, colunas numéricas alinhadas, métrica ativa destacada e líder identificado por posição e cor.
- [x] Mobile: cartão com posição, avatar, login e valor na primeira linha; fantasmas/mortes/duração na segunda. Grade sem colunas comprimidas, incluindo ajuste a 320–359px.
- [x] Filtros por links SSR (Pontos/Eficiência, Último dia/7 dias/Recorde), `aria-current`, mínimo de 44px de toque.
- [x] Largura funcional do ranking até 1120px; perfil e partida mantêm a largura própria.
- [x] Tokens preservados: `#0B0D12`, `#161A22`, `#FFD23F`, `#00E5FF`, Silkscreen, Space Grotesk, Inter e JetBrains Mono.
- [x] Testes de markup, dados dinâmicos, filtros e CSS responsivo sem tocar nas fórmulas de score.
- [ ] Prints e auditoria visual real em **320, 360, 390, 430, 768, 1024 e 1440px**, teclado, zoom 200% e navegadores compatíveis. O navegador de captura da sessão foi bloqueado: **não afirmar que screenshots ou QA visual foram concluídos**.
- [x] CI do PR #18 aprovada, merge na `main` no commit `3b3ba64` (22/11/2026), deploy Railway `SUCCESS` confirmado para `web` e `cron` com esse commit.

**Publicação V1:** [PR #18](https://github.com/AndreRuperto/svg-pacman-contributions/pull/18), código mergeado e publicado. **Ainda pendente:** capturas do visual em navegadores reais e avaliação da legibilidade em 320–1440px; não considerar esse QA concluído apenas com CI verde.

**Sequência depois da V1:** V2 perfil + gráfico de históricos longos; V3 página da partida e status verificado vs reconstrução; V4 acessibilidade/cross-browser; V5 preservar os artboards/fontes na documentação versionada. Não copiar dados inventados da prancha para produção.

## Acompanhamento depois da publicação

- [ ] Confirmar a primeira partida diária **criada com snapshot** e abrir seu replay para checar placar e SVG na produção.
- [ ] Conferir o visual do SVG com movimento reduzido em diferentes navegadores e leitores de tela; CSS interno foi adicionado, mas compatibilidade de SMIL varia.
- [ ] Rotacionar `GITHUB_TOKEN` quando necessário, conferindo o resultado do cron no Railway; token não foi acessado nem substituído nesta rodada.

## Próximos passos (prioridade)

- [ ] **Token do GitHub:** a rotina agora identifica 401 e encerra com falha visível, sem consultas repetidas (PR #16). A rotação do segredo no Railway continua manual; não armazenar ou expor o valor.
- [x] **Prancha original recuperada:** ZIP integral fornecido em 22/11, inspecionado, com artboards de ranking/desktop/mobile. Preservar posteriormente um exemplar no repositório; não confundir placeholders do design com dados reais.
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
