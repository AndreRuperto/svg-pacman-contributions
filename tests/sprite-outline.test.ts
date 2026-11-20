import { describe, it, expect } from 'vitest';
import { GAME_THEMES } from '../src/core/constants.js';
import { SVG } from '../src/renderers/svg.js';
import { makeStore, run } from './helpers.js';
import type { ThemeKeys } from '../src/types.js';

const svgFor = (gameTheme: ThemeKeys) => {
  const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']], config: { gameTheme } });
  run(store, 2);
  return SVG.generateAnimatedSVG(store);
};
const symbol = (svg: string, id: string) => svg.match(new RegExp(String.raw`<symbol id="${id}"[\s\S]*?</symbol>`))![0];

describe('contorno dos sprites', () => {
  it('fliperama: contorno claro no fantasma assustado (o sprite azul some nas células azuis)', () => {
    expect(GAME_THEMES.arcade.spriteOutline).toBe('#FFFFFF');
    const svg = svgFor('arcade');
    expect(svg).toMatch(/<filter id="sprite-outline"[\s\S]*?flood-color="#FFFFFF"/);
    expect(symbol(svg, 'ghost-scared')).toContain('filter="url(#sprite-outline)"');
    expect(symbol(svg, 'ghost-scared-flash')).toContain('filter="url(#sprite-outline)"');
  });

  it('temas claros: contorno escuro nos olhos do fantasma comido', () => {
    for (const key of ['github', 'gitlab'] as const) {
      const svg = svgFor(key);
      expect(svg).toContain(`flood-color="${GAME_THEMES[key].spriteOutline}"`);
      expect(symbol(svg, 'ghost-eyes-left')).toContain('filter="url(#sprite-outline)"');
    }
  });

  it('temas sem o token não ganham contorno', () => {
    const svg = svgFor('github-dark');
    expect(GAME_THEMES['github-dark'].spriteOutline).toBeUndefined();
    expect(svg).not.toContain('sprite-outline');
  });
});
