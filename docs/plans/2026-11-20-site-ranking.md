# Site do ranking: plano de implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Um site no Railway com o histórico de partidas de cada jogador e um ranking entre todos, alimentado por um cron que roda o próprio jogo.

**Architecture:**
- **Motor:** ganha `config.date` para jogar qualquer dia e um `playDay()` sem rede que devolve os números da partida.
- **`site/` (Node + Hono):**
  - um `cron` busca as contribuições de cada jogador da lista, joga os dias que faltam e grava num repositório de partidas (Postgres em produção, memória nos testes);
  - um `web` renderiza as três telas no servidor (sem framework de front, sem passo de build) e uma API JSON somente leitura.

**Tech Stack:** TypeScript (ESM, imports com `.js`), Vitest, Hono + `@hono/node-server`, `postgres` (porsager), `tsx` para rodar, Railway (serviços `web` e `cron` + Postgres). Desenho: `docs/plans/2026-11-20-site-ranking-design.md`. Telas: prancha "SVG Pac-Man · Identidade e sistema de design" (quadros "Site 1–3").

**Convenções:**
- Rodar tudo na raiz do worktree, na branch `claude/site-ranking`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Depois de cada task, `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm test` precisam passar antes do commit.
- Código do site em `site/src/`, testes em `tests/site/`. `tsconfig.json` passa a incluir `site`.
- Datas sempre `AAAA-MM-DD` em UTC.

---

### Task 1: O motor joga qualquer dia (`config.date`)

**Files:**
- Modify: `src/types.ts` (`Config.date?: string`)
- Modify: `src/utils/utils.ts` (`buildGrid`, `buildMonthLabels`)
- Modify: `src/index.ts` (semente usa a data)
- Test: `tests/game-date.test.ts`

**Step 1: Teste**
```ts
import { describe, it, expect } from 'vitest';
import { buildGrid, buildMonthLabels, gridWindow } from '../src/utils/utils.js';
import { makeStore } from './helpers.js';

describe('jogar um dia passado', () => {
  it('a janela termina no dia pedido e começa num domingo, ~1 ano antes', () => {
    const { start, end } = gridWindow('2025-06-15');
    expect(end.toISOString().slice(0, 10)).toBe('2025-06-15');
    expect(start.getUTCDay()).toBe(0);
    expect((end.getTime() - start.getTime()) / 86400000).toBeGreaterThanOrEqual(365);
  });
  it('buildGrid posiciona contribuições pela janela do dia pedido', () => {
    const store = makeStore({ config: { date: '2025-06-15' } });
    store.contributions = [{ date: new Date('2025-06-15T00:00:00Z'), count: 3, color: '', level: 'THIRD_QUARTILE' }];
    buildGrid(store);
    const last = store.grid[store.grid.length - 1];
    expect(last[0].level).toBe('THIRD_QUARTILE'); // 2025-06-15 é domingo
  });
  it('os meses terminam no mês do dia pedido', () => {
    const store = makeStore({ config: { date: '2025-06-15' } });
    buildMonthLabels(store);
    expect(store.monthLabels.filter(Boolean).at(-1)).toBe('jun.');
  });
});
```

**Step 2:** `pnpm test tests/game-date.test.ts` → FAIL (`gridWindow` não existe).

**Step 3: Implementação**
- `Config`: `date?: string; // AAAA-MM-DD, padrão = hoje (UTC)`.
- Em `utils.ts`:
```ts
/** Janela do gráfico de um dia: termina no dia, começa no domingo de ~1 ano antes. */
export const gridWindow = (date?: string) => {
  const end = date ? new Date(`${date}T00:00:00Z`) : truncateToUTCDate(new Date());
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 365);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return { start, end };
};
```
- `buildGrid` e `buildMonthLabels` trocam o cálculo de `endDate`/`startDate` por `const { start: startDate, end: endDate } = gridWindow(store.config.date);`.
- `src/index.ts`: `defaultSeed(username, config.date ? new Date(\`${config.date}T00:00:00Z\`) : undefined)`.

**Step 4:** Os testes passam. **Step 5: Commit** com a mensagem `feat(motor): jogar qualquer dia com config.date`.

---

### Task 2: Contribuições de uma janela + saldo da API

