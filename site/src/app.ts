import { Hono, type Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { GAME_THEMES } from '../../src/core/constants.js';
import type { ThemeKeys } from '../../src/types.js';
import { LruCache } from './cache.js';
import { addDays, dataValida, exigirHoje } from './datas.js';
import type { Jogador } from './jogadores.js';
import { rankPlayers, type Aba, type Periodo } from './ranking.js';
import { FilaCheia, RateLimiter, Semaforo } from './ratelimit.js';
import { chaveLogin, type PartidaRepo, type PartidaSalva } from './repo.js';

export interface AppDeps {
  repo: PartidaRepo;
  /** Lida a cada pedido: a lista pode ser recarregada sem reiniciar o servidor. */
  jogadores: () => Jogador[];
  /** AAAA-MM-DD (UTC). Em produção, o último dia completo. */
  hoje: () => string;
  /** SVG da partida daquele dia naquele tema; `null` se não houver o que jogar. */
  renderSvg: (login: string, data: string, tema: ThemeKeys) => Promise<string | null>;
  /**
   * `true` só atrás de um proxy confiável (Railway): o IP vem de `x-real-ip`,
   * senão do último item de `x-forwarded-for`. Padrão `false`: só o socket.
   */
  confiarProxy?: boolean;
  /** Limite de `/api/partida/*`; padrão 30 pedidos por minuto por IP. */
  rateLimiter?: RateLimiter;
  /** Limite das rotas JSON de `/api/*`; padrão 120 pedidos por minuto por IP. */
  rateLimiterJson?: RateLimiter;
  /** Renders simultâneos (padrão 2) e quantos podem esperar na fila (padrão 20). */
  maxRenders?: number;
  maxFila?: number;
  /** Teto do cache de SVG, em caracteres somados (padrão 32 MB). */
  maxBytesCache?: number;
  /** Relógio em ms (para testes). */
  agora?: () => number;
}

const ABAS: readonly Aba[] = ['pontos', 'eficiencia'];
const PERIODOS: readonly Periodo[] = ['hoje', '7d', 'recorde'];
const TEMA_PADRAO: ThemeKeys = 'github-dark';
const CACHE_ITENS = 200;
const CACHE_BYTES = 32 * 1024 * 1024;
const MEMO_ITENS = 500;
const MEMO_MS = 60_000;
const MAX_AGE_JSON = 60;
const MAX_AGE_PASSADO = 86_400;
const MAX_AGE_HOJE = 300;
const RETRY_FILA_S = 5;
const CSP_SVG = "default-src 'none'; style-src 'unsafe-inline'";

type Status = 400 | 404 | 429 | 500 | 503;
const erro = (c: Context, status: Status, mensagem: string) => c.json({ erro: mensagem }, status);

function temaValido(t: string): t is ThemeKeys {
  return Object.prototype.hasOwnProperty.call(GAME_THEMES, t);
}

function ipDoSocket(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'desconhecido';
  } catch {
    // sem conexão real (app.request nos testes)
    return 'desconhecido';
  }
}

/**
 * IP do cliente. Atrás do proxy, o primeiro item do `x-forwarded-for` é o que o
 * cliente mandou (forjável); o último é o que o proxy acrescentou.
 */
function ipDe(c: Context, confiarProxy: boolean): string {
  if (confiarProxy) {
    const real = c.req.header('x-real-ip')?.trim();
    if (real) return real;
    const ultimo = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim();
    if (ultimo) return ultimo;
  }
  return ipDoSocket(c);
}

/** Troca o login gravado pela grafia da lista (o repositório guarda a da última gravação). */
function comGrafiaDaLista(partidas: PartidaSalva[], lista: Jogador[]): PartidaSalva[] {
  const grafia = new Map(lista.map((j) => [chaveLogin(j.login), j.login]));
  return partidas.map((p) => ({ ...p, login: grafia.get(chaveLogin(p.login)) ?? p.login }));
}

