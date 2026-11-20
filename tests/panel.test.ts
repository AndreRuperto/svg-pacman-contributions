import { describe, it, expect } from 'vitest';
import { SVG, formatThousands } from '../src/renderers/svg.js';
import { makeStore, run } from './helpers.js';

describe('placar', () => {
  it('formata milhar com ponto', () => {
    expect(formatThousands(84450)).toBe('84.450');
    expect(formatThousands(1234567)).toBe('1.234.567');
    expect(formatThousands(999)).toBe('999');
  });
  it('mostra as 5 métricas com fonte do sistema e o SVG tem 229 px de altura', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    run(store, 3);
    Object.assign(store.statistics!, { totalPoints: 84450, ghostsEaten: 25, highestGhostCombo: 4, deaths: 4 });
    const svg = SVG.generateAnimatedSVG(store);
    expect(svg).toMatch(/<svg width="1166" height="229"/);
    for (const t of ['PONTOS', 'FANTASMAS', 'MAIOR COMBO', 'MORTES', 'DURAÇÃO', '84.450', '×4']) expect(svg).toContain(`>${t}<`);
    expect(svg).toMatch(/id="placar" font-family="ui-monospace/);
    expect(svg).toMatch(/>0m 01s</);
  });
});