**Files:**
- Modify: `src/providers/github-contributions.ts`
- Test: `tests/provider.test.ts`

**Step 1: Teste.** Usar `vi.stubGlobal` não funciona com `node-fetch`, então a função passa a receber `fetchImpl` opcional.
```ts
import { describe, it, expect } from 'vitest';
import { fetchContributionsWindow } from '../src/providers/github-contributions.js';

const resposta = {
  data: {
    rateLimit: { remaining: 4321, resetAt: '2026-11-20T15:00:00Z' },
    user: { contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: [
      { date: '2025-06-15', contributionCount: 2, color: '#40c463', contributionLevel: 'SECOND_QUARTILE' }
    ] }] } } }
  }
};

describe('fetchContributionsWindow', () => {
  it('envia from/to da janela do dia e devolve contribuições e saldo', async () => {
    let body: any;
    const fake = async (_url: string, init: any) => { body = JSON.parse(init.body); return { ok: true, json: async () => resposta } as any; };
    const r = await fetchContributionsWindow('ana', '2025-06-15', 'tok', fake);
    expect(body.variables.to).toBe('2025-06-15T23:59:59Z');
    expect(body.variables.from.slice(0, 10) < '2024-06-16').toBe(true);
    expect(r.contributions).toHaveLength(1);
    expect(r.contributions[0].level).toBe('SECOND_QUARTILE');
    expect(r.rateLimit.remaining).toBe(4321);
  });
  it('usuário inexistente vira erro com código', async () => {
    const fake = async () => ({ ok: true, json: async () => ({ data: { user: null, rateLimit: { remaining: 10, resetAt: '' } } }) }) as any;
    await expect(fetchContributionsWindow('nao-existe-xyz', '2025-06-15', 'tok', fake)).rejects.toThrow('USUARIO_NAO_ENCONTRADO');
  });
});
```

**Step 2:** Rodar o teste → FAIL.

**Step 3: Implementação**
- Nova função exportada `fetchContributionsWindow(login, date, token, fetchImpl = fetch)`.
- Consulta com `$from: DateTime!, $to: DateTime!`, `rateLimit { remaining resetAt }` e `user(login) { contributionsCollection(from: $from, to: $to) { contributionCalendar { weeks { contributionDays { date contributionCount color contributionLevel } } } } }`.
- `from` = `gridWindow(date).start.toISOString()` e `to` = `${date}T23:59:59Z`.
- `user` nulo → `throw new Error('USUARIO_NAO_ENCONTRADO')`.
- Resposta HTTP não ok → `throw new Error(\`GITHUB_${status}\`)`.
- Devolve `{ contributions: Contribution[] (color vazio), rateLimit: { remaining, resetAt } }`.
- A função atual `fetchGithubContributionsGraphQL` passa a chamar a nova com a data de hoje, para que a Action continue igual.

**Step 4:** Rodar o teste → PASS. Rodar também `pnpm test`, que deve continuar todo verde.

**Step 5: Commit** com a mensagem `feat(provedor): contribuições de qualquer janela e saldo da API`.

---

### Task 3: `playDay()` — uma partida sem rede, com os números

**Files:**
- Create: `src/runner.ts`
- Modify: `src/core/game.ts`: guardar `store.statistics.interrupted = true` quando bater `MAX_FRAMES`.
- Modify: `src/types.ts`: `GameStatistics.interrupted?: boolean`.
- Modify: `package.json`: `version` para `1.1.0`.
- Test: `tests/runner.test.ts`

