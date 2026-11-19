import { describe, it, expect } from 'vitest';
import { generatePositionAnimation, SVG } from '../src/renderers/svg.js';
import { CELL_SIZE, GAP_SIZE, GRID_WIDTH } from '../src/core/constants.js';
import { makeStore, run } from './helpers.js';

const px = (x: number) => x * (CELL_SIZE + GAP_SIZE);

describe('svg', () => {
  it('salto do túnel não passa pelo meio do mapa', () => {
    const anim = generatePositionAnimation([{ x: 1, y: 3 }, { x: 0, y: 3 }, { x: 52, y: 3 }, { x: 51, y: 3 }]);
    const xs = anim.values.split(';').map(v => Number(v.split(',')[0]));
    // entre 0 e 52 só aparecem as posições fora da borda (-1 e 53)
    const i0 = xs.indexOf(px(0)), i52 = xs.indexOf(px(52));
    expect(xs.slice(i0 + 1, i52)).toEqual([px(-1), px(GRID_WIDTH)]);
    const times = anim.keyTimes.split(';').map(Number);
    expect(times[0]).toBe(0);
    expect(times[times.length - 1]).toBe(1);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
  });

  it('mantém só as pontas de cada trecho parado', () => {
    const anim = generatePositionAnimation([{ x: 5, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }]);
    expect(anim.keyTimes.split(';')).toHaveLength(3); // 0, fim do trecho parado, 1
  });

  it('gera SVG com recorte, bocas do túnel e estado de piscar', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    store.ghosts[0].inHouse = false;
    store.pacman.powerupRemainingDuration = 8;
    store.ghosts[0].scared = true;
    run(store, 6);
    const svg = SVG.generateAnimatedSVG(store);
    expect(svg).toContain('clip-path="url(#arena)"');
    expect(svg).toContain('id="tunnel-left"');
    expect(svg).toContain('id="tunnel-right"');
    expect(svg).toContain('#ghost-scared-flash');
  });
});
