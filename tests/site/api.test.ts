import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, type AppDeps } from '../../site/src/app.js';
import { LruCache } from '../../site/src/cache.js';
import { FilaCheia, RateLimiter, Semaforo } from '../../site/src/ratelimit.js';
import { MemoryRepo } from '../../site/src/repo.js';
import type { Jogador } from '../../site/src/jogadores.js';
import type { Partida } from '../../src/runner.js';

const HOJE = '2026-11-20';

const p = (login: string, data: string, pontos: number, extra: Partial<Partida> = {}): Partida => ({
  login, data, pontos, fantasmas: 2, mortes: 1, maior_combo: 3, quadros: 900, celulas: 100,
  eficiencia: pontos / 100, interrompida: false, versao_motor: '1.1.0', ...extra
});

const jogadores: Jogador[] = [
  { login: 'AndreRuperto', desde: '2026-01-01', publicado: { repo: 'AndreRuperto/AndreRuperto', branch: 'output', path: 'dist/pacman-contribution-graph-dark.svg' } },
  { login: 'bia', desde: '2026-01-01' }
];

async function montar(opts: { lista?: Jogador[]; repo?: MemoryRepo; deps?: Partial<AppDeps> } = {}) {
  const repo = opts.repo ?? new MemoryRepo();
  for (const x of [
    p('AndreRuperto', HOJE, 900, { eficiencia: 3 }),
    p('bia', HOJE, 1200, { eficiencia: 2 }),
    p('AndreRuperto', '2026-11-19', 5000, { interrompida: true }),
    p('AndreRuperto', '2026-11-15', 2000),
    p('AndreRuperto', '2026-09-01', 3000), // fora dos 30 dias
    p('bia', '2026-11-10', 8000),
    p('fora', HOJE, 99999)
  ]) await repo.upsert(x);
  await repo.marcarPublicado('AndreRuperto', HOJE, 'abc');
  const chamadas: string[] = [];
  const lista = opts.lista ?? jogadores;
  const app = createApp({
    repo,
    jogadores: () => lista,
    hoje: () => HOJE,
    renderSvg: async (login, data, tema) => {
      chamadas.push(`${login}|${data}|${tema}`);
      return `<svg data-login="${login}" data-data="${data}" data-tema="${tema}"/>`;
    },
    ...opts.deps
  });
  return { app, repo, chamadas };
}

describe('GET /api/ranking', () => {
  it('hoje por pontos, só jogadores da lista', async () => {
    const { app } = await montar();
    const res = await app.request('/api/ranking?aba=pontos&periodo=hoje');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ aba: 'pontos', periodo: 'hoje', hoje: HOJE });
    expect(body.linhas).toEqual([
      { posicao: 1, login: 'bia', valor: 1200, pontos: 1200, eficiencia: 2, fantasmas: 2, mortes: 1, quadros: 900, data: HOJE },
      { posicao: 2, login: 'AndreRuperto', valor: 900, pontos: 900, eficiencia: 3, fantasmas: 2, mortes: 1, quadros: 900, data: HOJE }
    ]);
  });
  it('padrão é pontos/hoje', async () => {
    const { app } = await montar();
    const body = await (await app.request('/api/ranking')).json();
    expect(body).toMatchObject({ aba: 'pontos', periodo: 'hoje' });
  });
  it('7d usa só a janela de 7 dias', async () => {
    const { app } = await montar();
    const body = await (await app.request('/api/ranking?aba=pontos&periodo=7d')).json();
    const andre = body.linhas.find((l: { login: string }) => l.login === 'AndreRuperto');
    expect(andre.valor).toBeCloseTo((900 + 5000 + 2000) / 3);
    // a outra métrica também é a média do período
    expect(andre.pontos).toBe(andre.valor);
    expect(andre.eficiencia).toBeCloseTo((3 + 50 + 20) / 3);
    expect(body.linhas.find((l: { login: string }) => l.login === 'bia').valor).toBe(1200);
  });
  it('recorde usa todas as partidas e ignora interrompidas', async () => {
    const { app } = await montar();
    const body = await (await app.request('/api/ranking?aba=pontos&periodo=recorde')).json();
    expect(body.linhas.map((l: { login: string; valor: number }) => [l.login, l.valor])).toEqual([
      ['bia', 8000], ['AndreRuperto', 3000]
    ]);
  });
  it('a lista é lida a cada pedido', async () => {
    const lista: Jogador[] = [...jogadores];
    const { app } = await montar({ lista });
    lista.pop();
    const body = await (await app.request('/api/ranking')).json();
    expect(body.linhas.map((l: { login: string }) => l.login)).toEqual(['AndreRuperto']);
  });
  it('aba ou período inválidos → 400 com erro em português', async () => {
    const { app } = await montar();
    const r1 = await app.request('/api/ranking?aba=xis&periodo=hoje');
    expect(r1.status).toBe(400);
    expect((await r1.json()).erro).toMatch(/aba/);
    const r2 = await app.request('/api/ranking?aba=pontos&periodo=ontem');
    expect(r2.status).toBe(400);
    expect((await r2.json()).erro).toMatch(/período/);
  });
});

