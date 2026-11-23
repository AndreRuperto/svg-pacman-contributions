import { Hono, type Context } from 'hono';
import { performance } from 'node:perf_hooks';
import { ENGINE_VERSION } from '../../src/runner.js';
import { getConnInfo } from '@hono/node-server/conninfo';
import { GAME_THEMES } from '../../src/core/constants.js';
import type { ThemeKeys } from '../../src/types.js';
import { LruCache } from './cache.js';
import { assinaturaReplay, cacheavel } from './replay-cache.js';
import type { ReplaySnapshot } from './snapshot.js';
import { ABAS, PERIODOS, acharJogador, carregarJogador, carregarRanking, type DadosJogador, type DadosRanking } from './dados.js';
import { dataValida, exigirHoje } from './datas.js';
import type { Jogador } from './jogadores.js';
import type { Aba, Periodo } from './ranking.js';
import { FilaCheia, RateLimiter, Semaforo } from './ratelimit.js';
import { chaveLogin, type PartidaRepo, type PartidaSalva } from './repo.js';
import { paginaJogador, PERIODOS_GRAFICO, type PeriodoGrafico } from './views/jogador.js';
import { CSS, IMAGENS, paginaErro, type Html, type NomeImagem } from './views/layout.js';
import { paginaPartida, paginaPublicado } from './views/partida.js';
import { urlPublicado } from './views/formato.js';
import { paginaRanking } from './views/ranking.js';

export interface AppDeps {
  repo: PartidaRepo;
  /** Lida a cada pedido: a lista pode ser recarregada sem reiniciar o servidor. */
  jogadores: () => Jogador[];
  /** AAAA-MM-DD (UTC). Em produção, o último dia completo. */
  hoje: () => string;
  /**
   * SVG da partida daquele dia naquele tema; `null` se não houver o que jogar.
   * Recebe a partida salva para conferir se a de agora deu os mesmos números.
   * Lança `SemRender` quando este servidor não tem como desenhar (ex.: sem token).
   */
  renderSvg: (login: string, data: string, tema: ThemeKeys, salva: PartidaSalva, snapshot: ReplaySnapshot | null) => Promise<string | null>;
  /** `false` quando o servidor não desenha partidas: a tela troca a animação por um aviso. Padrão `true`. */
  podeDesenhar?: boolean;
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

const TEMA_PADRAO: ThemeKeys = 'github-dark';
const CACHE_ITENS = 200;
const CACHE_BYTES = 32 * 1024 * 1024;
const MEMO_ITENS = 500;
const MEMO_MS = 60_000;
const MAX_AGE_JSON = 60;
const MAX_AGE_PASSADO = 86_400;
const MAX_AGE_HOJE = 300;
const RETRY_FILA_S = 5;
const MAX_AGE_CSS = 31_536_000;
const CSP_SVG = "default-src 'none'; style-src 'unsafe-inline'";
const CSP_HTML = [
  "default-src 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' https://github.com https://avatars.githubusercontent.com https://raw.githubusercontent.com",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

/** O servidor não tem como desenhar a partida (ex.: sem `GITHUB_TOKEN`). */
export class SemRender extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'SemRender';
  }
}

const RETRY_SEM_RENDER_S = 3600;

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

const ehApi = (c: Context) => c.req.path === '/api' || c.req.path.startsWith('/api/');

/** Página HTML com os cabeçalhos de segurança e um cache curto (as de erro, sem cache). */
async function pagina(c: Context, corpo: Html, status: 200 | Status = 200): Promise<Response> {
  c.header('Content-Security-Policy', CSP_HTML);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Cache-Control', status === 200 ? `public, max-age=${MAX_AGE_JSON}` : 'no-store');
  return c.html(await corpo, status);
}

