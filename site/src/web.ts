/** Servidor web do ranking (telas + API). Em produção, Postgres; sem `DATABASE_URL`, memória. */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { fetchContributionsWindow } from '../../src/providers/github-contributions.js';
import { playDay } from '../../src/runner.js';
import { createApp } from './app.js';
import { JOGADORES_URL, fetchComTimeout, runCron } from './cron.js';
import { addDays, ultimoDiaCompleto } from './datas.js';
import { loadJogadores, type Jogador, type LoadOptions } from './jogadores.js';
import { listPublished } from './publicados.js';
import { MemoryRepo, type PartidaRepo } from './repo.js';
import { PgRepo } from './repo-pg.js';

/** A lista de jogadores é relida a cada 10 minutos. */
export const RECARGA_MS = 10 * 60_000;
/** Sem banco, o servidor local joga só estes últimos dias, para as telas terem dados. */
export const DIAS_DEV = 14;
/** A lista do próprio repositório, para o servidor local. */
export const JOGADORES_LOCAL = fileURLToPath(new URL('../../ranking/jogadores.json', import.meta.url));

export interface WebConfig {
  porta: number;
  databaseUrl: string | undefined;
  githubToken: string | undefined;
  /**
   * De onde vem a lista: `JOGADORES_URL`, senão a URL da `main`. Sem banco (desenvolvimento),
   * o padrão é o arquivo do repositório, que pode ainda não estar na `main`.
   */
  jogadores: { url: string } | { path: string };
  /** Confiar em `x-real-ip`/`x-forwarded-for`. Padrão: só no Railway. */
  confiarProxy: boolean;
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function configDoAmbiente(env: NodeJS.ProcessEnv): WebConfig {
  const porta = env.PORT ? Number(env.PORT) : 3000;
  if (!Number.isInteger(porta) || porta <= 0 || porta > 65_535) {
    throw new Error(`PORT inválida: ${JSON.stringify(env.PORT)}`);
  }
  const proxy = env.CONFIAR_PROXY?.trim().toLowerCase();
  return {
    porta,
    databaseUrl: env.DATABASE_URL || undefined,
    githubToken: env.GITHUB_TOKEN || undefined,
    jogadores: env.JOGADORES_URL
      ? { url: env.JOGADORES_URL }
      : env.DATABASE_URL
        ? { url: JOGADORES_URL }
        : { path: JOGADORES_LOCAL },
    confiarProxy: proxy ? proxy === 'true' || proxy === '1' : Boolean(env.RAILWAY_ENVIRONMENT)
  };
}

/** Lista de jogadores que pode ser relida; numa falha, fica a última que funcionou. */
export function listaRecarregavel(carregar: () => Promise<Jogador[]>, log: (m: string) => void) {
  let atual: Jogador[] = [];
  return {
    atual: (): Jogador[] => atual,
    async recarregar(): Promise<boolean> {
      try {
        atual = await carregar();
        return true;
      } catch (e) {
        log(`[web] não consegui recarregar a lista de jogadores; mantendo a anterior (${mensagem(e)})`);
        return false;
      }
    }
  };
}

/** Copia a lista com `desde` limitado aos últimos `dias` até `ultimo`. */
export function aparar(jogadores: Jogador[], ultimo: string, dias: number): Jogador[] {
  const inicio = addDays(ultimo, -(dias - 1));
  return jogadores.map((j) => ({ ...j, desde: j.desde > inicio ? j.desde : inicio }));
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const cfg = configDoAmbiente(env);
  const log = (m: string) => console.log(m);
  const token = cfg.githubToken;

  let repo: PartidaRepo;
  let pg: PgRepo | undefined;
  if (cfg.databaseUrl) {
    pg = PgRepo.fromUrl(cfg.databaseUrl);
    await pg.migrate();
    repo = pg;
  } else {
    repo = new MemoryRepo();
    log('[web] sem DATABASE_URL: partidas em memória (só para desenvolvimento)');
  }
  if (!token) console.warn('[web] sem GITHUB_TOKEN: as telas abrem, mas a animação da partida não é desenhada');

  const fonte = cfg.jogadores;
  log(`[web] lista de jogadores: ${'url' in fonte ? fonte.url : fonte.path}`);
  const lista = listaRecarregavel(
    () => loadJogadores({ ...fonte, hoje: ultimoDiaCompleto() } as LoadOptions),
    log
  );
  await lista.recarregar();
  setInterval(() => void lista.recarregar(), RECARGA_MS).unref();

  const app = createApp({
    repo,
    jogadores: lista.atual,
    hoje: () => ultimoDiaCompleto(),
    confiarProxy: cfg.confiarProxy,
    renderSvg: async (login, data, tema) => {
      if (!token) throw new Error('GITHUB_TOKEN ausente: não dá para buscar as contribuições');
      const { contributions } = await fetchContributionsWindow(login, data, token, fetchComTimeout);
      const partida = await playDay({ login, date: data, contributions, theme: tema, withSvg: true });
      return partida?.svg ?? null;
    }
  });

  const servidor = serve({ fetch: app.fetch, port: cfg.porta }, (info) =>
    log(`[web] ouvindo em http://localhost:${info.port}`)
  );

  const encerrar = () => {
    servidor.close(() => void (pg?.close() ?? Promise.resolve()).finally(() => process.exit(0)));
  };
  process.once('SIGTERM', encerrar);
  process.once('SIGINT', encerrar);

  // Desenvolvimento sem banco: joga os últimos dias em segundo plano, sem segurar o servidor.
  if (!pg) {
    if (!token) {
      console.warn('[web] sem GITHUB_TOKEN: o ranking local começa vazio');
    } else {
      const ultimo = ultimoDiaCompleto();
      log(`[web] jogando os últimos ${DIAS_DEV} dias em segundo plano…`);
      runCron({
        repo,
        jogadores: aparar(lista.atual(), ultimo, DIAS_DEV),
        ultimo,
        fetchWindow: (login, date) => fetchContributionsWindow(login, date, token, fetchComTimeout),
        listPublished: (p, since) => listPublished(p.repo, p.branch, p.path, token, { since, log }),
        log
      })
        .then((r) =>
          log(`[web] partidas locais prontas: ${r.total.jogadas} jogadas, ${r.total.erros} erros, ${r.total.pendentes} pendentes`)
        )
        .catch((e) => console.error(`[web] o cron local falhou: ${mensagem(e)}`));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[web] não consegui subir: ${mensagem(e)}`);
    process.exit(1);
  });
}
