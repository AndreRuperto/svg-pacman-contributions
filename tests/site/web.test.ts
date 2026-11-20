import { describe, it, expect } from 'vitest';
import { JOGADORES_URL } from '../../site/src/cron.js';
import type { Jogador } from '../../site/src/jogadores.js';
import { JOGADORES_LOCAL, aparar, configDoAmbiente, listaRecarregavel } from '../../site/src/web.js';

describe('configDoAmbiente', () => {
  it('padrões', () => {
    expect(configDoAmbiente({})).toEqual({
      porta: 3000,
      databaseUrl: undefined,
      githubToken: undefined,
      jogadores: { path: JOGADORES_LOCAL },
      confiarProxy: false
    });
    expect(JOGADORES_LOCAL.split('\\').join('/')).toMatch(/ranking\/jogadores\.json$/);
  });
  it('com banco, a lista padrão vem da main', () => {
    expect(configDoAmbiente({ DATABASE_URL: 'postgres://x' }).jogadores).toEqual({ url: JOGADORES_URL });
  });
  it('lê as variáveis; no Railway confia no proxy', () => {
    const c = configDoAmbiente({
      PORT: '8080',
      DATABASE_URL: 'postgres://x',
      GITHUB_TOKEN: 't',
      JOGADORES_URL: 'https://exemplo/j.json',
      RAILWAY_ENVIRONMENT: 'production'
    });
    expect(c).toEqual({
      porta: 8080,
      databaseUrl: 'postgres://x',
      githubToken: 't',
      jogadores: { url: 'https://exemplo/j.json' },
      confiarProxy: true
    });
  });
  it('CONFIAR_PROXY explícito vence', () => {
    expect(configDoAmbiente({ RAILWAY_ENVIRONMENT: 'production', CONFIAR_PROXY: 'false' }).confiarProxy).toBe(false);
    expect(configDoAmbiente({ CONFIAR_PROXY: 'true' }).confiarProxy).toBe(true);
    expect(configDoAmbiente({ CONFIAR_PROXY: '1' }).confiarProxy).toBe(true);
  });
  it('PORT inválida lança', () => {
    expect(() => configDoAmbiente({ PORT: 'abc' })).toThrow(/PORT/);
  });
});

describe('listaRecarregavel', () => {
  const a: Jogador[] = [{ login: 'a', desde: '2026-01-01' }];
  const b: Jogador[] = [{ login: 'b', desde: '2026-01-01' }];

  it('começa vazia, troca a cada recarga e mantém a última boa quando falha', async () => {
    const respostas: Array<Jogador[] | Error> = [a, new Error('fora do ar'), b];
    const logs: string[] = [];
    const lista = listaRecarregavel(async () => {
      const r = respostas.shift()!;
      if (r instanceof Error) throw r;
      return r;
    }, (m) => logs.push(m));
    expect(lista.atual()).toEqual([]);
    expect(await lista.recarregar()).toBe(true);
    expect(lista.atual()).toEqual(a);
    expect(await lista.recarregar()).toBe(false);
    expect(lista.atual()).toEqual(a);
    expect(logs.some((m) => m.includes('fora do ar'))).toBe(true);
    expect(await lista.recarregar()).toBe(true);
    expect(lista.atual()).toEqual(b);
  });
});

describe('aparar', () => {
  it('limita o desde aos últimos N dias, sem adiantar quem entrou depois', () => {
    const lista: Jogador[] = [
      { login: 'velho', desde: '2025-01-01' },
      { login: 'novo', desde: '2026-11-18' }
    ];
    expect(aparar(lista, '2026-11-19', 14)).toEqual([
      { login: 'velho', desde: '2026-11-06' },
      { login: 'novo', desde: '2026-11-18' }
    ]);
    expect(lista[0].desde).toBe('2025-01-01');
  });
});
