import { pathToFileURL } from 'node:url';
import { ENGINE_VERSION, playDay, type PlayDayOptions, type Partida } from '../../src/runner.js';
import { fetchContributionsWindow, type FetchLike, type RateLimit } from '../../src/providers/github-contributions.js';
import type { Contribution } from '../../src/types.js';
import { addDays, dataValida, ultimoDiaCompleto } from './datas.js';
import { loadJogadores, type Jogador, type Publicado } from './jogadores.js';
import { listPublished, type CommitPublicado } from './publicados.js';
import type { PartidaRepo } from './repo.js';
import { PgRepo } from './repo-pg.js';

/** Saldo da API do GitHub que o cron deixa sobrando para os outros usos do token. */
export const RESERVA = 50;
/** Depois de tantos erros seguidos num jogador (ex.: GitHub fora do ar), ele fica para a próxima rodada. */
export const MAX_ERROS_SEGUIDOS = 5;
/** Quando o jogador já tem SVGs publicados marcados, só os commits destes últimos dias são relidos. */
export const JANELA_PUBLICADOS = 14;

export const JOGADORES_URL =
  'https://raw.githubusercontent.com/AndreRuperto/svg-pacman-contributions/main/ranking/jogadores.json';

export type FetchWindow = (
  login: string,
  date: string
) => Promise<{ contributions: Contribution[]; rateLimit: RateLimit | null }>;

/** Commits do SVG publicado a partir de `since` (AAAA-MM-DD). */
export type ListPublished = (publicado: Publicado, since: string) => Promise<CommitPublicado[]>;

export interface CronDeps {
  repo: PartidaRepo;
  jogadores: Jogador[];
  /**
   * Último dia a jogar (AAAA-MM-DD, UTC). Padrão: `ultimoDiaCompleto(agora)`.
   * Nunca passa da véspera do dia corrente: o dia corrente ainda pode ganhar contribuições.
   */
  ultimo?: string;
  /** Relógio, para os testes. */
  agora?: Date;
  fetchWindow: FetchWindow;
  listPublished?: ListPublished;
  play?: (opts: PlayDayOptions) => Promise<Partida | null>;
  /** Versão do motor das partidas que contam como já jogadas (padrão: `ENGINE_VERSION`). */
  versao?: string;
  log?: (msg: string) => void;
}

export interface ResumoJogador {
  login: string;
  jogadas: number;
  semJogo: number;
  erros: number;
  /** Partidas que ganharam `publicado_sha` nesta rodada. */
  publicados: number;
  /** Dias que ficaram para a próxima rodada. */
  pendentes: number;
  aviso?: string;
}

