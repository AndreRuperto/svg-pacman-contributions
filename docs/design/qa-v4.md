# QA V4 — acessibilidade e QA visual do site do ranking

**Data:** 23/11/2026 · **Branch:** `claude/v4-acessibilidade-ab7d83` · **Navegador testado:** Chromium (Chrome Headless Shell 159, Playwright 1.65.1) · **axe-core:** 4.14 via `@axe-core/playwright`

## Como foi testado

- **Servidor de teste** (`pnpm site:teste`, `site/src/web-teste.ts` + `site/src/fixture.ts`): site em memória (`MemoryRepo`), sem `DATABASE_URL` e sem GitHub. Três jogadores fixos (`ana-arcade` com banner publicado, `bruno-contribuidor-de-login-bem-longo` para quebra de linha, `carla`), calendários gerados por semente e partidas jogadas pelo motor de verdade, com snapshot, como o cron faria. "Hoje" congelado em 20/11/2026.
- **Rede no navegador:** avatares do GitHub viram o ícone do site; o banner publicado (raw.githubusercontent) vira a animação do próprio servidor de teste. As fontes do Google vêm da rede.
- **Testes automáticos** (`pnpm test:e2e`, `tests/e2e/`), também no CI (job `acessibilidade`, só Chromium):
  - `a11y.spec.ts` — axe com as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` e `best-practice`, mais overflow horizontal (`scrollWidth` da página e qualquer elemento visível além da borda direita fora de áreas de rolagem intencionais), em 8 telas × 7 larguras + 3 larguras com zoom de 200% (metade dos pixels CSS com `deviceScaleFactor` 2).
  - `teclado.spec.ts` — percorre cada tela com Tab (320, 390 e 1440 px): a primeira parada é "Pular para o conteúdo" e **toda** parada precisa de contorno de foco ≥ 2 px e estar na tela; e fluxos só com teclado (pular conteúdo, métrica/período do ranking, abrir e fechar partida do perfil com Enter/Espaço, período do gráfico, setas de dia, formulário de tema, pausar/reproduzir a animação).
  - `movimento.spec.ts` — com `prefers-reduced-motion: reduce`: nenhum elemento com transição ou animação CSS em nenhuma tela; na partida e na página do publicado a animação não aparece nem é baixada até a pessoa pedir, e toca quando pedida. Sem a preferência: a arena toca e oferece "Pausar a animação". Também registra que o SMIL do SVG continua animando mesmo com a regra de movimento reduzido do próprio SVG.
- **Capturas** (`pnpm qa:capturas`, `tests/e2e/capturas.ts`): JPEG de página inteira em `docs/design/qa-v4/`.

**Resultado final:** 123/123 testes do Playwright passando (local, modo CI com 2 workers); 353 testes Vitest passando, 12 pulados (os de Postgres sem `TEST_DATABASE_URL`).

## O que a auditoria encontrou e o que foi corrigido

| # | Achado | Evidência | Correção |
|---|---|---|---|
| 1 | **A animação da partida não parava com `prefers-reduced-motion`.** O SVG do motor tem `@media (prefers-reduced-motion: reduce) { animate… { display: none } }`, mas no Chromium isso **não** interrompe o SMIL (nem em `<img>`, nem abrindo o SVG direto) — duas capturas com 1,5 s de diferença saíram diferentes. | teste "a regra de movimento reduzido do próprio SVG não para o SMIL" | Tratado no site, sem mexer no motor nem no SVG: com movimento reduzido o CSS esconde a arena automática e um `<source media="(prefers-reduced-motion: reduce)">` troca o SVG pelo logo (a animação nem é baixada); aparece "Seu sistema pede menos movimento…" e um `<details>` "Reproduzir a animação". Capturas `*-movimento-reduzido.jpg`. |
| 2 | **Sem como pausar a animação** (WCAG 2.2.2): a arena da partida e o banner publicado tocam em loop sem controle; a CSP não permite JavaScript. | revisão manual | Link "Pausar a animação" → `?animacao=parada` (sem JS): a arena vira o `<details>` fechado, com "Voltar à reprodução automática". A pausa é mantida nas setas de dia e no formulário de tema (campo oculto). Vale para `/jogador/:login/:data` e `/publicado`. |
| 3 | Setas "‹/›" lidas pelos leitores de tela nos links "‹ Ranking", "‹ login", "‹ Partida de…", "‹ Mais recentes", "Mais antigas ›" e nas setas de dia. | revisão manual | Símbolos em `<span aria-hidden="true">`; espaçamento via `gap` (o espaço no fim de um item flex sumia: "‹ana-arcade"). |
| 4 | Contorno de foco ciano sobre amarelo tem contraste de só 1,07:1; nos botões e no segmento/filtro ativos (fundo amarelo) ele precisa ficar sobre o fundo escuro (12,6:1). | cálculo de contraste (preventivo) | `outline-offset: 3px` nesses casos; contorno ciano continua 2 px. Capturas `*-foco.jpg`. |
| 5 | (preventivo) `overflow: hidden` no palco da arena podia cortar o contorno de foco dos controles novos. | revisão do CSS | Palco com `overflow: visible` (a imagem já tem o próprio raio). |
| 6 | Texto de ajuda da partida a 11 px no celular. | revisão do CSS | 12 px. |
| 7 | Animações CSS não cobertas pela regra de movimento reduzido (só transições). | revisão do CSS | Com `reduce`: `animation: none` e `scroll-behavior: auto` para todos os elementos. |
| 8 | Modo de alto contraste do Windows (forced colors) sem borda nos controles que só se distinguem pela cor de fundo. | revisão do CSS | `@media (forced-colors: active)`: contorno de foco `CanvasText` e borda nas setas, segmentos e filtros. **Não testado em forced colors real.** |

**Sem violações do axe já na primeira rodada válida.** Uma rodada anterior acusou contraste e tamanho de alvo, mas era o servidor de teste que tinha caído no meio (o CSS deixou de carregar); com o servidor estável, 0 violações antes e depois das correções.

### Itens que o axe deixou como "inconclusivos" (conferidos à mão)

- `color-contrast` no gráfico do perfil (texto SVG `#9AA3B2` sobre `#161A22`): razão 6,85:1, passa AA.
- `label-content-name-mismatch` nas setas de dia: o texto visível é só "‹"/"›" (agora `aria-hidden`), e o nome acessível é "Dia anterior, 18 nov. 2026"; não há palavra visível que precise constar no nome.

