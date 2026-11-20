import { describe, it, expect } from 'vitest';
import { addDays, dataValida } from '../../site/src/datas.js';

describe('addDays', () => {
  it('vira o mês, o ano e respeita o 29/02', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-11-20', -364)).toBe('2025-11-21');
  });
  it('recusa data inválida', () => {
    expect(() => addDays('2026-13-01', 1)).toThrow(/data inválida/);
  });
});

describe('dataValida', () => {
  it('aceita só AAAA-MM-DD de verdade', () => {
    expect(dataValida('2028-02-29')).toBe(true);
    expect(dataValida('2026-02-29')).toBe(false);
    expect(dataValida('2026-13-01')).toBe(false);
    expect(dataValida('20/11/2026')).toBe(false);
    expect(dataValida(20261120)).toBe(false);
  });
});
