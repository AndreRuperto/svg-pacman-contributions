import { describe, it, expect } from 'vitest';
import { createRng, defaultSeed } from '../src/utils/rng.js';

describe('rng', () => {
  it('mesma semente gera mesma sequência', () => {
    const a = createRng('x'), b = createRng('x');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('sementes diferentes geram sequências diferentes', () => {
    expect(createRng('x')()).not.toBe(createRng('y')());
  });
  it('valores ficam em [0, 1)', () => {
    const r = createRng('z');
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('semente padrão = usuário + dia (UTC)', () => {
    expect(defaultSeed('ana', new Date('2026-11-19T23:00:00Z'))).toBe('ana:2026-11-19');
  });
});
