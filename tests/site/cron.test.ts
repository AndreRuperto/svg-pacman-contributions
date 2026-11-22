import { describe, it, expect, vi } from 'vitest';
import { main, runCron, RESERVA, MAX_ERROS_SEGUIDOS, type CronDeps, type FetchWindow } from '../../site/src/cron.js';
import { MemoryRepo } from '../../site/src/repo.js';
import type { Jogador } from '../../site/src/jogadores.js';
import { ENGINE_VERSION, type Partida, type PlayDayOptions } from '../../src/runner.js';
import type { Contribution } from '../../src/types.js';

const ULTIMO = '2026-11-20';
const AGORA = new Date('2026-11-21T10:00:00Z'); // o dia corrente é 21; o último completo, 20

const partida = (login: string, data: string, versao_motor = 'v1'): Partida => ({
  login, data, pontos: 100, fantasmas: 1, mortes: 0, maior_combo: 1, quadros: 900, celulas: 10,
  eficiencia: 10, interrompida: false, versao_motor
});

/** fetchWindow falso: conta as chamadas e devolve um saldo que cai 1 por chamada. */
function fakeFetch(inicio = 5000, falhas: Record<string, string> = {}) {
  const chamadas: string[] = [];
  let saldo = inicio;
  const fn: FetchWindow = async (login, date) => {
    chamadas.push(`${login}|${date}`);
    const erro = falhas[`${login}|${date}`] ?? falhas[login];
    if (erro) throw new Error(erro);
    saldo -= 1;
    return { contributions: [], rateLimit: { remaining: saldo, resetAt: '2026-11-20T13:00:00Z' } };
  };
  return { fn, chamadas, recarregar: (n: number) => { saldo = n; } };
}

/** play falso: devolve uma partida com a versão dada, ou null nos dias de `semJogo`. */
const fakePlay = (versao = 'v1', semJogo: string[] = []) => {
  const chamadas: string[] = [];
  const fn = async ({ login, date }: PlayDayOptions) => {
    chamadas.push(`${login}|${date}`);
    return semJogo.includes(date) ? null : partida(login, date, versao);
  };
  return { fn: fn as CronDeps['play'] & object, chamadas };
};

const ana: Jogador = { login: 'Ana', desde: '2026-11-16' }; // 5 dias até ULTIMO

function deps(over: Partial<CronDeps> & Pick<CronDeps, 'fetchWindow'>): CronDeps {
  const logs: string[] = [];
  return {
    repo: new MemoryRepo(), jogadores: [ana], ultimo: ULTIMO, agora: AGORA, versao: 'v1',
    play: fakePlay().fn, log: (m) => logs.push(m), ...over
  };
}