**Step 1: Teste**
```ts
import { describe, it, expect } from 'vitest';
import { playDay, ENGINE_VERSION } from '../src/runner.js';
import type { Contribution } from '../src/types.js';

const contribs = (date: string): Contribution[] => Array.from({ length: 40 }, (_, i) => {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - i * 3);
  return { date: d, count: 1 + (i % 4), color: '', level: (['FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'] as const)[i % 4] };
});

describe('playDay', () => {
  it('devolve os números da partida e as células do dia', async () => {
    const r = await playDay({ login: 'ana', date: '2025-06-15', contributions: contribs('2025-06-15') });
    expect(r.celulas).toBe(40);
    expect(r.pontos).toBeGreaterThan(0);
    expect(r.eficiencia).toBeCloseTo(r.pontos / r.celulas, 5);
    expect(r).toMatchObject({ login: 'ana', data: '2025-06-15', versao_motor: ENGINE_VERSION, interrompida: false });
  });
  it('é determinístico: mesmo login e dia, mesma partida', async () => {
    const a = await playDay({ login: 'ana', date: '2025-06-15', contributions: contribs('2025-06-15') });
    const b = await playDay({ login: 'ana', date: '2025-06-15', contributions: contribs('2025-06-15') });
    expect(a).toEqual(b);
  });
  it('sem contribuições não há partida', async () => {
    expect(await playDay({ login: 'ana', date: '2025-06-15', contributions: [] })).toBeNull();
  });
  it('pode devolver o SVG da partida', async () => {
    const r = await playDay({ login: 'ana', date: '2025-06-15', contributions: contribs('2025-06-15'), theme: 'neon', withSvg: true });
    expect(r!.svg).toMatch(/^<svg/);
  });
});
```

**Step 2:** Rodar o teste → FAIL.

**Step 3: Implementação** de `src/runner.ts`:
- Lê `ENGINE_VERSION` do `package.json` com `createRequire(import.meta.url)('../package.json').version`.
- Monta o store como em `src/index.ts`, mas sem rede:
  1. clona `Store`;
  2. `config = { platform: 'github', username: login, date, outputFormat: 'svg', gameTheme: theme ?? 'github-dark', gameSpeed: 1, playerStyle: style, … }`;
  3. `rng = createRng(\`${login}:${date}\`)`;
  4. `contributions`;
  5. `Grid.buildWalls()`, `Utils.buildGrid` e `Utils.buildMonthLabels`.
- `celulas` = número de células com `level !== 'NONE'` depois de `buildGrid`. Se for 0, devolve `null`.
- Roda `Game.startGame(store)` e espera o `gameOverCallback` numa Promise.
- Devolve `{ login, data, pontos, fantasmas, mortes, maior_combo, quadros: store.gameHistory.length, celulas, eficiencia: pontos / celulas, interrompida: !!statistics.interrupted, versao_motor, svg? }`. O `svg` só vem quando `withSvg` é verdadeiro.
- O tipo `Partida` é exportado daqui, e o site o reusa.

**Step 4:** Rodar o teste → PASS.

**Step 5: Commit** com a mensagem `feat(motor): playDay roda uma partida sem rede e devolve os números`.

---

### Task 4: Domínio do ranking (funções puras)

**Files:**
- Create: `site/src/ranking.ts`
- Test: `tests/site/ranking.test.ts`

**Step 1: Teste**
```ts
import { describe, it, expect } from 'vitest';
import { rankPlayers } from '../../site/src/ranking.js';
import type { Partida } from '../../src/runner.js';

const p = (login: string, data: string, pontos: number, celulas = 100, mortes = 0, interrompida = false): Partida =>
  ({ login, data, pontos, fantasmas: 0, mortes, maior_combo: 0, quadros: 900, celulas, eficiencia: pontos / celulas, interrompida, versao_motor: '1.1.0' });

const jogos = [
  p('ana', '2026-11-20', 900), p('bia', '2026-11-20', 900, 50, 2), p('caio', '2026-11-20', 500, 10),
  p('ana', '2026-11-19', 5000, 100, 0, true), p('bia', '2026-11-14', 9000), p('caio', '2026-11-15', 100, 10)
];

describe('rankPlayers', () => {
  it('hoje por pontos, empate desfeito por menos mortes e depois login', () => {
    expect(rankPlayers(jogos, { aba: 'pontos', periodo: 'hoje', hoje: '2026-11-20' }).map(r => r.login)).toEqual(['ana', 'bia', 'caio']);
  });
  it('hoje por eficiência', () => {
    expect(rankPlayers(jogos, { aba: 'eficiencia', periodo: 'hoje', hoje: '2026-11-20' }).map(r => r.login)).toEqual(['caio', 'bia', 'ana']);
  });
  it('7 dias = média das partidas de hoje-6 a hoje', () => {
    const r = rankPlayers(jogos, { aba: 'pontos', periodo: '7d', hoje: '2026-11-20' });
    expect(r.find(x => x.login === 'caio')!.valor).toBe(300);
    expect(r.find(x => x.login === 'bia')!.valor).toBe(4950);
  });
  it('recorde ignora partida interrompida', () => {
    const r = rankPlayers(jogos, { aba: 'pontos', periodo: 'recorde', hoje: '2026-11-20' });
    expect(r.find(x => x.login === 'ana')!.valor).toBe(900);
    expect(r[0].login).toBe('bia');
  });
  it('posições numeradas a partir de 1', () => {
    expect(rankPlayers(jogos, { aba: 'pontos', periodo: 'hoje', hoje: '2026-11-20' }).map(r => r.posicao)).toEqual([1, 2, 3]);
  });
});
```

