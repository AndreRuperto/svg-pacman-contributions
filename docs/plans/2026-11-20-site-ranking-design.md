# Site do ranking: desenho

Data: 2026-11-20 · Branch: `claude/site-ranking`

Um site com duas coisas: o histórico das partidas de cada jogador e um ranking entre todos.

## Decisões

| Tema | Decisão | Por quê |
|------|---------|---------|
| Entrada no ranking | Lista em `ranking/jogadores.json`, por PR | Moderação pelo merge; sem login, OAuth nem cadastro para manter. Dá para trocar por cadastro no site depois. |
| Métrica | Duas abas: **Pontos** e **Eficiência** (pontos ÷ células com contribuição) | Pontos é o placar do banner; eficiência compara jogadores com volumes de commit diferentes. |
| Histórico | Recalcular todos os dias com o jogo atual | Mesmas regras para todos (o jogo antigo tinha bugs de pontuação), vale para qualquer jogador, números exatos. |
| SVGs já publicados | Link "ver como foi publicado" nos dias do perfil de André | Mostra o que de fato apareceu no README, sem misturar com os números recalculados. |
| Hospedagem | Railway: serviços `web` e `cron` + Postgres | Escolha do usuário. |
| Dia do ranking | O último dia completo em UTC (a véspera); o dia corrente nunca é jogado. A aba "Hoje" vira "Último dia" e mostra a data | O dia corrente ainda ganha contribuições: jogá-lo daria números que mudam e uma partida diferente da final. |
| Confiança | O servidor roda o jogo, ninguém envia números | O jogo é determinístico (semente `login:AAAA-MM-DD`): mesmos dados, mesma partida. |

Há 588 versões de `dist/pacman-contribution-graph-dark.svg` na branch `output` de `AndreRuperto/AndreRuperto`, de 2025-04-08 a 2026-11-19, e 4 de `-brasa.svg`. Elas não têm placar: o bundle antigo da Action não gerava.

## Parte 1: arquitetura

- **Monorepo:** pasta `site/` neste repositório; o site importa o motor de `src/`.
- **`web`** (Node + Hono):
  - serve as páginas;
  - API somente leitura: `GET /api/ranking?aba=pontos|eficiencia&periodo=hoje|7d|recorde`, `GET /api/jogador/:login`, `GET /api/partida/:login/:data?tema=`.
- **`cron`** (Railway Cron, diário por volta de 1h UTC):
  1. lê `ranking/jogadores.json` da `main`;
  2. para cada jogador, joga o dia;
  3. para jogador novo, preenche o histórico: 365 dias, ou desde 2025-04-08 para `AndreRuperto`.
- **Postgres:**
  - `jogadores(login, adicionado_em, ativo)`
  - `partidas(login, data, pontos, fantasmas, mortes, maior_combo, quadros, celulas, eficiencia, interrompida, versao_motor, criado_em)`, com `PRIMARY KEY(login, data)`.
- **SVG da partida:** gerado sob demanda e guardado num cache LRU em memória (até 200 itens). O banco guarda só números.
- **GitHub:** GraphQL `contributionsCollection(from, to)` com a janela do ano que terminava no dia jogado. Token de leitura pública em variável do Railway.

Alternativas descartadas:
- calcular nas GitHub Actions e enviar ao Railway: exige um segredo de escrita e dois lugares rodando o jogo;
- SQLite num volume: backup e acesso pelos dois serviços ficam mais difíceis.

## Parte 2: telas e dados

Telas desenhadas primeiro na prancha ("SVG Pac-Man · Identidade e sistema de design"), no celular (390 × 844) e no computador, com os tokens existentes.

1. **Ranking** (`/`):
   - abas Pontos e Eficiência;
   - períodos Hoje, 7 dias (média) e Recorde;
   - linhas com posição, avatar, login, métrica, fantasmas, mortes e duração; no celular, viram cartões;
   - rodapé "Como entrar no ranking".
2. **Jogador** (`/jogador/:login`):
   - posição hoje nas duas abas, recorde e média de 30 dias;
   - gráfico de pontos por dia;
   - lista de partidas com "ver a partida" e, nos dias de André, "ver como foi publicado".
3. **Partida** (`/jogador/:login/:data`): SVG do dia no tema escolhido, placar e navegação para o dia anterior e o seguinte.

Fluxo:
- o `cron` grava as partidas;
- o `web` só lê;
- um jogador removido da lista some do ranking, mas as partidas dele continuam no banco.

## Parte 3: falhas, testes e deploy

Falhas:
- **Login inexistente:** aviso no log e o login é pulado; a página mostra "Não encontrei @login no GitHub".
- **Dia sem contribuições:** não grava partida; o histórico mostra "sem jogo".
- **Limite da API:** o cron lê o saldo e para antes de zerar. Cada partida é gravada ao terminar, e a rodada seguinte continua de onde parou.
- **Partida com 6000 quadros:** gravada com `interrompida = true` e fora do recorde.
- **Mudança de regras:** `versao_motor` vem do `package.json`; quando muda, o cron recalcula aos poucos e o site avisa "recalculando".
- **Proteção do `web`:** só aceita logins da lista, o cache tem limite e a rota da partida tem limite de pedidos por IP.

Testes (Vitest):
- **Unidade:** eficiência, períodos, ordem com empates (menos mortes, depois login), validação da lista, janela de contribuições de um dia passado.
- **Integração do cron:** Postgres de teste e GitHub simulado. Confere que um jogador novo ganha o histórico, que rodar duas vezes não duplica e que o limite da API faz a rodada parar e continuar depois.
- **API:** as três rotas, incluindo login fora da lista (404).
- **Tela:** conferência no navegador, no celular e no computador.

Deploy:
- dois serviços Railway a partir da `main`, com os comandos `site:web` e `site:cron`;
- Postgres do Railway;
- variáveis `DATABASE_URL` e `GITHUB_TOKEN`;
- o CI atual também roda os testes do site.

## Fora do escopo

Cadastro pelo site, comentários, notificações, ranking por tema ou estilo de jogador.