describe('GET /api/jogador/:login', () => {
  it('responde o perfil com a grafia da lista', async () => {
    const { app } = await montar();
    const res = await app.request('/api/jogador/andreruperto');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.login).toBe('AndreRuperto');
    expect(body.partidas.map((x: { data: string }) => x.data)).toEqual([HOJE, '2026-11-19', '2026-11-15', '2026-09-01']);
    expect(body.partidas[0].publicado_sha).toBe('abc');
    expect(body.recorde).toMatchObject({ data: '2026-09-01', pontos: 3000 });
    expect(body.media30).toBeCloseTo((900 + 5000 + 2000) / 3);
    expect(body.posicaoHoje).toEqual({ pontos: 2, eficiencia: 1 });
    expect(body.publicado).toEqual(jogadores[0].publicado);
  });
  it('sem partidas: recorde, média e posição nulos', async () => {
    const { app } = await montar({ lista: [...jogadores, { login: 'novo', desde: HOJE }] });
    const body = await (await app.request('/api/jogador/novo')).json();
    expect(body).toEqual({ login: 'novo', desde: HOJE, partidas: [], recorde: null, media30: null, posicaoHoje: { pontos: null, eficiencia: null }, publicado: null });
  });
  it('fora da lista → 404', async () => {
    const { app } = await montar();
    const res = await app.request('/api/jogador/fulano');
    expect(res.status).toBe(404);
    expect((await res.json()).erro).toBeTypeOf('string');
  });
});