**Step 2:** Rodar o teste → FAIL.

**Step 3: Implementação**

`rankPlayers(partidas, { aba, periodo, hoje })` devolve `{ posicao, login, valor, partida }[]`, onde `partida` é a referência para fantasmas, mortes e duração:
- **`hoje`:** as partidas de `data === hoje`.
- **`7d`:** agrupa por login as partidas entre `hoje-6` e `hoje`. O valor é a média da métrica, e `partida` é a mais recente.
- **`recorde`:** a melhor partida de cada login com `!interrompida`.

A métrica é `pontos` ou `eficiencia`, conforme a aba. A ordem é valor decrescente, depois mortes crescente, depois login crescente.

**Step 4:** Rodar o teste → PASS.

**Step 5: Commit** com a mensagem `feat(site): regras do ranking (abas, períodos, empates)`.

---

### Task 5: Lista de jogadores

**Files:**
- Create: `ranking/jogadores.json`
- Create: `site/src/jogadores.ts`
- Test: `tests/site/jogadores.test.ts`

**Step 1: `ranking/jogadores.json`**
```json
{
  "jogadores": [
    {
      "login": "AndreRuperto",
      "desde": "2025-04-08",
      "publicado": { "repo": "AndreRuperto/AndreRuperto", "branch": "output", "path": "dist/pacman-contribution-graph-dark.svg" }
    }
  ]
}
```

**Step 2: Teste.** `parseJogadores(json)` deve:
- aceitar o arquivo acima;
- recusar um login inválido (regex `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`), devolvendo erro com o índice;
- recusar logins duplicados, sem diferenciar maiúsculas;
- aceitar uma entrada sem `desde` nem `publicado`, usando `desde` = hoje − 364;
- recusar `desde` com formato de data inválido.

`loadJogadores({ path })` lê o arquivo local. Em produção, `loadJogadores({ url })` busca `https://raw.githubusercontent.com/AndreRuperto/svg-pacman-contributions/main/ranking/jogadores.json`.

**Step 3: Implementação** sem bibliotecas novas: validação manual, com mensagens em português.

**Step 4:** Rodar o teste → PASS.

**Step 5: Commit** com a mensagem `feat(site): lista de jogadores em ranking/jogadores.json`.

---

### Task 6: Repositório de partidas (memória + Postgres)

**Files:**
- Create: `site/src/repo.ts` (interface + `MemoryRepo`)
- Create: `site/src/repo-pg.ts` (`PgRepo`, usando a lib `postgres`)
- Create: `site/sql/001_schema.sql`
- Test: `tests/site/repo.test.ts`

**Step 1:** `pnpm add postgres` (hono e `@hono/node-server` entram na Task 8)

**Step 2: Schema** (`site/sql/001_schema.sql`). A chave é `login_key` = `lower(login)`, para que `Ana` e `ana` nunca virem dois jogadores; `login` guarda a grafia da lista.
```sql
CREATE TABLE IF NOT EXISTS partidas (
  login_key text NOT NULL, login text NOT NULL, data date NOT NULL,
  pontos integer NOT NULL, fantasmas integer NOT NULL, mortes integer NOT NULL, maior_combo integer NOT NULL,
  quadros integer NOT NULL, celulas integer NOT NULL, eficiencia double precision NOT NULL,
  interrompida boolean NOT NULL DEFAULT false, versao_motor text NOT NULL,
  publicado_sha text, criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (login_key, data), CHECK (login_key = lower(login))
);
CREATE INDEX IF NOT EXISTS partidas_data ON partidas (data);
-- dias cuja janela não tem contribuição (playDay → null): o cron não os busca de novo na mesma versão
CREATE TABLE IF NOT EXISTS dias_sem_jogo (
  login_key text NOT NULL, data date NOT NULL, versao_motor text NOT NULL,
  PRIMARY KEY (login_key, data)
);
```
Os jogadores não ganham tabela: a lista vem sempre do arquivo, e assim um jogador removido some do ranking sem apagar as partidas dele.

