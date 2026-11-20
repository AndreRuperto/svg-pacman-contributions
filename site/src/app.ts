import { Hono, type Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { GAME_THEMES } from '../../src/core/constants.js';
import type { ThemeKeys } from '../../src/types.js';
import { LruCache } from './cache.js';
import { addDays, dataValida, exigirHoje } from './datas.js';
import type { Jogador } from './jogadores.js';
import { rankPlayers, type Aba, type Periodo } from './ranking.js';
import { RateLimiter } from './ratelimit.js';
import { chaveLogin, type PartidaRepo, type PartidaSalva } from './repo.js';

export interface AppDeps {
  repo: PartidaRepo;
  /** Lida a cada pedido: a lista pode ser recarregada sem reiniciar o servidor. */
  jogadores: () => Jogador[];
  /** AAAA-MM-DD (UTC). */
  hoje: () => string;
  /** SVG da partida daquele dia naquele tema; `null` se não houver o que jogar. */
  renderSvg: (login: string, data: string, tema: ThemeKeys) => Promise<string | null>;
  /** Para testes; o padrão é 30 pedidos por minuto por IP. */
  rateLimiter?: RateLimiter;
}

const ABAS: readonly Aba[] = ['pontos', 'eficiencia'];
const PERIODOS: readonly Periodo[] = ['hoje', '7d', 'recorde'];
const TEMA_PADRAO: ThemeKeys = 'github-dark';
const CACHE_ITENS = 200;
const MAX_AGE_PASSADO = 86_400;
const MAX_AGE_HOJE = 300;

const erro = (c: Context, status: 400 | 404 | 429 | 500, mensagem: string) => c.json({ erro: mensagem }, status);

function temaValido(t: string): t is ThemeKeys {
  return Object.prototype.hasOwnProperty.call(GAME_THEMES, t);
}

/** IP do cliente: primeiro salto do `x-forwarded-for` (proxy do Railway), senão o endereço da conexão. */
function ipDe(c: Context): string {
  const primeiro = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (primeiro) return primeiro;
  try {
    return getConnInfo(c).remote.address ?? 'desconhecido';
  } catch {
    // sem conexão real (app.request nos testes)
    return 'desconhecido';
  }
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

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const cache = new LruCache<{ svg: string; expira: number }>(CACHE_ITENS);
  const emAndamento = new Map<string, Promise<string | null>>();
  const limiter = deps.rateLimiter ?? new RateLimiter({ limite: 30, janelaMs: 60_000 });

  const hoje = (): string => {
    const h = deps.hoje();
    exigirHoje(h);
    return h;
  };
  const acharJogador = (lista: Jogador[], login: string): Jogador | undefined => {
    const k = chaveLogin(login);
    return lista.find((j) => chaveLogin(j.login) === k);
  };

  app.onError((e, c) => {
    console.error('[api]', e);
    return erro(c, 500, 'Erro interno. Tente de novo em instantes.');
  });
  app.notFound((c) => erro(c, 404, 'Página não encontrada.'));

  app.get('/api/ranking', async (c) => {
    const aba = c.req.query('aba') ?? 'pontos';
    const periodo = c.req.query('periodo') ?? 'hoje';
    if (!ABAS.includes(aba as Aba)) return erro(c, 400, `aba inválida: use ${ABAS.join(' ou ')}.`);
    if (!PERIODOS.includes(periodo as Periodo)) {
      return erro(c, 400, `período inválido: use ${PERIODOS.join(', ')}.`);
    }
    const h = hoje();
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
    return c.json({ aba, periodo, hoje: h, linhas });
  });

  app.get('/api/jogador/:login', async (c) => {
    const lista = deps.jogadores();
    const jogador = acharJogador(lista, c.req.param('login'));
    if (!jogador) return erro(c, 404, 'Jogador não encontrado na lista.');
    const h = hoje();
    const partidas = comGrafiaDaLista(await deps.repo.porJogador(jogador.login), lista);

    const inicio30 = addDays(h, -29);
    const ultimos30 = partidas.filter((p) => p.data >= inicio30 && p.data <= h);
    const media30 = ultimos30.length ? ultimos30.reduce((s, p) => s + p.pontos, 0) / ultimos30.length : null;

    const k = chaveLogin(jogador.login);
    const doDia = comGrafiaDaLista(
      await deps.repo.entre(
        h,
        h,
        lista.map((j) => j.login)
      ),
      lista
    );
    const posicao = (aba: Aba): number | null =>
      rankPlayers(doDia, { aba, periodo: 'hoje', hoje: h }).find((l) => chaveLogin(l.login) === k)?.posicao ?? null;

    return c.json({
      login: jogador.login,
      partidas,
      recorde: recordeDe(partidas),
      media30,
      posicaoHoje: { pontos: posicao('pontos'), eficiencia: posicao('eficiencia') },
      publicado: jogador.publicado ?? null
    });
  });

  app.use('/api/partida/*', async (c, next) => {
    const r = limiter.consumir(ipDe(c));
    if (!r.ok) {
      c.header('Retry-After', String(r.retryAfterS));
      return erro(c, 429, 'Muitos pedidos. Espere um pouco e tente de novo.');
    }
    await next();
  });

  app.get('/api/partida/:login/:data', async (c) => {
    const jogador = acharJogador(deps.jogadores(), c.req.param('login'));
    if (!jogador) return erro(c, 404, 'Jogador não encontrado na lista.');
    const data = c.req.param('data');
    if (!dataValida(data)) return erro(c, 400, 'data inválida: use AAAA-MM-DD.');
    const tema = c.req.query('tema') ?? TEMA_PADRAO;
    if (!temaValido(tema)) return erro(c, 400, `tema inválido: use ${Object.keys(GAME_THEMES).join(', ')}.`);

    const ehHoje = data === hoje();
    const chave = `${chaveLogin(jogador.login)}|${data}|${tema}`;
    // a partida de hoje pode ser jogada de novo pelo cron: no cache, ela vence como no navegador
    const guardado = cache.get(chave);
    let svg = guardado && guardado.expira > Date.now() ? guardado.svg : undefined;
    if (svg === undefined) {
      const salvas = await deps.repo.entre(data, data, [jogador.login]);
      if (salvas.length === 0) return erro(c, 404, 'Não há partida deste jogador neste dia.');
      // pedidos simultâneos do mesmo SVG esperam a mesma renderização
      let pendente = emAndamento.get(chave);
      if (!pendente) {
        pendente = deps.renderSvg(jogador.login, data, tema).finally(() => emAndamento.delete(chave));
        emAndamento.set(chave, pendente);
      }
      const novo = await pendente;
      if (novo === null) return erro(c, 404, 'Não há partida deste jogador neste dia.');
      cache.set(chave, { svg: novo, expira: ehHoje ? Date.now() + MAX_AGE_HOJE * 1000 : Infinity });
      svg = novo;
    }

    const maxAge = ehHoje ? MAX_AGE_HOJE : MAX_AGE_PASSADO;
    return c.body(svg, 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`
    });
  });

  return app;
}