/** Erro em JSON dentro de `/api`, em página HTML fora dela. */
function falha(c: Context, status: Status, titulo: string, mensagem: string): Response | Promise<Response> {
  return ehApi(c) ? erro(c, status, mensagem) : pagina(c, paginaErro(titulo, mensagem), status);
}

const naoEncontrada = (c: Context) =>
  falha(c, 404, 'Página não encontrada', ehApi(c) ? 'Rota não encontrada.' : 'O endereço não existe ou mudou de lugar.');

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const agora = deps.agora ?? Date.now;
  const confiarProxy = deps.confiarProxy ?? false;
  const svgs = new LruCache<string>(CACHE_ITENS, { maxPeso: deps.maxBytesCache ?? CACHE_BYTES, peso: (s) => s.length });
  const memo = new LruCache<{ expira: number; corpo: unknown }>(MEMO_ITENS);
  type ResultadoSvg = { svg: string | null; origem: 'persistente' | 'gerado' };
  const emAndamento = new Map<string, Promise<ResultadoSvg>>();
  const renders = new Semaforo(deps.maxRenders ?? 2, deps.maxFila ?? 20);
  const limitePartida = deps.rateLimiter ?? new RateLimiter({ limite: 30, janelaMs: 60_000, agora });
  const limiteJson = deps.rateLimiterJson ?? new RateLimiter({ limite: 120, janelaMs: 60_000, agora });

  let avisouSemRender = false;
  const podeDesenhar = deps.podeDesenhar ?? true;
  const hoje = (): string => {
    const h = deps.hoje();
    exigirHoje(h);
    return h;
  };
  /** Memo de 60 s dos dados (as validações e os 404 ficam antes). API e telas usam o mesmo. */
  const memorizado = async <T>(chave: string, calcular: () => Promise<T>): Promise<T> => {
    const guardado = memo.get(chave);
    if (guardado && guardado.expira > agora()) return guardado.corpo as T;
    const corpo = await calcular();
    memo.set(chave, { expira: agora() + MEMO_MS, corpo });
    return corpo;
  };
  const ranking = (aba: Aba, periodo: Periodo): Promise<DadosRanking> => {
    const h = hoje();
    return memorizado(`ranking|${aba}|${periodo}|${h}`, () =>
      carregarRanking(deps.repo, deps.jogadores(), aba, periodo, h)
    );
  };
  /** Dados do jogador, ou `undefined` se ele não estiver na lista. */
  const dadosJogador = async (login: string): Promise<DadosJogador | undefined> => {
    const lista = deps.jogadores();
    const jogador = acharJogador(lista, login);
    if (!jogador) return undefined;
    const h = hoje();
    return memorizado(`jogador|${chaveLogin(jogador.login)}|${h}`, () => carregarJogador(deps.repo, lista, jogador, h));
  };
  const json = (c: Context, corpo: unknown) => {
    c.header('Cache-Control', `public, max-age=${MAX_AGE_JSON}`);
    return c.json(corpo as object);
  };

  app.onError((e, c) => {
    console.error(ehApi(c) ? '[api]' : '[web]', e);
    return falha(c, 500, 'Algo deu errado', 'Erro interno. Tente de novo em instantes.');
  });
  app.notFound(naoEncontrada);

  // Favicon antes do limite, para não gastar a cota do visitante (navegadores pedem /favicon.ico sozinhos).
  app.get('/favicon.ico', (c) =>
    c.body(new Uint8Array(IMAGENS['favicon-32.png'].corpo), 200, {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${MAX_AGE_PASSADO}`
    })
  );

  // Logo e ícones: a URL do layout leva o hash do arquivo, então o cache pode ser de um ano.
  app.get('/static/:arquivo{.+[.](?:svg|png)}', (c) => {
    const img = IMAGENS[c.req.param('arquivo') as NomeImagem];
    if (!img) return naoEncontrada(c);
    return c.body(new Uint8Array(img.corpo), 200, {
      'Content-Type': img.tipo,
      'Cache-Control': `public, max-age=${MAX_AGE_CSS}, immutable`,
      'X-Content-Type-Options': 'nosniff'
    });
  });

  // O CSS tem o hash do conteúdo na URL do layout: pode ficar em cache por um ano.
  app.get('/static/site.css', (c) =>
    c.body(CSS, 200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': `public, max-age=${MAX_AGE_CSS}, immutable`,
      'X-Content-Type-Options': 'nosniff'
    })
  );

  // Limite por IP: a partida (que desenha SVG) tem o seu; API JSON e telas dividem o outro.
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/static/')) return next();
    const partida = c.req.path.startsWith('/api/partida/');
    const r = (partida ? limitePartida : limiteJson).consumir(ipDe(c, confiarProxy));
    if (!r.ok) {
      c.header('Retry-After', String(r.retryAfterS));
      return falha(c, 429, 'Muitos pedidos', 'Muitos pedidos. Espere um pouco e tente de novo.');
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
    return json(c, await ranking(aba as Aba, periodo as Periodo));
  });

  app.get('/api/jogador/:login', async (c) => {
    const corpo = await dadosJogador(c.req.param('login'));
    if (!corpo) return erro(c, 404, 'Jogador não encontrado na lista.');
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

    const inicio = performance.now();
    const snapshot = await deps.repo.obterSnapshot(jogador.login, data);
    if (snapshot !== null && salva.versao_motor !== ENGINE_VERSION) {
      return erro(c, 503, 'Este replay foi criado por outra versão do motor e não pode ser verificado.');
    }
    // Chave muda se placar, versão ou qualquer célula da janela original mudar.
    const assinatura = assinaturaReplay(salva, snapshot ?? []);
    const chave = `${chaveLogin(jogador.login)}|${data}|${tema}|${assinatura}`;
    let svg = svgs.get(chave);
    let origem: 'memoria' | 'persistente' | 'gerado' = 'memoria';
    if (svg === undefined) {
      // Pedidos simultâneos do mesmo SVG usam a mesma promessa, mesmo com cache frio.
      let pendente = emAndamento.get(chave);
      if (!pendente) {
        pendente = renders.executar(async (): Promise<ResultadoSvg> => {
          if (snapshot !== null) {
            try {
              const salvo = await deps.repo.obterSvg(jogador.login, data, tema, assinatura);
              if (salvo !== null) return { svg: salvo, origem: 'persistente' };
            } catch (e) {
              // Cache é aceleração, não fonte de verdade: queda do cache não impede o replay.
              console.warn('[cache] leitura indisponível:', e instanceof Error ? e.message : String(e));
            }
          }
          const comecou = performance.now();
          const novo = await deps.renderSvg(jogador.login, data, tema, salva, snapshot);
          const duracao = Math.round(performance.now() - comecou);
          console.info(`[replay] jogador=${jogador.login} data=${data} tema=${tema} duracao_ms=${duracao} origem=gerado snapshot=${snapshot !== null}`);
          // Só guardar cache persistente quando o backend tiver validado a
          // reexecução contra a partida salva e recebido um SVG válido.
          if (novo !== null && snapshot !== null && cacheavel(novo)) {
            try {
              await deps.repo.gravarSvg(jogador.login, data, tema, assinatura, novo);
            } catch (e) {
              console.warn('[cache] gravação indisponível:', e instanceof Error ? e.message : String(e));
            }
          }
          return { svg: novo, origem: 'gerado' };
        }).finally(() => emAndamento.delete(chave));
        emAndamento.set(chave, pendente);
      }
      let resultado: ResultadoSvg;
      try {
        resultado = await pendente;
      } catch (e) {
        if (e instanceof SemRender) {
          if (!avisouSemRender) console.warn(`[api] a animação não pode ser desenhada: ${e.message}`);
          avisouSemRender = true;
          c.header('Retry-After', String(RETRY_SEM_RENDER_S));
          return erro(c, 503, 'A animação não está disponível neste servidor.');
        }
        if (!(e instanceof FilaCheia)) throw e;
        c.header('Retry-After', String(RETRY_FILA_S));
        return erro(c, 503, 'Muitas partidas sendo desenhadas agora. Tente de novo em alguns segundos.');
      }
      if (resultado.svg === null) return erro(c, 404, 'Não há partida deste jogador neste dia.');
      svgs.set(chave, resultado.svg);
      svg = resultado.svg;
      origem = resultado.origem;
    }

    const maxAge = data === hoje() ? MAX_AGE_HOJE : MAX_AGE_PASSADO;
    return c.body(svg, 200, {
      'X-Pacman-Cache': origem,
      'X-Pacman-Replay': snapshot === null ? 'reconstrucao' : 'verificado',
      'Server-Timing': `replay;dur=${(performance.now() - inicio).toFixed(1)}`,
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': CSP_SVG
    });
  });

  // Telas. Parâmetros inválidos caem no padrão (a API responde 400; aqui, a página abre).
  const jogadorFora = (c: Context, login: string) =>
    falha(c, 404, 'Jogador não encontrado', `${login.slice(0, 40)} não está na lista do ranking.`);

  app.get('/', async (c) => {
    const qa = c.req.query('aba');
    const qp = c.req.query('periodo');
    const aba: Aba = ABAS.includes(qa as Aba) ? (qa as Aba) : 'pontos';
    const periodo: Periodo = PERIODOS.includes(qp as Periodo) ? (qp as Periodo) : 'hoje';
    return pagina(c, paginaRanking(await ranking(aba, periodo)));
  });

  app.get('/jogador/:login', async (c) => {
    const login = c.req.param('login');
    const d = await dadosJogador(login);
    if (!d) return jogadorFora(c, login);
    const n = Number.parseInt(c.req.query('pagina') ?? '1', 10);
    const filtro = c.req.query('periodo');
    const periodoGrafico: PeriodoGrafico = PERIODOS_GRAFICO.includes(filtro as PeriodoGrafico)
      ? (filtro as PeriodoGrafico)
      : 'todos';
    return pagina(c, paginaJogador(d, hoje(), Number.isFinite(n) ? n : 1, podeDesenhar, periodoGrafico));
  });

  app.get('/jogador/:login/:data', async (c) => {
    const login = c.req.param('login');
    const d = await dadosJogador(login);
    if (!d) return jogadorFora(c, login);
    const data = c.req.param('data');
    const partida = dataValida(data) ? d.partidas.find((p) => p.data === data) : undefined;
    if (!partida) return falha(c, 404, 'Partida não encontrada', `Não há partida de ${d.login} neste dia.`);
    const t = c.req.query('tema');
    const tema = t !== undefined && temaValido(t) ? t : TEMA_PADRAO;
    const snapshotDisponivel = (await deps.repo.obterSnapshot(d.login, data)) !== null;
    const parada = c.req.query('animacao') === 'parada';
    return pagina(c, paginaPartida({ jogador: d, partida, tema, temaPadrao: TEMA_PADRAO, podeDesenhar, snapshotDisponivel, parada }));
  });

  app.get('/jogador/:login/:data/publicado', async (c) => {
    const login = c.req.param('login');
    const d = await dadosJogador(login);
    if (!d) return jogadorFora(c, login);
    const data = c.req.param('data');
    const partida = dataValida(data) ? d.partidas.find((p) => p.data === data) : undefined;
    if (!partida || !d.publicado || !partida.publicado_sha) {
      return falha(c, 404, 'Sem banner publicado', `Não há banner publicado de ${d.login} neste dia.`);
    }
    const parada = c.req.query('animacao') === 'parada';
    return pagina(c, paginaPublicado(d, partida, urlPublicado(d.publicado, partida.publicado_sha), parada));
  });

  return app;
}