**Step 3: Interface**
```ts
export interface PartidaRepo {
  upsert(p: Partida & { publicado_sha?: string | null }): Promise<void>;
  porJogador(login: string): Promise<PartidaSalva[]>;       // ordem: data desc
  entre(de: string, ate: string, logins: string[]): Promise<Partida[]>;
  todasDe(logins: string[]): Promise<Partida[]>;            // para 'recorde'
  datasExistentes(login: string, versao: string): Promise<Set<string>>;
  marcarPublicado(login: string, data: string, sha: string): Promise<void>;
  marcarSemJogo(login: string, data: string, versao: string): Promise<void>;
  diasSemJogo(login: string, versao: string): Promise<Set<string>>;
}
```

**Step 4: Teste** de um contrato único que roda contra o `MemoryRepo` sempre e contra o `PgRepo` só se existir `TEST_DATABASE_URL`, com `describe.skipIf`. Ele cobre:
- `upsert` duas vezes não duplica;
- `datasExistentes` filtra pela versão;
- `entre` respeita o intervalo e os logins;
- `porJogador` vem em ordem.

**Step 5: Implementação.**
- `MemoryRepo` usa um `Map` com a chave `lower(login)|data`.
- `PgRepo` usa `sql\`INSERT … ON CONFLICT (login_key, data) DO UPDATE SET …\``; um upsert sem `publicado_sha` mantém o sha gravado.
- `PgRepo.migrate()` executa o `001_schema.sql`.

**Step 6:** Rodar o teste → PASS.

**Step 7: Commit** com a mensagem `feat(site): repositório de partidas (memória e Postgres)`.

---

### Task 7: Cron

**Files:**
- Create: `site/src/cron.ts`, com `runCron(deps)` testável e `main()` que liga as dependências reais.
- Test: `tests/site/cron.test.ts`

**Step 1: Teste**, com `MemoryRepo`, um `fetchWindow` falso e `hoje` fixo:
- **jogador novo:** joga cada dia de `desde` até `hoje`. O `fetchWindow` falso conta as chamadas e devolve contribuições fixas.
- **segunda rodada:** não chama o `fetchWindow` de novo e não duplica partidas.
- **saldo da API:** quando `rateLimit.remaining` cai abaixo de `RESERVA = 50`, a rodada para e devolve `{ parou: 'limite' }`. A rodada seguinte continua de onde parou.
- **login inexistente:** com `USUARIO_NAO_ENCONTRADO`, o login é pulado, o resultado registra o aviso e os outros jogadores são jogados normalmente.
- **dia sem contribuições:** `playDay` devolve `null` e nada é gravado. Esse dia não deve ser tentado de novo na mesma rodada.
- **mudança de versão:** quando `ENGINE_VERSION` muda, as partidas antigas voltam a ser jogadas. Isso já sai de graça porque `datasExistentes` filtra pela versão.
- **SVG publicado:** um jogador com `publicado` recebe `publicado_sha` para os dias que têm commit naquele caminho. O `listPublished` falso devolve `[{ date: '2026-11-19', sha: 'abc' }]`.

**Step 2:** Rodar o teste → FAIL.

**Step 3: Implementação**

`runCron({ repo, jogadores, hoje, fetchWindow, listPublished, play = playDay, log })`. Para cada jogador:
1. calcula os dias de `desde` até `hoje`, menos os de `datasExistentes(login, ENGINE_VERSION)`, do mais recente para o mais antigo;
2. para cada dia, chama `fetchWindow`, confere o saldo, chama `play` e faz o `upsert`;
3. no fim, se o jogador tem `publicado`, chama `listPublished`, que lista os commits daquele caminho na branch (data UTC do commit e sha), e grava `marcarPublicado`.

