import { describe, expect, it, vi } from 'vitest';
import { runCron } from '../../site/src/cron.js';
import { createApp } from '../../site/src/app.js';
import { MemoryRepo } from '../../site/src/repo.js';
import { guardarSnapshot, recuperarSnapshot } from '../../site/src/snapshot.js';
import { assinaturaReplay, cacheavel } from '../../site/src/replay-cache.js';
import { validarReplay } from '../../site/src/web.js';
import { playDay, type Partida } from '../../src/runner.js';
import type { Contribution } from '../../src/types.js';

const DIA = '2026-11-20';
const contribuicoes: Contribution[] = [
  { date: new Date('2026-11-20T00:00:00Z'), count: 7, color: '', level: 'SECOND_QUARTILE' }
];

describe('integração real: cron → snapshot → replay → cache', () => {
  it('reproduz o placar original sem nova consulta ao GitHub e usa cache após reinício', async () => {
    const repo = new MemoryRepo();
    const github = vi.fn(async () => ({ contributions: contribuicoes, rateLimit: { remaining: 300, resetAt: '2026-11-21T00:00:00Z' } }));
    const resultado = await runCron({
      repo,
      jogadores: [{ login: 'ana', desde: DIA }],
      ultimo: DIA,
      agora: new Date('2026-11-21T10:00:00Z'),
      fetchWindow: github
    });
    expect(resultado.total.jogadas).toBe(1);
    expect(github).toHaveBeenCalledTimes(1);
    const [salva] = await repo.porJogador('ana');
    const snapshot = await repo.obterSnapshot('ana', DIA);
    expect(snapshot).toEqual(guardarSnapshot(contribuicoes));
    expect(assinaturaReplay(salva, snapshot!)).toHaveLength(64);

    let simulacoes = 0;
    const construir = () => createApp({
      repo, jogadores: () => [{ login: 'ana', desde: DIA }],
      hoje: () => DIA,
      renderSvg: async (login, date, theme, partidaSalva, janela) => {
        simulacoes++;
        expect(janela).not.toBeNull();
        const rodada = await playDay({
          login, date, theme,
          contributions: recuperarSnapshot(janela),
          withSvg: true
        });
        validarReplay(partidaSalva, rodada);
        return rodada?.svg ?? null;
      }
    });
    const appA = construir();
    const a = await appA.request(`/api/partida/ana/${DIA}?tema=neon`);
    expect(a.status).toBe(200);
    const svg = await a.text();
    expect(cacheavel(svg)).toBe(true);
    expect(a.headers.get('x-pacman-cache')).toBe('gerado');
    expect(a.headers.get('x-pacman-replay')).toBe('verificado');
    expect(a.headers.get('server-timing')).toMatch(/^replay;dur=/);
    expect(await repo.obterSvg('ana', DIA, 'neon', assinaturaReplay(salva, snapshot!))).toBe(svg);

    const emRam = await appA.request(`/api/partida/ana/${DIA}?tema=neon`);
    expect(emRam.headers.get('x-pacman-cache')).toBe('memoria');

    const appB = construir(); // simula reinício: a RAM é nova, o repo persiste
    const b = await appB.request(`/api/partida/ana/${DIA}?tema=neon`);
    expect(b.status).toBe(200);
    expect(b.headers.get('x-pacman-cache')).toBe('persistente');
    expect(await b.text()).toBe(svg);
    expect(simulacoes).toBe(1);
    expect(github).toHaveBeenCalledTimes(1);

    // Alteração maliciosa/acidental de placar invalida a assinatura e não
    // pode entregar a animação de uma partida diferente.
    await repo.upsert({ ...salva, pontos: salva.pontos + 1, snapshot: snapshot! });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const divergente = await appB.request(`/api/partida/ana/${DIA}?tema=neon`);
      expect(divergente.status).toBe(503);
      expect(divergente.headers.get('x-pacman-cache')).toBeNull();
    } finally {
      aviso.mockRestore();
    }
  }, 30000);

  it('não marca partidas antigas sem snapshot como verificadas nem as salva persistentemente', async () => {
    const repo = new MemoryRepo();
    const antiga: Partida = {
      login: 'ana', data: DIA, pontos: 200, fantasmas: 0, mortes: 0,
      maior_combo: 0, quadros: 200, celulas: 1, eficiencia: 200,
      interrompida: false, versao_motor: '1.1.0'
    };
    await repo.upsert(antiga);
    const app = createApp({
      repo, jogadores: () => [{ login: 'ana', desde: DIA }], hoje: () => DIA,
      renderSvg: async () => '<svg/>'
    });
    const res = await app.request(`/api/partida/ana/${DIA}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-pacman-replay')).toBe('reconstrucao');
    const assinatura = assinaturaReplay({ ...antiga, publicado_sha: null }, []);
    expect(await repo.obterSvg('ana', DIA, 'github-dark', assinatura)).toBeNull();
  });
});
