import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../site/src/app.js';
import { LruCache } from '../../site/src/cache.js';
import { RateLimiter } from '../../site/src/ratelimit.js';
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

async function montar(opts: { lista?: Jogador[]; repo?: MemoryRepo } = {}) {
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
    }
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
      { posicao: 1, login: 'bia', valor: 1200, fantasmas: 2, mortes: 1, quadros: 900, data: HOJE },
      { posicao: 2, login: 'AndreRuperto', valor: 900, fantasmas: 2, mortes: 1, quadros: 900, data: HOJE }
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
    expect(body).toEqual({ login: 'novo', partidas: [], recorde: null, media30: null, posicaoHoje: { pontos: null, eficiencia: null }, publicado: null });
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

describe('limite de pedidos', () => {
  it('mais de 30 por minuto do mesmo IP em /api/partida → 429', async () => {
    const { app } = await montar();
    const req = (ip: string) => app.request(`/api/partida/AndreRuperto/${HOJE}`, { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });
    for (let i = 0; i < 30; i++) expect((await req('1.2.3.4')).status).toBe(200);
    const bloqueado = await req('1.2.3.4');
    expect(bloqueado.status).toBe(429);
    expect(Number(bloqueado.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await bloqueado.json()).erro).toBeTypeOf('string');
    expect((await req('5.6.7.8')).status).toBe(200);
    // outras rotas não são limitadas
    expect((await app.request('/api/ranking', { headers: { 'x-forwarded-for': '1.2.3.4' } })).status).toBe(200);
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