/** Melhor partida não interrompida por pontos; empate: menos mortes, depois a mais antiga. */
function recordeDe(partidas: PartidaSalva[]): PartidaSalva | null {
  const validas = partidas.filter((p) => !p.interrompida);
  validas.sort((a, b) => b.pontos - a.pontos || a.mortes - b.mortes || a.data.localeCompare(b.data));
  return validas[0] ?? null;
}

/** Resposta para rotas que não existem. Fora de `/api`, a Task 9 trocará o texto por HTML. */
function naoEncontrada(c: Context): Response {
  if (c.req.path === '/api' || c.req.path.startsWith('/api/')) return erro(c, 404, 'Rota não encontrada.');
  return c.text('Página não encontrada.', 404);
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const agora = deps.agora ?? Date.now;
  const confiarProxy = deps.confiarProxy ?? false;
  const svgs = new LruCache<string>(CACHE_ITENS, { maxPeso: deps.maxBytesCache ?? CACHE_BYTES, peso: (s) => s.length });
  const memo = new LruCache<{ expira: number; corpo: unknown }>(MEMO_ITENS);
  const emAndamento = new Map<string, Promise<string | null>>();
  const renders = new Semaforo(deps.maxRenders ?? 2, deps.maxFila ?? 20);
  const limitePartida = deps.rateLimiter ?? new RateLimiter({ limite: 30, janelaMs: 60_000, agora });
  const limiteJson = deps.rateLimiterJson ?? new RateLimiter({ limite: 120, janelaMs: 60_000, agora });

  const hoje = (): string => {
    const h = deps.hoje();
    exigirHoje(h);
    return h;
  };
  const acharJogador = (lista: Jogador[], login: string): Jogador | undefined => {
    const k = chaveLogin(login);
    return lista.find((j) => chaveLogin(j.login) === k);
  };
  /** Memo de 60 s do corpo das respostas 200 (as validações e os 404 ficam antes). */
  const memorizado = async (chave: string, calcular: () => Promise<unknown>): Promise<unknown> => {
    const guardado = memo.get(chave);
    if (guardado && guardado.expira > agora()) return guardado.corpo;
    const corpo = await calcular();
    memo.set(chave, { expira: agora() + MEMO_MS, corpo });
    return corpo;
  };
  const json = (c: Context, corpo: unknown) => {
    c.header('Cache-Control', `public, max-age=${MAX_AGE_JSON}`);
    return c.json(corpo as object);
  };

  app.onError((e, c) => {
    console.error('[api]', e);
    return erro(c, 500, 'Erro interno. Tente de novo em instantes.');
  });
  app.notFound(naoEncontrada);

  app.use('/api/*', async (c, next) => {
    const partida = c.req.path.startsWith('/api/partida/');
    const r = (partida ? limitePartida : limiteJson).consumir(ipDe(c, confiarProxy));
    if (!r.ok) {
      c.header('Retry-After', String(r.retryAfterS));
      return erro(c, 429, 'Muitos pedidos. Espere um pouco e tente de novo.');
    }
    await next();
  });

  app.get('/api/ranking', async (c) => {
    const aba = c.req.query('aba') ?? 'pontos';
    const periodo = c.req.query('periodo') ?? 'hoje';
    if (!ABAS.includes(aba as Aba)) return erro(c, 400, `aba inválida: use ${ABAS.join(' ou ')}.`);
    if (!PERIODOS.includes(periodo as Periodo)) {
      return erro(c, 400, `período inválido: use ${PERIODOS.join(', ')}.`);
    }
    const h = hoje();
    const corpo = await memorizado(`ranking|${aba}|${periodo}|${h}`, async () => {
      const lista = deps.jogadores();
      const logins = lista.map((j) => j.login);
      const partidas =
        periodo === 'hoje'
          ? await deps.repo.entre(h, h, logins)
          : periodo === '7d'
            ? await deps.repo.entre(addDays(h, -6), h, logins)
            : await deps.repo.todasDe(logins);
      const linhas = rankPlayers(comGrafiaDaLista(partidas, lista), {
        aba: aba as Aba,
        periodo: periodo as Periodo,
        hoje: h
      }).map(({ posicao, login, valor, partida }) => ({
        posicao,
        login,
        valor,
        fantasmas: partida.fantasmas,
        mortes: partida.mortes,
        quadros: partida.quadros,
        data: partida.data
      }));
      return { aba, periodo, hoje: h, linhas };
    });
    return json(c, corpo);
  });

  app.get('/api/jogador/:login', async (c) => {
    const lista = deps.jogadores();
    const jogador = acharJogador(lista, c.req.param('login'));
    if (!jogador) return erro(c, 404, 'Jogador não encontrado na lista.');
    const h = hoje();
    const k = chaveLogin(jogador.login);
    const corpo = await memorizado(`jogador|${k}|${h}`, async () => {
      const partidas = comGrafiaDaLista(await deps.repo.porJogador(jogador.login), lista);

      const inicio30 = addDays(h, -29);
      const ultimos30 = partidas.filter((p) => p.data >= inicio30 && p.data <= h);
      const media30 = ultimos30.length ? ultimos30.reduce((s, p) => s + p.pontos, 0) / ultimos30.length : null;

      const logins = lista.map((j) => j.login);
      const doDia = comGrafiaDaLista(await deps.repo.entre(h, h, logins), lista);
      const posicao = (aba: Aba): number | null =>
        rankPlayers(doDia, { aba, periodo: 'hoje', hoje: h }).find((l) => chaveLogin(l.login) === k)?.posicao ?? null;

      return {
        login: jogador.login,
        partidas,
        recorde: recordeDe(partidas),
        media30,
        posicaoHoje: { pontos: posicao('pontos'), eficiencia: posicao('eficiencia') },
        publicado: jogador.publicado ?? null
      };
    });
    return json(c, corpo);
  });

  app.get('/api/partida/:login/:data', async (c) => {
    const jogador = acharJogador(deps.jogadores(), c.req.param('login'));
    if (!jogador) return erro(c, 404, 'Jogador não encontrado na lista.');
    const data = c.req.param('data');
    if (!dataValida(data)) return erro(c, 400, 'data inválida: use AAAA-MM-DD.');
    const tema = c.req.query('tema') ?? TEMA_PADRAO;
    if (!temaValido(tema)) return erro(c, 400, `tema inválido: use ${Object.keys(GAME_THEMES).join(', ')}.`);

    const [salva] = await deps.repo.entre(data, data, [jogador.login]);
    if (!salva) return erro(c, 404, 'Não há partida deste jogador neste dia.');

    // com a versão do motor na chave, uma partida jogada de novo não serve o SVG antigo
    const chave = `${chaveLogin(jogador.login)}|${data}|${tema}|${salva.versao_motor}`;
    let svg = svgs.get(chave);
    if (svg === undefined) {
      // pedidos simultâneos do mesmo SVG esperam a mesma renderização
      let pendente = emAndamento.get(chave);
      if (!pendente) {
        pendente = renders
          .executar(() => deps.renderSvg(jogador.login, data, tema))
          .finally(() => emAndamento.delete(chave));
        emAndamento.set(chave, pendente);
      }
      let novo: string | null;
      try {
        novo = await pendente;
      } catch (e) {
        if (!(e instanceof FilaCheia)) throw e;
        c.header('Retry-After', String(RETRY_FILA_S));
        return erro(c, 503, 'Muitas partidas sendo desenhadas agora. Tente de novo em alguns segundos.');
      }
      if (novo === null) return erro(c, 404, 'Não há partida deste jogador neste dia.');
      svgs.set(chave, novo);
      svg = novo;
    }

    const maxAge = data === hoje() ? MAX_AGE_HOJE : MAX_AGE_PASSADO;
    return c.body(svg, 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': CSP_SVG
    });
  });

  return app;
}