O `main()`:
- lê `DATABASE_URL` e `GITHUB_TOKEN`;
- roda `migrate()`;
- carrega a lista pela URL;
- loga um resumo e sai com código 0. Ele só sai com código 1 se faltar uma variável ou se o banco não responder.

**Step 4:** Rodar o teste → PASS.

**Step 5: Commit** com a mensagem `feat(site): cron joga os dias que faltam e respeita o limite da API`.

---

### Task 8: API JSON

**Files:**
- Create: `site/src/app.ts` (`createApp({ repo, jogadores, hoje, renderSvg })`, retorna `Hono`)
- Create: `site/src/cache.ts` (LRU com limite de itens)
- Create: `site/src/ratelimit.ts` (janela fixa por IP)
- Test: `tests/site/api.test.ts` (`app.request('/api/…')`, sem subir servidor)

**Step 1: Testes**
- `GET /api/ranking?aba=pontos&periodo=hoje` → 200, com `{ aba, periodo, hoje, linhas: [{ posicao, login, valor, fantasmas, mortes, quadros }] }`.
- `aba` ou `periodo` inválidos → 400.
- `GET /api/jogador/AndreRuperto` → 200, com `{ login, partidas, recorde, media30, posicaoHoje: { pontos, eficiencia } }`.
- `GET /api/jogador/fulano` (fora da lista) → 404.
- `GET /api/partida/AndreRuperto/2026-11-20?tema=neon`:
  - responde 200 com `content-type: image/svg+xml` e o mesmo SVG que `renderSvg` produz;
  - a segunda chamada vem do cache, ou seja, `renderSvg` foi chamado uma vez só;
  - um tema inválido → 400;
  - um dia sem partida → 404.
- Mais de 30 pedidos por minuto do mesmo IP em `/api/partida` → 429.

**Step 2:** Rodar os testes → FAIL.

**Step 3: Implementação.**
- `renderSvg(login, data, tema)`, em produção:
  1. busca a janela com `fetchContributionsWindow`;
  2. chama `playDay({ …, withSvg: true, theme })`;
  3. devolve o `svg`.
- Nos testes, `renderSvg` é um falso que conta as chamadas.
- O cache LRU guarda até 200 itens, com a chave `login|data|tema`.

**Step 4:** Rodar os testes → PASS.

**Step 5: Commit** com a mensagem `feat(site): API do ranking, do jogador e da partida`.

---

### Task 9: Telas (renderizadas no servidor)

**Files:**
- Create: `site/src/views/layout.ts`, `ranking.ts`, `jogador.ts`, `partida.ts`, que usam `html` de `hono/html` e escapam todo texto vindo de dados.
- Create: `site/public/site.css`, com os tokens da prancha.
- Modify: `site/src/app.ts`: rotas `/`, `/jogador/:login`, `/jogador/:login/:data` e `/static/*`.
- Test: `tests/site/pages.test.ts`

**Step 1: Testes.** O HTML de cada rota deve conter:
- **`/`:**
  - abas e períodos são links `?aba=…&periodo=…` com `aria-current="page"` no ativo;
  - a tabela tem `<th scope="col">`;
  - o link "Como entrar" aponta para `https://github.com/AndreRuperto/svg-pacman-contributions/edit/main/ranking/jogadores.json`.
- **`/jogador/AndreRuperto`:**
  - o gráfico é um `<svg role="img" aria-label="Pontos por dia…">` com um `<polyline>`;
  - cada partida tem o link `/jogador/AndreRuperto/AAAA-MM-DD`;
  - "Ver como foi publicado" aponta para `https://raw.githubusercontent.com/AndreRuperto/AndreRuperto/<sha>/dist/pacman-contribution-graph-dark.svg` e só aparece quando existe `publicado_sha`.
- **`/jogador/AndreRuperto/2026-11-20`:**
  - `<img src="/api/partida/AndreRuperto/2026-11-20?tema=…" alt="Partida de AndreRuperto em 20 nov. 2026">`;
  - um formulário GET com `<label for="tema">` e um `<select>` dos 8 temas;
  - os links do dia anterior e do seguinte têm `aria-label`.
- Um login com `<script>` no nome nunca aparece sem escape. Isso é garantido pela validação da lista, mas o teste confere o escape mesmo assim.

