import { describe, it, expect } from 'vitest';
import { makeStore, run } from './helpers.js';
import { SVG, frameDurationMs } from '../src/renderers/svg.js';

const dur = (svg: string) => Number(svg.match(/dur="(\d+(?:\.\d+)?)ms"/)![1]);

describe('velocidade da animação', () => {
  it('padrão: 200 ms por frame', () => {
    expect(frameDurationMs(makeStore().config)).toBe(200);
  });
  it('aceita nomes e multiplicador', () => {
    expect(frameDurationMs(makeStore({ config: { animationSpeed: 'slow' } }).config)).toBe(400);
    expect(frameDurationMs(makeStore({ config: { animationSpeed: 'fast' } }).config)).toBe(100);
    expect(frameDurationMs(makeStore({ config: { animationSpeed: 4 } }).config)).toBe(50);
  });
  it('valor inválido cai no normal', () => {
    expect(frameDurationMs(makeStore({ config: { animationSpeed: 0 } }).config)).toBe(200);
    expect(frameDurationMs(makeStore({ config: { animationSpeed: 'xyz' as never } }).config)).toBe(200);
  });
  it('dobrar a velocidade divide a duração do SVG por dois', () => {
    const a = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    const b = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']], config: { animationSpeed: 2 } });
    run(a, 10); run(b, 10);
    expect(dur(SVG.generateAnimatedSVG(b))).toBe(dur(SVG.generateAnimatedSVG(a)) / 2);
  });
});