describe('runCron', () => {
  it('jogador novo: joga cada dia de desde até o último dia completo, do mais recente para o mais antigo', async () => {
    const f = fakeFetch();
    const d = deps({ fetchWindow: f.fn });
    const r = await runCron(d);
    expect(f.chamadas).toEqual(['Ana|2026-11-20', 'Ana|2026-11-19', 'Ana|2026-11-18', 'Ana|2026-11-17', 'Ana|2026-11-16']);
    expect((await d.repo.porJogador('ana')).map((p) => p.data)).toEqual([
      '2026-11-20', '2026-11-19', '2026-11-18', '2026-11-17', '2026-11-16'
    ]);
    expect(r.parou).toBeNull();
    expect(r.jogadores).toEqual([expect.objectContaining({ login: 'Ana', jogadas: 5, semJogo: 0, erros: 0, pendentes: 0 })]);
    expect(r.total).toMatchObject({ jogadas: 5, erros: 0 });
  });

  it('segunda rodada: não chama o fetchWindow de novo e não duplica partidas', async () => {
    const f = fakeFetch();
    const d = deps({ fetchWindow: f.fn });
    await runCron(d);
    f.chamadas.length = 0;
    const r = await runCron(d);
    expect(f.chamadas).toEqual([]);
    expect(await d.repo.porJogador('Ana')).toHaveLength(5);
    expect(r.total.jogadas).toBe(0);
  });

  it(`saldo da API: abaixo de RESERVA (${RESERVA}) a rodada para; a seguinte continua de onde parou`, async () => {
    const f = fakeFetch(RESERVA + 2); // 51, 50, 49 → para depois da 3ª chamada
    const bia: Jogador = { login: 'bia', desde: '2026-11-19' };
    const d = deps({ fetchWindow: f.fn, jogadores: [ana, bia] });
    const r1 = await runCron(d);
    expect(r1.parou).toBe('limite');
    expect(f.chamadas).toEqual(['Ana|2026-11-20', 'Ana|2026-11-19', 'Ana|2026-11-18']);
    expect((await d.repo.porJogador('ana')).map((p) => p.data)).toEqual(['2026-11-20', '2026-11-19', '2026-11-18']);
    expect(r1.jogadores).toEqual([
      expect.objectContaining({ login: 'Ana', jogadas: 3, pendentes: 2 }),
      expect.objectContaining({ login: 'bia', jogadas: 0, pendentes: 2 })
    ]);

    f.recarregar(5000);
    f.chamadas.length = 0;
    const r2 = await runCron(d);
    expect(r2.parou).toBeNull();
    expect(f.chamadas).toEqual(['Ana|2026-11-17', 'Ana|2026-11-16', 'bia|2026-11-20', 'bia|2026-11-19']);
    expect(await d.repo.porJogador('ana')).toHaveLength(5);
    expect(await d.repo.porJogador('bia')).toHaveLength(2);
  });

  it('saldo desconhecido (rateLimit null) não para a rodada, mas fica no log', async () => {
    const logs: string[] = [];
    const d = deps({
      fetchWindow: async () => ({ contributions: [], rateLimit: null }),
      log: (m) => logs.push(m)
    });
    const r = await runCron(d);
    expect(r.parou).toBeNull();
    expect(r.total.jogadas).toBe(5);
    expect(logs.some((m) => /saldo .*desconhecido/i.test(m))).toBe(true);
  });

  it('login inexistente: é pulado com aviso e os outros jogam normalmente', async () => {
    const f = fakeFetch(5000, { fantasma: 'USUARIO_NAO_ENCONTRADO' });
    const fantasma: Jogador = { login: 'fantasma', desde: '2026-11-16' };
    const d = deps({ fetchWindow: f.fn, jogadores: [fantasma, ana] });
    const r = await runCron(d);
    expect(f.chamadas.filter((c) => c.startsWith('fantasma'))).toHaveLength(1);
    expect(r.avisos).toEqual([expect.stringContaining('fantasma')]);
    expect(r.jogadores[0]).toMatchObject({ login: 'fantasma', jogadas: 0, aviso: expect.stringMatching(/não encontrado/) });
    expect(await d.repo.porJogador('ana')).toHaveLength(5);
  });

  it('erro num dia: registra, segue para o próximo dia e conta no resumo', async () => {
    const f = fakeFetch(5000, { 'Ana|2026-11-19': 'GITHUB_502' });
    const d = deps({ fetchWindow: f.fn });
    const r = await runCron(d);
    expect((await d.repo.porJogador('ana')).map((p) => p.data)).toEqual(['2026-11-20', '2026-11-18', '2026-11-17', '2026-11-16']);
    expect(r.jogadores[0]).toMatchObject({ jogadas: 4, erros: 1 });
    expect(r.total.erros).toBe(1);
  });

  it('erro no play (ex.: PARTIDA_NAO_TERMINOU) também só pula o dia', async () => {
    const d = deps({
      fetchWindow: fakeFetch().fn,
      play: async ({ login, date }) => {
        if (date === '2026-11-18') throw new Error('PARTIDA_NAO_TERMINOU');
        return partida(login, date);
      }
    });
    const r = await runCron(d);
    expect(r.jogadores[0]).toMatchObject({ jogadas: 4, erros: 1 });
  });

  it(`${MAX_ERROS_SEGUIDOS} erros seguidos: desiste do jogador nesta rodada e segue para o próximo`, async () => {
    const f = fakeFetch(5000, { Ana: 'GITHUB_503' });
    const longo: Jogador = { login: 'Ana', desde: '2026-10-01' };
    const bia: Jogador = { login: 'bia', desde: '2026-11-20' };
    const d = deps({ fetchWindow: f.fn, jogadores: [longo, bia] });
    const r = await runCron(d);
    expect(f.chamadas.filter((c) => c.startsWith('Ana'))).toHaveLength(MAX_ERROS_SEGUIDOS);
    expect(r.jogadores[0]).toMatchObject({ erros: MAX_ERROS_SEGUIDOS, aviso: expect.stringMatching(/erros seguidos/) });
    expect(await d.repo.porJogador('bia')).toHaveLength(1);
  });

  it('dia sem contribuições: nada é gravado e o dia não é buscado de novo', async () => {
    const f = fakeFetch();
    const play = fakePlay('v1', ['2026-11-17']);
    const d = deps({ fetchWindow: f.fn, play: play.fn });
    const r1 = await runCron(d);
    expect(play.chamadas.filter((c) => c.endsWith('2026-11-17'))).toHaveLength(1);
    expect((await d.repo.porJogador('ana')).map((p) => p.data)).not.toContain('2026-11-17');
    expect(r1.jogadores[0]).toMatchObject({ jogadas: 4, semJogo: 1 });

    f.chamadas.length = 0;
    await runCron(d);
    expect(f.chamadas).toEqual([]);
  });

  it('mudança de versão: as partidas antigas voltam a ser jogadas (e os dias sem jogo também)', async () => {
    const f = fakeFetch();
    const d = deps({ fetchWindow: f.fn, play: fakePlay('v1', ['2026-11-17']).fn });
    await runCron(d);
    f.chamadas.length = 0;
    const r = await runCron({ ...d, versao: 'v2', play: fakePlay('v2').fn });
    expect(f.chamadas).toHaveLength(5);
    expect(r.total.jogadas).toBe(5);
    const partidas = await d.repo.porJogador('ana');
    expect(partidas).toHaveLength(5);
    expect(new Set(partidas.map((p) => p.versao_motor))).toEqual(new Set(['v2']));
  });

  it('SVG publicado: marca publicado_sha nos dias que têm commit naquele caminho', async () => {
    const pub = { repo: 'Ana/Ana', branch: 'output', path: 'dist/pacman.svg' };
    const pedidos: unknown[] = [];
    const d = deps({
      fetchWindow: fakeFetch().fn,
      jogadores: [{ ...ana, publicado: pub }, { login: 'bia', desde: '2026-11-20' }],
      listPublished: async (p, since) => {
        pedidos.push({ p, since });
        return [{ date: '2026-11-19', sha: 'abc' }, { date: '2026-11-01', sha: 'antes' }];
      }
    });
    const r = await runCron(d);
    expect(pedidos).toEqual([{ p: pub, since: '2026-11-16' }]); // bia não tem `publicado`
    const porData = Object.fromEntries((await d.repo.porJogador('ana')).map((p) => [p.data, p.publicado_sha]));
    expect(porData).toEqual({
      '2026-11-20': null, '2026-11-19': 'abc', '2026-11-18': null, '2026-11-17': null, '2026-11-16': null
    });
    expect(r.jogadores[0]).toMatchObject({ publicados: 1 });
    // na rodada seguinte o sha já está gravado: não conta de novo
    const r2 = await runCron(d);
    expect(r2.jogadores[0]).toMatchObject({ publicados: 0 });
  });

  it('falha ao listar os SVGs publicados vira aviso, sem derrubar a rodada', async () => {
    const d = deps({
      fetchWindow: fakeFetch().fn,
      jogadores: [{ ...ana, publicado: { repo: 'Ana/Ana', branch: 'output', path: 'x.svg' } }],
      listPublished: async () => { throw new Error('GITHUB_404'); }
    });
    const r = await runCron(d);
    expect(r.total.jogadas).toBe(5);
    expect(r.avisos).toEqual([expect.stringContaining('GITHUB_404')]);
  });

  it('listPublished: a primeira vez desde `desde`; com sha já gravado, só os últimos 14 dias', async () => {
    const pub = { repo: 'Ana/Ana', branch: 'output', path: 'dist/pacman.svg' };
    const pedidos: string[] = [];
    const d = deps({
      fetchWindow: fakeFetch().fn,
      jogadores: [{ login: 'Ana', desde: '2026-10-01', publicado: pub }],
      listPublished: async (_p, since) => {
        pedidos.push(since);
        return [{ date: '2026-11-19', sha: 'abc' }];
      }
    });
    await runCron(d);
    await runCron(d);
    expect(pedidos).toEqual(['2026-10-01', '2026-11-06']);
  });

  it('listPublished: sem nenhum sha gravado ainda, continua pedindo desde `desde`', async () => {
    const pedidos: string[] = [];
    const d = deps({
      fetchWindow: fakeFetch().fn,
      jogadores: [{ login: 'Ana', desde: '2026-10-01', publicado: { repo: 'a/b', branch: 'o', path: 'x.svg' } }],
      listPublished: async (_p, since) => { pedidos.push(since); return []; }
    });
    await runCron(d);
    await runCron(d);
    expect(pedidos).toEqual(['2026-10-01', '2026-10-01']);
  });

  describe('o dia corrente nunca é jogado', () => {
    const agora = new Date('2026-11-20T10:00:00Z');

    it('sem `ultimo`, joga até a véspera (ultimoDiaCompleto)', async () => {
      const f = fakeFetch();
      const play = fakePlay('v1', ['2026-11-19']);
      const d = deps({ fetchWindow: f.fn, play: play.fn, agora, ultimo: undefined, jogadores: [{ login: 'Ana', desde: '2026-11-18' }] });
      await runCron(d);
      expect(f.chamadas).toEqual(['Ana|2026-11-19', 'Ana|2026-11-18']);
      expect(await d.repo.diasSemJogo('ana', 'v1')).toEqual(new Set(['2026-11-19']));
    });

    it('um `ultimo` igual ou depois do dia corrente é trazido para a véspera, com log', async () => {
      const f = fakeFetch();
      const logs: string[] = [];
      const play = fakePlay('v1', ['2026-11-20', '2026-11-21']);
      const d = deps({
        fetchWindow: f.fn, play: play.fn, agora, ultimo: '2026-11-21', log: (m) => logs.push(m),
        jogadores: [{ login: 'Ana', desde: '2026-11-19' }]
      });
      await runCron(d);
      expect(f.chamadas).toEqual(['Ana|2026-11-19']);
      expect(await d.repo.diasSemJogo('ana', 'v1')).toEqual(new Set());
      expect(logs.some((m) => m.includes('2026-11-19'))).toBe(true);
    });
  });

  it('401 por token expirado interrompe todos os jogadores sem tentar outros dias', async () => {
    const f = fakeFetch(5000, { 'Ana|2026-11-19': 'GITHUB_401' });
    const bia: Jogador = { login: 'bia', desde: '2026-11-20' };
    const logs: string[] = [];
    const d = deps({ fetchWindow: f.fn, jogadores: [ana, bia], log: (m) => logs.push(m) });
    const r = await runCron(d);
    expect(r.parou).toBe('token');
    expect(f.chamadas).toEqual(['Ana|2026-11-20', 'Ana|2026-11-19']);
    expect(r.jogadores).toEqual([
      expect.objectContaining({ login: 'Ana', jogadas: 1, erros: 0, pendentes: 4 }),
      expect.objectContaining({ login: 'bia', jogadas: 0, erros: 0, pendentes: 1 })
    ]);
    expect(logs.some((m) => /credencial GitHub inválida ou expirada/i.test(m))).toBe(true);
  });

  it.each(['GITHUB_403', 'GITHUB_429'])('%s (limite secundário) para a rodada sem gastar as tentativas', async (erro) => {
    const f = fakeFetch(5000, { 'Ana|2026-11-19': erro });
    const bia: Jogador = { login: 'bia', desde: '2026-11-20' };
    const d = deps({ fetchWindow: f.fn, jogadores: [ana, bia] });
    const r = await runCron(d);
    expect(r.parou).toBe('limite');
    expect(f.chamadas).toEqual(['Ana|2026-11-20', 'Ana|2026-11-19']);
    expect(r.jogadores).toEqual([
      expect.objectContaining({ login: 'Ana', jogadas: 1, erros: 0, pendentes: 4 }),
      expect.objectContaining({ login: 'bia', jogadas: 0, pendentes: 1 })
    ]);
  });

  it('o saldo é conferido antes do play: mesmo se o play falhar naquele dia, a rodada para', async () => {
    const f = fakeFetch(RESERVA + 1); // 50, 49 → para depois da 2ª chamada
    const d = deps({
      fetchWindow: f.fn,
      play: async ({ login, date }) => {
        if (date === '2026-11-19') throw new Error('PARTIDA_NAO_TERMINOU');
        return partida(login, date);
      }
    });
    const r = await runCron(d);
    expect(r.parou).toBe('limite');
    expect(f.chamadas).toEqual(['Ana|2026-11-20', 'Ana|2026-11-19']);
    expect(r.jogadores[0]).toMatchObject({ jogadas: 1, erros: 1, pendentes: 3 });
  });

  it('desde depois do último dia: nada a jogar', async () => {
    const f = fakeFetch();
    const r = await runCron(deps({ fetchWindow: f.fn, jogadores: [{ login: 'Ana', desde: '2026-12-01' }] }));
    expect(f.chamadas).toEqual([]);
    expect(r.total.jogadas).toBe(0);
  });

  it('com o playDay de verdade, grava a partida na versão do motor', async () => {
    const contributions: Contribution[] = Array.from({ length: 40 }, (_, i) => {
      const d = new Date(`${ULTIMO}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i * 3);
      return { date: d, count: 1 + (i % 4), color: '', level: 'SECOND_QUARTILE' };
    });
    const repo = new MemoryRepo();
    const r = await runCron({
      repo, ultimo: ULTIMO, agora: AGORA, jogadores: [{ login: 'Ana', desde: ULTIMO }],
      fetchWindow: async () => ({ contributions, rateLimit: { remaining: 4000, resetAt: '' } })
    });
    expect(r.total.jogadas).toBe(1);
    const [p] = await repo.porJogador('ana');
    expect(p).toMatchObject({ login: 'Ana', data: ULTIMO, versao_motor: ENGINE_VERSION, publicado_sha: null });
    expect(p.celulas).toBeGreaterThan(0);
    expect(p).not.toHaveProperty('svg');
  });

  it('recusa um último dia inválido', async () => {
    await expect(runCron(deps({ fetchWindow: fakeFetch().fn, ultimo: '2026-13-01' }))).rejects.toThrow(/ultimo/);
  });
});

describe('main', () => {
  it('sai com 1 se faltar DATABASE_URL ou GITHUB_TOKEN', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main({})).toBe(1);
    expect(await main({ DATABASE_URL: 'postgres://x' })).toBe(1);
    expect(erro).toHaveBeenCalledWith(expect.stringMatching(/DATABASE_URL e GITHUB_TOKEN/));
    erro.mockRestore();
  });

  it('sai com 1 se HOJE for inválido', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main({ DATABASE_URL: 'postgres://x', GITHUB_TOKEN: 't', HOJE: '20-11-2026' })).toBe(1);
    erro.mockRestore();
  });
});
