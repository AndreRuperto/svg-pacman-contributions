/** Servidor web do ranking (telas + API). Em produção, Postgres; sem `DATABASE_URL`, memória. */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { fetchContributionsWindow } from '../../src/providers/github-contributions.js';
import { ENGINE_VERSION, playDay, type Partida } from '../../src/runner.js';
import { SemRender, createApp } from './app.js';
import { JOGADORES_URL, fetchComTimeout, runCron } from './cron.js';
import { addDays, ultimoDiaCompleto } from './datas.js';
import { loadJogadores, type Jogador, type LoadOptions } from './jogadores.js';
import { listPublished } from './publicados.js';
import { MemoryRepo, type PartidaRepo, type PartidaSalva } from './repo.js';
import { PgRepo } from './repo-pg.js';
import { recuperarSnapshot } from './snapshot.js';

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

/** Esperas entre as novas tentativas da primeira carga da lista. */
export const ESPERAS_PRIMEIRA_CARGA = [5_000, 15_000, 30_000];

const dormirDeVerdade = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Primeira carga da lista: se falhar, tenta de novo depois de 5 s, 15 s e 30 s.
 * Devolve `false` se nenhuma tentativa funcionou (a lista continua vazia).
 */
export async function primeiraCarga(
  lista: { recarregar: () => Promise<boolean> },
  { esperas = ESPERAS_PRIMEIRA_CARGA, dormir = dormirDeVerdade }: { esperas?: number[]; dormir?: (ms: number) => Promise<void> } = {}
): Promise<boolean> {
  if (await lista.recarregar()) return true;
  for (const ms of esperas) {
    await dormir(ms);
    if (await lista.recarregar()) return true;
  }
  return false;
}

type Numeros = Pick<Partida, 'pontos' | 'mortes' | 'fantasmas'>;

/**
 * A animação é jogada de novo com as contribuições de agora; se o GitHub mudou a janela
 * daquele dia, os números podem não bater com a partida salva. Só avisa.
 */
export function conferirDivergencia(
  login: string,
  data: string,
  salva: Numeros | undefined,
  nova: Numeros,
  avisar: (m: string) => void = console.warn
): void {
  if (!salva) return;
  const campos = (['pontos', 'mortes', 'fantasmas'] as const).filter((k) => salva[k] !== nova[k]);
  if (!campos.length) return;
  const detalhe = campos.map((k) => `${k} ${salva[k]} → ${nova[k]}`).join(', ');
  avisar(`[web] a animação de ${login} em ${data} não bate com a partida salva (${detalhe})`);
}

/** Recusa entregar SVG cujo replay não reproduz o resultado registrado. */
export function validarReplay(salva: PartidaSalva, nova: Partida | null): void {
  if (!nova || salva.versao_motor !== ENGINE_VERSION) {
    throw new SemRender('motor diferente ou partida sem resultado: replay não verificável');
  }
  const campos = (['pontos', 'mortes', 'fantasmas', 'maior_combo', 'quadros', 'celulas', 'interrompida'] as const)
    .filter((k) => salva[k] !== nova[k]);
  if (campos.length || Math.abs(salva.eficiencia - nova.eficiencia) > 1e-9) {
    throw new SemRender(`replay divergente de ${salva.login} ${salva.data}: ${[...campos, 'eficiencia'].join(', ')}`);
  }
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
  if (cfg.databaseUrl && !token) {
    throw new Error('GITHUB_TOKEN é obrigatório com DATABASE_URL: sem ele a animação das partidas não é desenhada');
  }

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
  const recargas = () => setInterval(() => void lista.recarregar(), RECARGA_MS).unref();
  let listaPronta: Promise<boolean>;
  if (pg) {
    // Produção: sem lista não sobe (o Railway reinicia o serviço).
    if (!(await primeiraCarga(lista))) {
      await pg.close().catch(() => {});
      throw new Error('não consegui ler a lista de jogadores depois de 4 tentativas');
    }
    listaPronta = Promise.resolve(true);
    recargas();
  } else {
    // Desenvolvimento: as tentativas correm em segundo plano.
    listaPronta = primeiraCarga(lista).finally(recargas);
  }

  const app = createApp({
    repo,
    jogadores: lista.atual,
    hoje: () => ultimoDiaCompleto(),
    confiarProxy: cfg.confiarProxy,
    podeDesenhar: Boolean(token),
    renderSvg: async (login, data, tema, salva: PartidaSalva, snapshot) => {
      // A API já leu o snapshot para computar a assinatura do cache.
      // Nunca reler uma janela diferente no meio da reexecução.
      if (snapshot !== null && salva.versao_motor !== ENGINE_VERSION) {
        throw new SemRender('versão do motor diferente da partida gravada');
      }
      if (snapshot === null && !token) throw new SemRender('sem GITHUB_TOKEN para reconstrução legada');
      const contributions = snapshot !== null
        ? recuperarSnapshot(snapshot)
        : (await fetchContributionsWindow(login, data, token!, fetchComTimeout)).contributions;
      const partida = await playDay({ login, date: data, contributions, theme: tema, withSvg: true });
      if (snapshot !== null) validarReplay(salva, partida);
      else if (partida) conferirDivergencia(login, data, salva, partida);
      return partida?.svg ?? null;
    }
  });

  const servidor = serve({ fetch: app.fetch, port: cfg.porta }, (info) =>
    log(`[web] ouvindo em http://localhost:${info.port}`)
  );

  servidor.on('error', (e: NodeJS.ErrnoException) => {
    console.error(
      e.code === 'EADDRINUSE'
        ? `[web] a porta ${cfg.porta} já está em uso; feche o outro servidor ou use PORT=<outra>`
        : `[web] o servidor falhou: ${mensagem(e)}`
    );
    process.exit(1);
  });

  const encerrar = () => {
    // conexões presas não seguram o processo para sempre
    setTimeout(() => process.exit(0), 10_000).unref();
    servidor.close(() => {
      (pg ? pg.close() : Promise.resolve())
        .catch((e) => console.error(`[web] erro ao fechar o banco: ${mensagem(e)}`))
        .finally(() => process.exit(0));
    });
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
      void listaPronta.then(() => runCron({
        repo,
        jogadores: aparar(lista.atual(), ultimo, DIAS_DEV),
        ultimo,
        fetchWindow: (login, date) => fetchContributionsWindow(login, date, token, fetchComTimeout),
        listPublished: (p, since) => listPublished(p.repo, p.branch, p.path, token, { since, log }),
        log
      }))
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