## Matriz de resultados

"Foco" só foi percorrido em 320, 390 e 1440 px; "Movimento reduzido" foi testado uma vez por tela, na janela padrão de 1280 × 720. Capturas existem para as quatro telas principais; as variações (eficiência/7d, login longo, pausada, 404) foram testadas sem captura.

| Tela | Largura | axe | Overflow | Foco (Tab) | Movimento reduzido | Captura |
|---|---|---|---|---|---|---|
| ranking `/` | 320 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | ✅ testado a 1280×720: sem transição/animação CSS | [ranking-320.jpg](qa-v4/ranking-320.jpg) |
| ranking  | 360 | ✅ 0 violações | ✅ nenhum | — não testado | — | [ranking-360.jpg](qa-v4/ranking-360.jpg) |
| ranking  | 390 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | [ranking-390.jpg](qa-v4/ranking-390.jpg) |
| ranking  | 430 | ✅ 0 violações | ✅ nenhum | — não testado | — | [ranking-430.jpg](qa-v4/ranking-430.jpg) |
| ranking  | 768 | ✅ 0 violações | ✅ nenhum | — não testado | — | [ranking-768.jpg](qa-v4/ranking-768.jpg) |
| ranking  | 1024 | ✅ 0 violações | ✅ nenhum | — não testado | — | [ranking-1024.jpg](qa-v4/ranking-1024.jpg) |
| ranking  | 1440 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | [ranking-1440.jpg](qa-v4/ranking-1440.jpg) |
| ranking  | 1024 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [ranking-1024-zoom200.jpg](qa-v4/ranking-1024-zoom200.jpg) |
| ranking  | 1280 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [ranking-1280-zoom200.jpg](qa-v4/ranking-1280-zoom200.jpg) |
| ranking  | 1440 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [ranking-1440-zoom200.jpg](qa-v4/ranking-1440-zoom200.jpg) |
| ranking-eficiencia-7d `/?aba=eficiencia&periodo=7d` | 320 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | ✅ testado a 1280×720: sem transição/animação CSS | — |
| ranking-eficiencia-7d  | 360 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| ranking-eficiencia-7d  | 390 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | — |
| ranking-eficiencia-7d  | 430 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| ranking-eficiencia-7d  | 768 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| ranking-eficiencia-7d  | 1024 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| ranking-eficiencia-7d  | 1440 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | — |
| ranking-eficiencia-7d  | 1024 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| ranking-eficiencia-7d  | 1280 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| ranking-eficiencia-7d  | 1440 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| perfil `/jogador/ana-arcade` (1ª partida aberta) | 320 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | ✅ testado a 1280×720: sem transição/animação CSS | [perfil-320.jpg](qa-v4/perfil-320.jpg) |
| perfil  | 360 | ✅ 0 violações | ✅ nenhum | — não testado | — | [perfil-360.jpg](qa-v4/perfil-360.jpg) |
| perfil  | 390 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | [perfil-390.jpg](qa-v4/perfil-390.jpg) |
| perfil  | 430 | ✅ 0 violações | ✅ nenhum | — não testado | — | [perfil-430.jpg](qa-v4/perfil-430.jpg) |
| perfil  | 768 | ✅ 0 violações | ✅ nenhum | — não testado | — | [perfil-768.jpg](qa-v4/perfil-768.jpg) |
| perfil  | 1024 | ✅ 0 violações | ✅ nenhum | — não testado | — | [perfil-1024.jpg](qa-v4/perfil-1024.jpg) |
| perfil  | 1440 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | [perfil-1440.jpg](qa-v4/perfil-1440.jpg) |
| perfil  | 1024 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [perfil-1024-zoom200.jpg](qa-v4/perfil-1024-zoom200.jpg) |
| perfil  | 1280 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [perfil-1280-zoom200.jpg](qa-v4/perfil-1280-zoom200.jpg) |
| perfil  | 1440 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [perfil-1440-zoom200.jpg](qa-v4/perfil-1440-zoom200.jpg) |
| perfil-login-longo `/jogador/bruno-contribuidor-de-login-bem-longo` | 320 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | ✅ testado a 1280×720: sem transição/animação CSS | — |
| perfil-login-longo  | 360 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| perfil-login-longo  | 390 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | — |
| perfil-login-longo  | 430 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| perfil-login-longo  | 768 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| perfil-login-longo  | 1024 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| perfil-login-longo  | 1440 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | — |
| perfil-login-longo  | 1024 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| perfil-login-longo  | 1280 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| perfil-login-longo  | 1440 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| partida `/jogador/ana-arcade/2026-11-19` | 320 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | ✅ testado a 1280×720: sem transição/animação CSS; arena só sob demanda | [partida-320.jpg](qa-v4/partida-320.jpg) |
| partida  | 360 | ✅ 0 violações | ✅ nenhum | — não testado | — | [partida-360.jpg](qa-v4/partida-360.jpg) |
| partida  | 390 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | [partida-390.jpg](qa-v4/partida-390.jpg) |
| partida  | 430 | ✅ 0 violações | ✅ nenhum | — não testado | — | [partida-430.jpg](qa-v4/partida-430.jpg) |
| partida  | 768 | ✅ 0 violações | ✅ nenhum | — não testado | — | [partida-768.jpg](qa-v4/partida-768.jpg) |
| partida  | 1024 | ✅ 0 violações | ✅ nenhum | — não testado | — | [partida-1024.jpg](qa-v4/partida-1024.jpg) |
| partida  | 1440 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | [partida-1440.jpg](qa-v4/partida-1440.jpg) |
| partida  | 1024 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [partida-1024-zoom200.jpg](qa-v4/partida-1024-zoom200.jpg) |
| partida  | 1280 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [partida-1280-zoom200.jpg](qa-v4/partida-1280-zoom200.jpg) |
| partida  | 1440 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [partida-1440-zoom200.jpg](qa-v4/partida-1440-zoom200.jpg) |
| partida-pausada `…/2026-11-19?animacao=parada` | 320 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | ✅ testado a 1280×720: sem transição/animação CSS | — |
| partida-pausada  | 360 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| partida-pausada  | 390 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | — |
| partida-pausada  | 430 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| partida-pausada  | 768 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| partida-pausada  | 1024 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| partida-pausada  | 1440 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | — |
| partida-pausada  | 1024 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| partida-pausada  | 1280 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| partida-pausada  | 1440 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| publicado `/jogador/ana-arcade/2026-11-20/publicado` | 320 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | ✅ testado a 1280×720: sem transição/animação CSS; arena só sob demanda | [publicado-320.jpg](qa-v4/publicado-320.jpg) |
| publicado  | 360 | ✅ 0 violações | ✅ nenhum | — não testado | — | [publicado-360.jpg](qa-v4/publicado-360.jpg) |
| publicado  | 390 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | [publicado-390.jpg](qa-v4/publicado-390.jpg) |
| publicado  | 430 | ✅ 0 violações | ✅ nenhum | — não testado | — | [publicado-430.jpg](qa-v4/publicado-430.jpg) |
| publicado  | 768 | ✅ 0 violações | ✅ nenhum | — não testado | — | [publicado-768.jpg](qa-v4/publicado-768.jpg) |
| publicado  | 1024 | ✅ 0 violações | ✅ nenhum | — não testado | — | [publicado-1024.jpg](qa-v4/publicado-1024.jpg) |
| publicado  | 1440 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | [publicado-1440.jpg](qa-v4/publicado-1440.jpg) |
| publicado  | 1024 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [publicado-1024-zoom200.jpg](qa-v4/publicado-1024-zoom200.jpg) |
| publicado  | 1280 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [publicado-1280-zoom200.jpg](qa-v4/publicado-1280-zoom200.jpg) |
| publicado  | 1440 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | [publicado-1440-zoom200.jpg](qa-v4/publicado-1440-zoom200.jpg) |
| erro-404 `/jogador/ninguem` | 320 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | ✅ testado a 1280×720: sem transição/animação CSS | — |
| erro-404  | 360 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| erro-404  | 390 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | — |
| erro-404  | 430 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| erro-404  | 768 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| erro-404  | 1024 | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| erro-404  | 1440 | ✅ 0 violações | ✅ nenhum | ✅ todas as paradas | — | — |
| erro-404  | 1024 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| erro-404  | 1280 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |
| erro-404  | 1440 · zoom 200% | ✅ 0 violações | ✅ nenhum | — não testado | — | — |