**Step 2: Implementação** seguindo os quadros "Site 1–3" da prancha:
- **Tokens:**
  - cores: fundo `#0B0D12`, superfície `#161A22`, fio `#2A303C`, texto `#E8EAF0`, apoio `#9AA3B2`, acento `#FFD23F`, link e foco `#00E5FF`;
  - raios: cartão 12, campo 10;
  - foco: contorno de 2 px.
- **Fontes:** Silkscreen (marca), Space Grotesk (títulos), Inter (texto) e JetBrains Mono (números), todas pelo Google Fonts.
- **Ranking:** no celular são cartões; a partir de 768 px vira tabela. Os dois vêm do mesmo HTML, alternados por CSS.
- **Botões e links:** toque mínimo de 44 px.
- **Datas por extenso:** `20 nov. 2026`, com os nomes dos meses da `MONTHS`.

**Step 3:** Rodar os testes → PASS.

**Step 4: Commit** com a mensagem `feat(site): telas de ranking, jogador e partida`.

---

### Task 10: Servidores e scripts

**Files:**
- Create: `site/src/web.ts` (`serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) })`, com o repositório Postgres e a lista lida pela URL a cada 10 minutos)
- Modify: `package.json`, com os scripts `"site:web": "tsx site/src/web.ts"`, `"site:cron": "tsx site/src/cron.ts"` e `"site:dev": "tsx watch site/src/web.ts"`
- Modify: `tsconfig.json` (`include` ganha `"site"`)
- Modify: `eslint.config.js` (`site/public/**` fica fora)
- Modify: `.claude/launch.json` (configuração `site` com `pnpm site:dev`, porta 3000)

**Step 1:** Ao rodar `pnpm site:dev` sem `DATABASE_URL`, o servidor deve usar o `MemoryRepo`, populado rodando o cron uma vez com o `fetchWindow` real. Para isso, `GITHUB_TOKEN` precisa estar no ambiente. Se não estiver, o servidor avisa e sobe vazio.

**Step 2: Conferência no navegador** (@qa-frontend):
- abrir `/`, `/jogador/AndreRuperto` e uma partida, a 390 px e a 1280 px;
- conferir com a prancha: foco visível, contraste, nenhuma rolagem horizontal no celular e a animação rodando na tela da partida.

**Step 3: Commit** com a mensagem `feat(site): servidor web, scripts e preview local`.

---

### Task 11: Deploy no Railway

Usar @railway:use-railway. O usuário precisa confirmar cada passo que cria recurso ou altera o deploy.

1. Projeto Railway `svg-pacman-ranking` com um Postgres.
2. Serviço `web`:
   - origem: este repositório, branch `main`;
   - start `pnpm site:web`;
   - variáveis `DATABASE_URL` (referência ao Postgres) e `GITHUB_TOKEN`;
   - domínio gerado.
3. Serviço `cron`:
   - mesmo repositório, start `pnpm site:cron`;
   - Cron Schedule `0 1 * * *`;
   - mesmas variáveis.
4. Pedir ao usuário um token do GitHub. Ele mesmo cola o valor no painel do Railway, que fica em segredo. Para dados públicos, um token clássico sem nenhum escopo basta.
5. Rodar o cron uma vez à mão e conferir nos logs:
   - foram jogadas cerca de 590 partidas de AndreRuperto, ou a rodada parou pelo limite e continua no dia seguinte;
   - o site mostra o ranking.
6. Conferir no navegador o domínio público, nas três telas.

---

### Task 12: CI, docs e entrega

- `.github/workflows/ci.yml` não precisa mudar, porque `pnpm test` já inclui `tests/site`. Conferir que o tempo total segue abaixo de 2 min.
- README: nova seção "🏆 Ranking", com o link do site e como entrar (PR em `ranking/jogadores.json`).
- `PROXIMOS_PASSOS.md`: marcar o site e registrar URL, serviços e variáveis.
- Prancha: trocar os placeholders das telas pelos dados reais, se fizer sentido, e anotar o que mudou na implementação.
- Abrir PR contra a `main` (@superpowers:finishing-a-development-branch). Antes de qualquer push, conferir com `gh pr view` se o PR continua aberto.
