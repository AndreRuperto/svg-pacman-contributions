# Direção de design — SVG Pac-Man Ranking
**Data:** 22/11/2026 · **Status:** V1 ranking implementada no PR #18 (aguardando validação/merge), V2–V5 ainda planejadas · **Alvo:** evoluir frontend sem modificar motor e placares.

## Referências efetivamente conferidas (ZIP do usuário, 22/11)
- `SiteRankingDesktop.dc.html`: artboard 1280 × 860, tabela com sete colunas e métricas alinhadas, filtros por pontuação/período e CTA discreto.
- `SiteRanking.dc.html`: artboard 390 × 844, botões em grupos separados e cartões com posição, avatar, jogador, valor e detalhes.
- `SiteJogador.dc.html` e `SitePartida.dc.html`: referências reservadas para V2 e V3, não implementadas na V1.
- `Main.dc.html`, `Componentes.dc.html`, `Logo.dc.html`, `Temas.dc.html`, `Fantasmas.dc.html`, `Banner.dc.html`, `Celular.dc.html` e `Placar.dc.html`: identidade, tokens, sprites e proporções já incorporados ao produto.
- A prancha preserva 12 artboards em `canvas.json`. Ela usa conteúdo ilustrativo, inclusive nomes de jogadores entre colchetes. **O site em produção não deve importar a lógica fictícia dos artboards.**

**Limite desta rodada:** conseguimos inspecionar os arquivos HTML e o JSON da prancha, mas a captura automatizada foi bloqueada pelo ambiente. Não há screenshot renderizado validado e os testes de overflow/zoom/contraste no navegador continuam na lista de aceitação.

## 1. Diagnóstico do layout atual (conferido no código)
- O site já possui identidade coerente: fundo `#0B0D12`, superfícies `#161A22`, contorno `#2A303C`, amarelo `#FFD23F` e ciano `#00E5FF` em `site/public/site.css`.
- **Base anterior à V1:** largura máxima de **1040px** com **16px** de padding lateral; acima de **768px**, ranking em tabela, abaixo disso em cartões. **V1:** ranking isolado até 1120px, tabela ≥960px, cartões em largura menor; perfil/partida não mudaram.
- O perfil exibe **quatro métricas** e um gráfico de pontos por dia; uma lista de partidas usa `<details>` e SVG embutido quando aberta.
- O SVG atual mede **1166 × 229** originalmente, com `viewBox` e escala fluida; o site não deve distorcer sua proporção.
- A identidade “A · Mordida na grade”, os oito temas, os fantasmas vetoriais e as cores do jogo **devem ser preservados**.
- Pontos de revisão: hierarquia fraca entre título/filtros/dados, grande bloco de tabela no desktop, pouco contexto ao comparar jogadores, navegação entre partidas sem informações de status logo acima do player, espaços mortos em resoluções largas e leitura compactada em 320–390px. Essas são hipóteses de design **para validar com screenshots**, não bugs confirmados por auditoria visual nesta rodada.
- **Prancha original recuperada:** o usuário anexou em 22/11/2026 o ZIP `SVG Pac-Man · Identidade e sistema de design-project.zip` contendo `canvas.json` e os artboards `.dc.html`. É referência para o estilo, **não screenshot atual da produção**; jogadores fictícios em colchetes jamais devem virar dados da aplicação.

## 2. Direção visual que recomendo
**“Arcade editorial, não cassino neon”.** Visual de produto de dados com detalhes de videogame:
- 80% do espaço deve ser dedicado a **dados, histórico e partida**. Pixel art é detalhe de identidade, **não** uma textura cobrindo tudo.
- Uma ação principal por tela: no ranking, **ver o líder/uma partida**; no perfil, **abrir a partida selecionada**; na página do dia, **assistir a animação**.
- Usar amarelo `#FFD23F` para foco primário, liderança e CTA; ciano `#00E5FF` para links e comparação/média; cinzas neutros para divisórias. Não colocar cards inteiros amarelos nem vários destaques concorrentes.
- Nunca atribuir “ao vivo”, “replay fiel”, “carregando” ou pontuações sem relação com o backend. O status exibido na interface deve representar o estado real: **replay conferido**, **reconstrução histórica** ou **indisponível**.
- Manter fundo `#0B0D12`, superfície `#161A22`, texto `#E8EAF0`, auxiliar `#9AA3B2` e fio `#2A303C`. Preferir tokens atuais; qualquer nova tonalidade exige teste de contraste.