export interface CronResult {
  parou: 'limite' | null;
  /** Último dia jogado (AAAA-MM-DD). */
  ultimo: string;
  jogadores: ResumoJogador[];
  avisos: string[];
  total: { jogadas: number; semJogo: number; erros: number; publicados: number; pendentes: number };
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 403 e 429 são o limite secundário do GitHub: insistir só piora. */
const ehLimite = (msg: string) => msg === 'GITHUB_403' || msg === 'GITHUB_429';

/** Dias de `desde` até `ultimo`, do mais recente para o mais antigo. */
function diasAte(desde: string, ultimo: string): string[] {
  const dias: string[] = [];
  for (let d = ultimo; d >= desde; d = addDays(d, -1)) dias.push(d);
  return dias;
}

/**
 * Joga os dias que faltam de cada jogador, de `desde` até o último dia completo, e grava no repositório.
 * Para (com `parou: 'limite'`) quando o saldo da API fica abaixo de `RESERVA` ou o GitHub
 * responde 403/429; a rodada seguinte continua de onde esta parou.
 */
export async function runCron(deps: CronDeps): Promise<CronResult> {
  const { repo, jogadores, fetchWindow } = deps;
  const play = deps.play ?? playDay;
  const versao = deps.versao ?? ENGINE_VERSION;
  const log = deps.log ?? (() => {});

  const vespera = ultimoDiaCompleto(deps.agora ?? new Date());
  let ultimo = deps.ultimo ?? vespera;
  if (!dataValida(ultimo)) throw new Error(`"ultimo" deve ser uma data AAAA-MM-DD válida (${JSON.stringify(ultimo)})`);
  if (ultimo > vespera) {
    log(`[cron] ${ultimo} ainda não terminou em UTC; jogando só até ${vespera}`);
    ultimo = vespera;
  }

  const resultado: CronResult = {
    parou: null,
    ultimo,
    jogadores: [],
    avisos: [],
    total: { jogadas: 0, semJogo: 0, erros: 0, publicados: 0, pendentes: 0 }
  };
  const avisar = (r: ResumoJogador, aviso: string) => {
    r.aviso = r.aviso ? `${r.aviso}; ${aviso}` : aviso;
    resultado.avisos.push(`${r.login}: ${aviso}`);
    log(`[cron] aviso ${r.login}: ${aviso}`);
  };
  const pararPeloLimite = (motivo: string) => {
    resultado.parou = 'limite';
    log(`[cron] ${motivo}; parando a rodada`);
  };

  for (const jogador of jogadores) {
    const { login } = jogador;
    const r: ResumoJogador = { login, jogadas: 0, semJogo: 0, erros: 0, publicados: 0, pendentes: 0 };
    resultado.jogadores.push(r);

    const feitos = new Set([
      ...(await repo.datasExistentes(login, versao)),
      ...(await repo.diasSemJogo(login, versao))
    ]);
    const faltam = diasAte(jogador.desde, ultimo).filter((d) => !feitos.has(d));
    if (resultado.parou) {
      r.pendentes = faltam.length;
      continue;
    }

    let errosSeguidos = 0;
    let saldoDesconhecidoLogado = false;
    let naoEncontrado = false;
    let i = 0;
    for (; i < faltam.length && !resultado.parou; i++) {
      const data = faltam[i];
      let janela: Awaited<ReturnType<FetchWindow>>;
      try {
        janela = await fetchWindow(login, data);
      } catch (e) {
        const msg = mensagem(e);
        if (msg === 'USUARIO_NAO_ENCONTRADO') {
          naoEncontrado = true;
          avisar(r, 'usuário não encontrado no GitHub; pulado');
          break;
        }
        if (ehLimite(msg)) {
          pararPeloLimite(`GitHub respondeu ${msg} (limite secundário) em ${login} ${data}`);
          break; // o dia não foi buscado: continua pendente
        }
        r.erros++;
        errosSeguidos++;
        log(`[cron] erro ${login} ${data}: ${msg}`);
        if (errosSeguidos >= MAX_ERROS_SEGUIDOS) {
          avisar(r, `${MAX_ERROS_SEGUIDOS} erros seguidos (último: ${msg}); fica para a próxima rodada`);
          i++;
          break;
        }
        continue;
      }

      // O saldo é conferido antes do play; o dia já buscado ainda é jogado e gravado.
      const { contributions, rateLimit } = janela;
      if (rateLimit === null) {
        if (!saldoDesconhecidoLogado) log(`[cron] ${login}: saldo da API desconhecido (resposta sem rateLimit)`);
        saldoDesconhecidoLogado = true;
      } else if (rateLimit.remaining < RESERVA) {
        pararPeloLimite(`saldo da API em ${rateLimit.remaining} (< ${RESERVA}), renova em ${rateLimit.resetAt}`);
      }

      try {
        const p = await play({ login, date: data, contributions });
        if (p) {
          await repo.upsert(p);
          r.jogadas++;
        } else {
          await repo.marcarSemJogo(login, data, versao);
          r.semJogo++;
        }
        errosSeguidos = 0;
      } catch (e) {
        const msg = mensagem(e);
        r.erros++;
        errosSeguidos++;
        log(`[cron] erro ${login} ${data}: ${msg}`);
        if (errosSeguidos >= MAX_ERROS_SEGUIDOS) {
          avisar(r, `${MAX_ERROS_SEGUIDOS} erros seguidos (último: ${msg}); fica para a próxima rodada`);
          i++;
          break;
        }
      }
    }
    r.pendentes = naoEncontrado ? 0 : faltam.length - i;

    if (jogador.publicado && deps.listPublished && !naoEncontrado) {
      try {
        const partidas = await repo.porJogador(login);
        const jaMarcou = partidas.some((p) => p.publicado_sha !== null);
        const curto = addDays(ultimo, -JANELA_PUBLICADOS);
        const since = jaMarcou && curto > jogador.desde ? curto : jogador.desde;
        const commits = await deps.listPublished(jogador.publicado, since);
        const shaAtual = new Map(partidas.map((p) => [p.data, p.publicado_sha]));
        for (const { date, sha } of commits) {
          if (!dataValida(date) || date < jogador.desde || date > ultimo) continue;
          if (!shaAtual.has(date) || shaAtual.get(date) === sha) continue;
          await repo.marcarPublicado(login, date, sha);
          r.publicados++;
        }
      } catch (e) {
        avisar(r, `não consegui listar o SVG publicado (${mensagem(e)})`);
      }
    }
  }

  for (const r of resultado.jogadores) {
    resultado.total.jogadas += r.jogadas;
    resultado.total.semJogo += r.semJogo;
    resultado.total.erros += r.erros;
    resultado.total.publicados += r.publicados;
    resultado.total.pendentes += r.pendentes;
  }
  return resultado;
}

const linha = (nome: string, r: Omit<ResumoJogador, 'login'>) =>
  `[cron] ${nome}: ${r.jogadas} jogadas, ${r.semJogo} sem jogo, ${r.erros} erros, ` +
  `${r.publicados} publicados, ${r.pendentes} pendentes` +
  (r.aviso ? ` (${r.aviso})` : '');

/** fetch com timeout, no formato que `fetchContributionsWindow` espera. */
const fetchComTimeout: FetchLike = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });

