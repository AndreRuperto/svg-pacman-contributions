import { describe, it, expect } from 'vitest';
import { playDay, ENGINE_VERSION } from '../src/runner.js';
import type { Contribution } from '../src/types.js';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

const contribs = (date: string): Contribution[] => Array.from({ length: 40 }, (_, i) => {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - i * 3);
  return { date: d, count: 1 + (i % 4), color: '', level: (['FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'] as const)[i % 4] };
});

describe('playDay', () => {
  it('a versão do motor é a do package.json', () => {
    expect(ENGINE_VERSION).toBe(pkg.version);
  });
  it('devolve os números da partida e as células do dia', async () => {
    const r = await playDay({ login: 'ana', date: '2025-06-15', contributions: contribs('2025-06-15') });
    expect(r).not.toBeNull();
    expect(r!.celulas).toBe(40);
    expect(r!.pontos).toBeGreaterThan(0);
    expect(r!.quadros).toBeGreaterThan(0);
    expect(r!.eficiencia).toBeCloseTo(r!.pontos / r!.celulas, 5);
    expect(r).toMatchObject({ login: 'ana', data: '2025-06-15', versao_motor: ENGINE_VERSION, interrompida: false });
    expect(r).not.toHaveProperty('svg');
  });
  it('é determinístico: mesmo login e dia, mesma partida', async () => {
    const a = await playDay({ login: 'ana', date: '2025-06-15', contributions: contribs('2025-06-15') });
    const b = await playDay({ login: 'ana', date: '2025-06-15', contributions: contribs('2025-06-15') });
    expect(a).toEqual(b);
  });
  it('sem contribuições não há partida', async () => {
    expect(await playDay({ login: 'ana', date: '2025-06-15', contributions: [] })).toBeNull();
  });
  it('pode devolver o SVG da partida', async () => {
    const r = await playDay({ login: 'ana', date: '2025-06-15', contributions: contribs('2025-06-15'), theme: 'neon', withSvg: true });
    expect(r!.svg).toMatch(/^<svg/);
  });
});