## 3. Sistema visual
| Token/componente | Especificação recomendada |
|---|---|
| Contêiner | `max-width: 1200px` somente no ranking/histórico quando houver dados suficientes; páginas com texto usam `max-width: 800–960px`. Não esticar linhas de texto por toda a tela |
| Grade | Desktop 12 colunas, `gap: 24px`; tablet 6 colunas; mobile 1 coluna; medidas em `minmax(0,1fr)` para evitar overflow |
| Espaçamento | Preservar múltiplos de 4px e escala atual 4/8/12/16/24/32/48; seções separadas por 32–48px, campos por 8–16px |
| Superfícies | Cards com raio 12px, borda 1px, sem sombra pesada nem vidro/transparência; áreas densas usam divisórias internas em vez de cartão dentro de cartão |
| Tipo | Silkscreen só para marca e pequenos indicadores arcade; Space Grotesk para títulos; Inter no corpo; JetBrains Mono para placares e datas. Máximo de duas famílias por bloco |
| Placares | `font-variant-numeric: tabular-nums`, alinhamento à direita, rótulos curtos, unidade explícita para eficiência/tempo |
| Ícones | Monocromáticos e pequenos; preferir SVG local com aria-hidden quando decorativo; não usar emoji como único rótulo |
| Interação | Estado normal/hover/foco/ativo/desabilitado; foco visível ciano `2px`; alvos de toque mínimos `44 × 44px`; controles sem JS quando puder |
| Movimentação | Transições discretas 150ms, desligadas em `prefers-reduced-motion`; nunca animar números ou trocar posições sem comando do usuário |
| Estados | Loading, vazio, erro, sem replay e reconstrução histórica têm mensagens distintas e CTA de recuperação contextual |

## 4. Ranking (`/`) — arquitetura e hierarquia
**Objetivo do usuário:** entender quem lidera, em qual recorte e abrir um jogador, em poucos segundos.

