import { describe, it, expect } from 'vitest';
import { buildGrid, buildMonthLabels, gridWindow } from '../src/utils/utils.js';
import { makeStore } from './helpers.js';
import { SVG } from '../src/renderers/svg.js';

describe('jogar um dia passado', () => {
  it('a janela termina no dia pedido e começa num domingo, ~1 ano antes', () => {
    const { start, end } = gridWindow('2025-06-15');
    expect(end.toISOString().slice(0, 10)).toBe('2025-06-15');
    expect(start.getUTCDay()).toBe(0);
    const days = (end.getTime() - start.getTime()) / 86400000;
    // 53 colunas: no máximo 52 semanas completas + a semana do dia pedido.
    expect(days).toBeGreaterThanOrEqual(364);
    expect(days).toBeLessThanOrEqual(370);
  });
  it('a janela cabe nas 53 colunas em qualquer dia da semana', () => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(2025, 5, 15 + i)).toISOString().slice(0, 10);
      const { start, end } = gridWindow(d);
      expect(Math.floor((end.getTime() - start.getTime()) / (7 * 86400000))).toBe(52);
    }
  });
  it('buildGrid posiciona contribuições pela janela do dia pedido', () => {
    const store = makeStore({ config: { date: '2025-06-15' } });
    store.contributions = [{ date: new Date('2025-06-15T00:00:00Z'), count: 3, color: '', level: 'THIRD_QUARTILE' }];
    buildGrid(store);
    const last = store.grid[store.grid.length - 1];
    expect(last[0].level).toBe('THIRD_QUARTILE'); // 2025-06-15 é domingo
  });
  it('os meses terminam no mês do dia pedido', () => {
    const store = makeStore({ config: { date: '2025-06-15' } });
    buildMonthLabels(store);
    expect(store.monthLabels.filter(Boolean).at(-1)).toBe('jun.');
  });
  it('rejeita data mal formada ou inexistente', () => {
    expect(() => gridWindow('2026-02-30')).toThrow('DATA_INVALIDA: 2026-02-30');
    expect(() => gridWindow('2025-6-15')).toThrow('DATA_INVALIDA: 2025-6-15');
    expect(() => gridWindow('ontem')).toThrow('DATA_INVALIDA: ontem');
    expect(() => gridWindow('2024-02-29')).not.toThrow();
  });
  it('num sábado, o dia final cai na coluna 52 e o primeiro domingo na coluna 0', () => {
    const store = makeStore({ config: { date: '2025-06-14' } }); // sábado
    const { start } = gridWindow('2025-06-14');
    store.contributions = [
      { date: new Date('2025-06-14T00:00:00Z'), count: 1, color: '', level: 'FIRST_QUARTILE' },
      { date: start, count: 1, color: '', level: 'SECOND_QUARTILE' }
    ];
    buildGrid(store);
    expect(store.grid).toHaveLength(53);
    expect(store.grid[52][6].level).toBe('FIRST_QUARTILE');
    expect(store.grid[0][0].level).toBe('SECOND_QUARTILE');
  });
  it('o SVG de um dia passado traz a data do dia, não a de agora', () => {
    const store = makeStore({ config: { date: '2025-06-15' } });
    const svg = SVG.generateAnimatedSVG(store);
    expect(svg).toContain('<generatedOn>2025-06-15T00:00:00.000Z</generatedOn>');
    expect(svg).toContain('on 2025-06-15</desc>');
  });
});