describe('GET /api/partida/:login/:data', () => {
  it('devolve o SVG e usa o cache na segunda chamada', async () => {
    const { app, chamadas } = await montar();
    const res = await app.request(`/api/partida/AndreRuperto/${HOJE}?tema=neon`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(await res.text()).toBe(`<svg data-login="AndreRuperto" data-data="${HOJE}" data-tema="neon"/>`);
    const res2 = await app.request(`/api/partida/andreruperto/${HOJE}?tema=neon`);
    expect(res2.status).toBe(200);
    expect(chamadas).toEqual([`AndreRuperto|${HOJE}|neon`]);
  });
  it('tema padrão github-dark e cache longo para dias passados', async () => {
    const { app, chamadas } = await montar();
    const res = await app.request('/api/partida/AndreRuperto/2026-11-15');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(chamadas).toEqual(['AndreRuperto|2026-11-15|github-dark']);
  });
  it('tema inválido → 400', async () => {
    const { app, chamadas } = await montar();
    const res = await app.request(`/api/partida/AndreRuperto/${HOJE}?tema=rosa`);
    expect(res.status).toBe(400);
    expect((await res.json()).erro).toMatch(/tema/);
    expect(chamadas).toEqual([]);
  });
  it('data inválida → 400', async () => {
    const { app } = await montar();
    expect((await app.request('/api/partida/AndreRuperto/2026-02-30')).status).toBe(400);
  });
  it('dia sem partida → 404 sem chamar renderSvg', async () => {
    const { app, chamadas } = await montar();
    expect((await app.request('/api/partida/AndreRuperto/2026-11-18')).status).toBe(404);
    expect(chamadas).toEqual([]);
  });
  it('login fora da lista → 404', async () => {
    const { app } = await montar();
    expect((await app.request(`/api/partida/fora/${HOJE}`)).status).toBe(404);
  });
  it('renderSvg devolve null → 404', async () => {
    const repo = new MemoryRepo();
    await repo.upsert(p('bia', HOJE, 1));
    const app = createApp({ repo, jogadores: () => jogadores, hoje: () => HOJE, renderSvg: async () => null });
    expect((await app.request(`/api/partida/bia/${HOJE}`)).status).toBe(404);
  });
});

type App = Awaited<ReturnType<typeof montar>>['app'];
const pedirPartida = (app: App, headers: Record<string, string> = {}, tema = 'github-dark') =>
  Promise.resolve(app.request(`/api/partida/AndreRuperto/${HOJE}?tema=${tema}`, { headers }));
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('limite de pedidos', () => {
  it('mais de 30 por minuto do mesmo IP em /api/partida → 429 com Retry-After', async () => {
    const { app } = await montar({ deps: { confiarProxy: true } });
    for (let i = 0; i < 30; i++) expect((await pedirPartida(app, { 'x-real-ip': '1.2.3.4' })).status).toBe(200);
    const bloqueado = await pedirPartida(app, { 'x-real-ip': '1.2.3.4' });
    expect(bloqueado.status).toBe(429);
    expect(Number(bloqueado.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await bloqueado.json()).erro).toBeTypeOf('string');
    expect((await pedirPartida(app, { 'x-real-ip': '5.6.7.8' })).status).toBe(200);
    // as rotas JSON têm orçamento próprio
    expect((await app.request('/api/ranking', { headers: { 'x-real-ip': '1.2.3.4' } })).status).toBe(200);
  });

  it('confiarProxy: trocar o primeiro item do x-forwarded-for não zera o limite (vale o último)', async () => {
    const { app } = await montar({ deps: { confiarProxy: true } });
    for (let i = 0; i < 30; i++) {
      expect((await pedirPartida(app, { 'x-forwarded-for': `aleatorio-${i}, 9.9.9.9` })).status).toBe(200);
    }
    expect((await pedirPartida(app, { 'x-forwarded-for': 'outro, 9.9.9.9' })).status).toBe(429);
    expect((await pedirPartida(app, { 'x-forwarded-for': 'outro, 8.8.8.8' })).status).toBe(200);
  });

  it('sem confiarProxy, os cabeçalhos são ignorados (vale o socket)', async () => {
    const { app } = await montar();
    for (let i = 0; i < 30; i++) {
      expect((await pedirPartida(app, { 'x-real-ip': `1.1.1.${i}`, 'x-forwarded-for': `2.2.2.${i}` })).status).toBe(200);
    }
    expect((await pedirPartida(app, { 'x-real-ip': '3.3.3.3' })).status).toBe(429);
  });

  it('rotas JSON: 120 por minuto por IP', async () => {
    const { app } = await montar({ deps: { confiarProxy: true } });
    const req = () => app.request('/api/ranking', { headers: { 'x-real-ip': '4.4.4.4' } });
    for (let i = 0; i < 120; i++) expect((await req()).status).toBe(200);
    const r = await req();
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBeTruthy();
    expect((await r.json()).erro).toBeTypeOf('string');
  });
});

describe('memo das rotas JSON', () => {
  it('ranking e jogador ficam 60 s em memória, com Cache-Control de 60 s', async () => {
    let agora = 1_000_000;
    const { app, repo } = await montar({ deps: { agora: () => agora } });
    const r1 = await app.request('/api/ranking');
    expect(r1.headers.get('cache-control')).toBe('public, max-age=60');
    const j1 = await app.request('/api/jogador/bia');
    expect(j1.headers.get('cache-control')).toBe('public, max-age=60');
    const rankingAntes = await r1.json();
    const jogadorAntes = await j1.json();
    await repo.upsert(p('bia', HOJE, 1));
    expect(await (await app.request('/api/ranking')).json()).toEqual(rankingAntes);
    expect(await (await app.request('/api/jogador/BIA')).json()).toEqual(jogadorAntes);
    agora += 60_001;
    expect((await (await app.request('/api/ranking')).json()).linhas[0].login).toBe('AndreRuperto');
    expect((await (await app.request('/api/jogador/bia')).json()).partidas[0].pontos).toBe(1);
  });
  it('a chave do memo inclui aba e período', async () => {
    const { app } = await montar();
    await app.request('/api/ranking?aba=pontos&periodo=hoje');
    expect((await (await app.request('/api/ranking?aba=eficiencia&periodo=recorde')).json())).toMatchObject({
      aba: 'eficiencia',
      periodo: 'recorde'
    });
  });
});

describe('SVG: cabeçalhos, versão, concorrência e falhas', () => {
  it('nosniff e CSP restritiva', async () => {
    const { app } = await montar();
    const res = await pedirPartida(app);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; style-src 'unsafe-inline'");
  });
  it('a chave do cache inclui a versão do motor da partida salva', async () => {
    const { app, repo, chamadas } = await montar();
    await pedirPartida(app);
    await pedirPartida(app);
    expect(chamadas).toHaveLength(1);
    await repo.upsert(p('AndreRuperto', HOJE, 900, { versao_motor: '9.9.9' }));
    await pedirPartida(app);
    expect(chamadas).toHaveLength(2);
  });
  it('dois pedidos simultâneos do mesmo SVG → um render', async () => {
    const { app, chamadas } = await montar();
    const [a, b] = await Promise.all([pedirPartida(app), pedirPartida(app)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await a.text()).toBe(await b.text());
    expect(chamadas).toHaveLength(1);
  });
  it('falha de render → 500 com erro, não cacheia, o próximo pedido renderiza de novo', async () => {
    let n = 0;
    const { app } = await montar({
      deps: {
        renderSvg: async () => {
          n++;
          if (n === 1) throw new Error('GitHub fora do ar');
          return '<svg/>';
        }
      }
    });
    const r1 = await pedirPartida(app);
    expect(r1.status).toBe(500);
    expect((await r1.json()).erro).toBeTypeOf('string');
    const r2 = await pedirPartida(app);
    expect(r2.status).toBe(200);
    expect(await r2.text()).toBe('<svg/>');
    expect(n).toBe(2);
  });
  it('no máximo maxRenders ao mesmo tempo', async () => {
    let ativos = 0;
    let pico = 0;
    const { app } = await montar({
      deps: {
        maxRenders: 2,
        renderSvg: async () => {
          ativos++;
          pico = Math.max(pico, ativos);
          await esperar(5);
          ativos--;
          return '<svg/>';
        }
      }
    });
    const temas = ['neon', 'arcade', 'brasa', 'github', 'gitlab'];
    const res = await Promise.all(temas.map((t) => pedirPartida(app, {}, t)));
    expect(res.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(pico).toBe(2);
  });
  it('fila cheia → 503 com Retry-After: 5', async () => {
    const { app } = await montar({
      deps: {
        maxRenders: 1,
        maxFila: 1,
        renderSvg: async () => {
          await esperar(5);
          return '<svg/>';
        }
      }
    });
    const res = await Promise.all(['neon', 'arcade', 'brasa'].map((t) => pedirPartida(app, {}, t)));
    expect(res.map((r) => r.status).sort()).toEqual([200, 200, 503]);
    const recusado = res.find((r) => r.status === 503)!;
    expect(recusado.headers.get('retry-after')).toBe('5');
    expect((await recusado.json()).erro).toBeTypeOf('string');
  });
});

describe('rotas fora da API', () => {
  it('404 em JSON dentro de /api e em HTML fora dela', async () => {
    const { app } = await montar();
    const a = await app.request('/api/nada');
    expect(a.status).toBe(404);
    expect((await a.json()).erro).toBeTypeOf('string');
    const b = await app.request('/qualquer');
    expect(b.status).toBe(404);
    expect(b.headers.get('content-type')).toMatch(/^text\/html/);
  });
});

describe('LruCache com teto de bytes', () => {
  it('descarta os mais antigos quando a soma dos pesos passa do teto', () => {
    const c = new LruCache<string>(100, { maxPeso: 10, peso: (v) => v.length });
    c.set('a', '12345');
    c.set('b', '12345');
    expect(c.peso).toBe(10);
    c.set('c', '123');
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe('12345');
    expect(c.peso).toBe(8);
    c.set('b', '1');
    expect(c.peso).toBe(4);
    c.set('grande', '12345678901');
    expect(c.get('grande')).toBeUndefined();
    expect(c.peso).toBe(4);
  });
});

describe('Semaforo', () => {
  it('limita os simultâneos e recusa com a fila cheia', async () => {
    const s = new Semaforo(1, 1);
    let soltar!: () => void;
    const a = s.executar(() => new Promise<number>((r) => (soltar = () => r(1))));
    const b = s.executar(async () => 2);
    await expect(s.executar(async () => 3)).rejects.toBeInstanceOf(FilaCheia);
    soltar();
    expect(await a).toBe(1);
    expect(await b).toBe(2);
    expect(await s.executar(async () => 4)).toBe(4);
  });
  it('libera a vaga quando a tarefa falha', async () => {
    const s = new Semaforo(1, 0);
    await expect(
      s.executar(async () => {
        throw new Error('x');
      })
    ).rejects.toThrow('x');
    expect(await s.executar(async () => 5)).toBe(5);
  });
});

describe('LruCache', () => {
  it('descarta o menos usado', () => {
    const c = new LruCache<number>(2);
    c.set('a', 1); c.set('b', 2);
    expect(c.get('a')).toBe(1);
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(c.size).toBe(2);
  });
});

describe('RateLimiter', () => {
  let agora: number;
  beforeEach(() => { agora = 0; });
  it('janela fixa: libera de novo na janela seguinte e não cresce sem limite', () => {
    const rl = new RateLimiter({ limite: 2, janelaMs: 1000, maxChaves: 3, agora: () => agora });
    expect(rl.consumir('a').ok).toBe(true);
    expect(rl.consumir('a').ok).toBe(true);
    const r = rl.consumir('a');
    expect(r.ok).toBe(false);
    expect(r.retryAfterS).toBe(1);
    agora = 1000;
    expect(rl.consumir('a').ok).toBe(true);
    for (const k of ['b', 'c', 'd', 'e']) rl.consumir(k);
    expect(rl.tamanho).toBeLessThanOrEqual(3);
  });
});