### Desktop (≥1024px)
```text
[marca]                  [Ranking] [Como entrar] [GitHub]
Ranking de partidas             atualizado até dd/mm UTC
[descrição curta, até 2 linhas]
[Métrica: Pontos | Eficiência]  [Período: Último dia | 7 dias | Recorde]
┌──────────────────────────────────────────────────────────────┐
│ #   Jogador         Pontos    Eficiência   Fantasmas   Mortes │
│ 1   avatar + login   69.990      2,9           10         0   │
│ 2   ...                ...       ...           ...        ...  │
└──────────────────────────────────────────────────────────────┘
[Como funciona o ranking?] [Quero participar →]
```
Os números no desenho são ilustrativos, **nunca dados de interface**.
- Largura do conteúdo deve seguir a tabela; sem barra lateral vazia. Em resolução ≥1440, usar 1120–1200px **apenas se melhorar a densidade**.
- Tabela com primeira coluna (#) estreita, login flexível com avatar, **métrica ativa mais forte**, secundárias sem competir. Cabeçalho legível e unidade de duração visível. Mantenha linhas com 56–64px de altura, hover sutil e clique no login. Não tornar a linha inteira um link se isso prejudicar a semântica da tabela.
- Colocar o último dia de atualização **perto dos filtros**, não no fim. “Hoje” significa último dia UTC completo; preferir texto “Último dia”.
- Se houver poucos participantes, **não inventar rankings, gráficos ou cards adicionais** para preencher espaço. Centralizar a tabela na largura funcional e usar a seção “Como entrar” como conteúdo útil, sem faixa vazia.

### Mobile (320–767px)
- Empilhar título, contexto, métrica e período. Filtros podem rolar na horizontal **internamente**, com indicador de mais conteúdo e largura de toque de 44px. A página inteira não pode rolar horizontalmente.
- Cada participante: **posição + avatar + login** na primeira linha; **placar ativo** destacado na direita; detalhe “fantasmas · mortes · duração” embaixo. Não tentar comprimir sete colunas.
- Avatar entre 32–40px; número principal 20–24px, mono tabular, com truncamento do login e título acessível. Sem esconder participantes ou mudar a ordem do ranking no mobile.

## 5. Perfil do jogador (`/jogador/:login`)
**Ordem de leitura:** voltar → identidade → números resumidos → gráfico → histórico e navegação.
- Cabeçalho do jogador: avatar 56–64px, login, período desde entrada, número de partidas; evitar grande espaço à direita do avatar.
- Quatro KPIs em uma linha em desktop (**último dia, eficiência, recorde, média 30d**) com as mesmas alturas, cada um com rótulo curto, valor principal e nota/contexto. Mobile: **grade 2 × 2**, não quatro faixas altas nem card horizontal com overflow.
- Gráfico “Pontos por dia”: fundo neutro, linha amarela, média ciano tracejada, grade discreta. **Nunca ligar dias sem partida**; tooltip/foco não deve ser requisito para entender os dados. Resumo textual acessível já existe e deve continuar.
- Adicionar filtro SSR por URL `?periodo=30d|90d|todos` **em PR separado** após validar performance com centenas de partidas; não criar dropdown decorativo. Datas de início/fim devem coincidir com os pontos efetivamente desenhados.
- Lista de partidas: cada `<summary>` mostra **data, pontos e situação**, com seta à direita; detalhes mostram SVG na proporção original, atalhos “abrir partida” / “ver publicado”, e mensagem de fallback. Use separadores ou cartões sutis; evitar dezenas de cartões com borda espessa competindo com o gráfico.
- A paginação precisa exibir “Página x de y” e manter a data/hierarquia ao navegar.

## 6. Partida (`/jogador/:login/:data`)
**O replay é protagonista.** Priorizar arena antes dos números secundários.
- Linha 1: “Voltar ao jogador”, data central e setas anterior/próximo nas extremidades; cada seta 44px; desabilitar semanticamente quando não houver dia.
- Logo abaixo, uma única indicação de integridade:
  - **Replay verificado:** somente se o backend tiver comparado efetivamente a animação aos dados salvos.
  - **Reconstrução histórica:** para partidas sem snapshot; esclarecer que o calendário atual pode divergir do placar.
  - **Indisponível:** mensagem não técnica com ação “Ver como foi publicado” quando existir.
- Área do SVG deve ocupar a largura útil com `width: 100%; height: auto; aspect-ratio: 1166 / 229`, fundo integrado e padding que não esprema o jogo. Em mobile, explorar **zoom opcional e controlado**, sem redimensionamento que dificulte a leitura de células; nunca forçar scroll horizontal na página.
- O seletor de tema é secundário, abaixo do replay, preserva a data e mantém foco/estado selecionado. Não criar oito botões enormes, porque desloca o jogo para baixo.
- Placares em grade adaptativa (desktop 6 colunas, tablet 3 × 2, mobile 2 × 3), título curto e valor tabular.
- O link “Ver como foi publicado” fica próximo aos metadados e com rótulo explícito de **banner original**, não confundido com replay atual.
- **Importante:** atualmente a página sinaliza “snapshot disponível” antes de servir o SVG. **Não rebatizar isso como “replay verificado” até existir confirmação de execução da API.**

## 7. Página do banner publicado
- Título “Banner publicado em dd/mm” e explicação de que foi gerado com o motor/tema da época.
- SVG original em destaque, um link externo para arquivo e retorno à partida no mesmo lugar de navegação.
- Não exibir comparação de placar exato entre motores sem dados equivalentes. É preferível explicar a origem histórica do que simular precisão.

## 8. Estados e respostas de erro
- **Carregando SVG:** reservar altura da arena para impedir salto de layout; nunca desenhar um spinner infinito se a requisição falhar.
- **Falha do GitHub:** dados de ranking previamente salvos continuam visíveis; não reexecutar insistentemente 401/429.
- **Divergência:** API não deve retornar SVG com placar diferente. Interface apresenta mensagem e caminho para banner original ou histórico.
- **Cache frio:** o usuário vê a área reservada até chegar a animação; múltiplos pedidos devem compartilhar render, mas nunca contornar o limite de fila.
- **Dia sem partida:** explicar o motivo sem mostrar placar zerado como partida válida.
- **Sem participantes:** explicar o processo do PR para entrar sem exemplos falsos.

## 9. QA visual e de acessibilidade — critérios de aceite
- Capturas/Playwright no **Chrome/Firefox/WebKit** em **320, 360, 390, 430, 768, 1024 e 1440px**. Se o ambiente não suportar algum navegador, registrar a exceção (não afirmar que passou).
- Comparar página principal, perfil com 1 e com >300 partidas, partida com snapshot, partida antiga, falha de render e banner publicado.
- Em cada largura: nenhum elemento ultrapassa a largura do documento; textos não sobrepõem botões; SVG preserva proporção; nenhum componente obrigatório fica fora do fluxo.
- Teclado: tabulação em ordem, `aria-current` nos filtros, foco visível, `<summary>` acionável; nomes de avatar decorativo `alt=""`.
- Verificar **WCAG 2.2 AA** para contraste normal ≥4,5:1, texto grande ≥3:1 e elementos operáveis relevantes ≥3:1; respeitar escala de texto 200% e movimento reduzido.
- Medir LCP/CLS e custo de imagens; não sacrificar carregamento para colocar animações decorativas. Preferir fontes existentes, evitar dependências grandes.
- Visual nunca depende exclusivamente da cor para indicar posição, situação ou série do gráfico.

## 10. Implementação sugerida em PRs pequenos
1. **V1 · Hierarquia/ranking:** `views/ranking.ts`, `site/public/site.css` e testes de filtros. Capturas antes/depois em 320/390/1024/1440. Sem mudanças no motor.
2. **V2 · Perfil/histórico:** KPIs 2×2 no mobile, gráfico responsivo, estados da lista e paginação. Não mudar regras de score.
3. **V3 · Partida:** arena proporcional, navegação e status de replay **baseado no backend**, tema e placar adaptativos. Tratar falha de API sem mostrar SVG inconsistente.
4. **V4 · Acessibilidade transversal:** audit de navegação por teclado, zoom 200%, contraste e movimento reduzido em SVG/SMIL; browser matrix.
5. **V5 · Prancha persistente:** criar imagens de referência *a partir da UI real* e salvar em `docs/design/` com indicação de versão/viewport. Proibido depender apenas de artefatos temporários.

## 11. O que NÃO fazer
- Não adicionar painéis vazios, cartões genéricos, “estatísticas em tempo real” inexistentes ou jogos falsos para ocupar o espaço.
- Não trocar identidade por **neon sobre neon** ou parede de efeitos retro; animação é o próprio Pac-Man.
- Não transformar listagem num carrossel: perfil, comparações e datas precisam continuar encontráveis e acessíveis.
- Não quebrar `/api/*`, URLs compartilhadas, `<details>` sem JS, tags de SEO, tema e pontuação existentes.
- Não apagar assets herdados sem rastrear referências e licenças antes.
- Não afirmar testes manuais/navegadores executados apenas por existir checklist.

## Definição de pronto para a fase visual
Cada PR deve conter screenshots de antes/depois, lista de viewports testados, resultado de CI, alterações acessíveis, eventuais regressões e atualização do `PROXIMOS_PASSOS.md`. **A V1 do ranking tem código e testes no PR #18; V2–V5 continuam planejadas. Capturas e auditoria visual cross-browser ainda são pendentes.**
