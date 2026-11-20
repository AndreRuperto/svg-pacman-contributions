import { pathToFileURL } from 'node:url';
import { ENGINE_VERSION, playDay, type PlayDayOptions, type Partida } from '../../src/runner.js';
import {
  fetchContributionsWindow,
  type FetchLike,
  type RateLimit
} from '../../src/providers/github-contributions.js';
import type { Contribution } from '../../src/types.js';
import { addDays, dataValida, exigirHoje } from './datas.js';
import { loadJogadores, type Jogador, type Publicado } from './jogadores.js';
import { listPublished, type CommitPublicado } from './publicados.js';
import type { PartidaRepo } from './repo.js';
import { PgRepo } from './repo-pg.js';

/** Saldo da API do GitHub que o cron deixa sobrando para os outros usos do token. */
export const RESERVA = 50;
/** Depois de tantos erros seguidos num jogador (ex.: GitHub fora do ar), ele fica para a próxima rodada. */
export const MAX_ERROS_SEGUIDOS = 5;

export const JOGADORES_URL =
  'https://raw.githubusercontent.com/AndreRuperto/svg-pacman-contributions/main/ranking/jogadores.json';

export type FetchWindow = (
  login: string,
  date: string
) => Promise<{ contributions: Contribution[]; rateLimit: RateLimit | null }>;

export type ListPublished = (publicado: Publicado, desde: string) => Promise<CommitPublicado[]>;

export interface CronDeps {
  repo: PartidaRepo;
  jogadores: Jogador[];
  /** AAAA-MM-DD (UTC). */
  hoje: string;
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
  jogadores: ResumoJogador[];
  avisos: string[];
  total: { jogadas: number; semJogo: number; erros: number; publicados: number; pendentes: number };
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Dias de `desde` até `hoje`, do mais recente para o mais antigo. */
function diasAte(desde: string, hoje: string): string[] {
  const dias: string[] = [];
  for (let d = hoje; d >= desde; d = addDays(d, -1)) dias.push(d);
  return dias;
}

/**
 * Joga os dias que faltam de cada jogador e grava no repositório.
 * Para (com `parou: 'limite'`) quando o saldo da API fica abaixo de `RESERVA`;
 * a rodada seguinte continua de onde esta parou.
 */
export async function runCron(deps: CronDeps): Promise<CronResult> {
  const { repo, jogadores, hoje, fetchWindow } = deps;
  exigirHoje(hoje);
  const play = deps.play ?? playDay;
  const versao = deps.versao ?? ENGINE_VERSION;
  const log = deps.log ?? (() => {});

  const resultado: CronResult = {
    parou: null,
    jogadores: [],
    avisos: [],
    total: { jogadas: 0, semJogo: 0, erros: 0, publicados: 0, pendentes: 0 }
  };
  const avisar = (r: ResumoJogador, aviso: string) => {
    r.aviso = r.aviso ? `${r.aviso}; ${aviso}` : aviso;
    resultado.avisos.push(`${r.login}: ${aviso}`);
    log(`[cron] aviso ${r.login}: ${aviso}`);
  };

  for (const jogador of jogadores) {
    const { login } = jogador;
    const r: ResumoJogador = { login, jogadas: 0, semJogo: 0, erros: 0, publicados: 0, pendentes: 0 };
    resultado.jogadores.push(r);

    const feitos = new Set([...(await repo.datasExistentes(login, versao)), ...(await repo.diasSemJogo(login, versao))]);
    const faltam = diasAte(jogador.desde, hoje).filter((d) => !feitos.has(d));
    if (resultado.parou) {
      r.pendentes = faltam.length;
      continue;
    }

    let errosSeguidos = 0;
    let saldoDesconhecidoLogado = false;
    let naoEncontrado = false;
    let i = 0;
    for (; i < faltam.length; i++) {
      const data = faltam[i];
      try {
        const { contributions, rateLimit } = await fetchWindow(login, data);
        const p = await play({ login, date: data, contributions });
        if (p) {
          await repo.upsert(p);
          r.jogadas++;
        } else {
          await repo.marcarSemJogo(login, data, versao);
          r.semJogo++;
        }
        errosSeguidos = 0;
        if (rateLimit === null) {
          if (!saldoDesconhecidoLogado) log(`[cron] ${login}: saldo da API desconhecido (resposta sem rateLimit)`);
          saldoDesconhecidoLogado = true;
        } else if (rateLimit.remaining < RESERVA) {
          resultado.parou = 'limite';
          log(`[cron] saldo da API em ${rateLimit.remaining} (< ${RESERVA}); parando até ${rateLimit.resetAt}`);
          i++;
          break;
        }
      } catch (e) {
        const msg = mensagem(e);
        if (msg === 'USUARIO_NAO_ENCONTRADO') {
          naoEncontrado = true;
          avisar(r, 'usuário não encontrado no GitHub; pulado');
          break;
        }
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
        const commits = await deps.listPublished(jogador.publicado, jogador.desde);
        const shaAtual = new Map((await repo.porJogador(login)).map((p) => [p.data, p.publicado_sha]));
        for (const { date, sha } of commits) {
          if (!dataValida(date) || date < jogador.desde || date > hoje) continue;
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
  `${r.publicados} publicados, ${r.pendentes} pendentes` + (r.aviso ? ` (${r.aviso})` : '');

/** fetch com timeout, no formato que `fetchContributionsWindow` espera. */
const fetchComTimeout: FetchLike = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });

/** Liga as dependências reais. Devolve o código de saída. */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const { DATABASE_URL, GITHUB_TOKEN } = env;
  if (!DATABASE_URL || !GITHUB_TOKEN) {
    console.error('[cron] faltam variáveis: DATABASE_URL e GITHUB_TOKEN são obrigatórias');
    return 1;
  }
  const hoje = env.HOJE || new Date().toISOString().slice(0, 10);
  if (!dataValida(hoje)) {
    console.error(`[cron] HOJE inválido: ${JSON.stringify(hoje)} (esperado AAAA-MM-DD)`);
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
      jogadores = await loadJogadores({ url: env.JOGADORES_URL || JOGADORES_URL, hoje });
    } catch (e) {
      console.error(`[cron] ${mensagem(e)}`);
      return 1;
    }

    const inicio = Date.now();
    const r = await runCron({
      repo,
      jogadores,
      hoje,
      fetchWindow: (login, date) => fetchContributionsWindow(login, date, GITHUB_TOKEN, fetchComTimeout),
      listPublished: (p, desde) => listPublished(p.repo, p.branch, p.path, GITHUB_TOKEN, { since: desde }),
      log: (m) => console.log(m)
    });
    for (const j of r.jogadores) console.log(linha(j.login, j));
    console.log(
      linha(`total (${r.jogadores.length} jogadores, ${Math.round((Date.now() - inicio) / 1000)} s)`, r.total) +
        (r.parou === 'limite' ? ' — parou pelo limite da API' : '')
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