### Capturas extras

- Movimento reduzido: [partida 390](qa-v4/partida-390-movimento-reduzido.jpg) · [partida 1440](qa-v4/partida-1440-movimento-reduzido.jpg) · [publicado 390](qa-v4/publicado-390-movimento-reduzido.jpg) · [publicado 1440](qa-v4/publicado-1440-movimento-reduzido.jpg)
- Foco visível (janela visível, após alguns Tabs): [ranking 390](qa-v4/ranking-390-foco.jpg) · [ranking 1440](qa-v4/ranking-1440-foco.jpg) · [perfil 390](qa-v4/perfil-390-foco.jpg) · [perfil 1440](qa-v4/perfil-1440-foco.jpg) · [partida 390](qa-v4/partida-390-foco.jpg) · [partida 1440](qa-v4/partida-1440-foco.jpg)

## Limites e pendências (não marcados como feitos)

- **Só Chromium.** Firefox e WebKit/Safari não foram testados; o comportamento do SMIL com movimento reduzido pode ser diferente neles (o tratamento do site independe disso).
- **Leitores de tela reais** (NVDA, VoiceOver, TalkBack) e **forced colors real** não foram testados.
- **Zoom 200%** foi simulado (metade da largura CSS com densidade 2), não com o zoom do navegador de um usuário.
- Na **lista de partidas do perfil**, abrir uma partida mostra a animação tocando mesmo com movimento reduzido: é uma ação explícita da pessoa e fechar o `<details>` esconde a animação, mas não há quadro parado.
- Com a arena pausada não há um **quadro parado** da partida (gerá-lo exigiria mudar o SVG do motor).
- As capturas usam dados fixos do servidor de teste, **não** a produção.