/**
 * Liga as dependências reais. Devolve o código de saída.
 * `HOJE` (opcional, para testes) é o último dia a jogar; o padrão é `ultimoDiaCompleto()`.
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const { DATABASE_URL, GITHUB_TOKEN } = env;
  if (!DATABASE_URL || !GITHUB_TOKEN) {
    console.error('[cron] faltam variáveis: DATABASE_URL e GITHUB_TOKEN são obrigatórias');
    return 1;
  }
  const ultimo = env.HOJE || ultimoDiaCompleto();
  if (!dataValida(ultimo)) {
    console.error(`[cron] HOJE inválido: ${JSON.stringify(ultimo)} (esperado AAAA-MM-DD)`);
    return 1;
  }

  const repo = PgRepo.fromUrl(DATABASE_URL);
  try {
    try {
      await repo.migrate();
    } catch (e) {
      console.error(`[cron] o banco não respondeu: ${mensagem(e)}`);
      return 1;
    }
    let jogadores: Jogador[];
    try {
      jogadores = await loadJogadores({ url: env.JOGADORES_URL || JOGADORES_URL, hoje: ultimo });
    } catch (e) {
      console.error(`[cron] ${mensagem(e)}`);
      return 1;
    }

    const inicio = Date.now();
    const log = (m: string) => console.log(m);
    const r = await runCron({
      repo,
      jogadores,
      ultimo,
      fetchWindow: (login, date) => fetchContributionsWindow(login, date, GITHUB_TOKEN, fetchComTimeout),
      listPublished: (p, since) => listPublished(p.repo, p.branch, p.path, GITHUB_TOKEN, { since, log }),
      log
    });
    for (const j of r.jogadores) console.log(linha(j.login, j));
    console.log(
      linha(
        `total até ${r.ultimo} (${r.jogadores.length} jogadores, ${Math.round((Date.now() - inicio) / 1000)} s)`,
        r.total
      ) + (r.parou === 'limite' ? ' — parou pelo limite da API' : '')
    );
    return 0;
  } catch (e) {
    console.error(`[cron] falhou: ${mensagem(e)}`);
    return 1;
  } finally {
    await repo.close().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
