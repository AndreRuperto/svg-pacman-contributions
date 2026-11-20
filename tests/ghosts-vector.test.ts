import { describe, it, expect } from 'vitest';
import { GAME_THEMES } from '../src/core/constants.js';
import { SVG, GhostArt } from '../src/renderers/svg.js';
import { makeStore, run } from './helpers.js';
import type { ThemeKeys } from '../src/types.js';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const svgFor = (gameTheme: ThemeKeys) => {
  const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']], config: { gameTheme } });
  run(store, 2);
  return SVG.generateAnimatedSVG(store);
};
const symbol = (svg: string, id: string) => svg.match(new RegExp(String.raw`<symbol id="${id}"[\s\S]*?</symbol>`))![0];
const KEYS = Object.keys(GAME_THEMES) as ThemeKeys[];

describe('fantasmas em vetor (prancha: A · Lençol)', () => {
  it('nenhuma imagem PNG embutida no SVG', () => {
    expect(svgFor('github-dark')).not.toContain('data:image/png');
  });

  it('cada personalidade tem a barra recortada de um jeito', () => {
    const bodies = new Set(GhostArt.BODIES);
    expect(bodies.size).toBe(4);
  });

  it('as pupilas acompanham a direção', () => {
    const svg = svgFor('github-dark');
    const ids = ['left', 'right', 'up', 'down'].map(d => symbol(svg, `ghost-eyes-${d}`));
    expect(new Set(ids.map(s => s.replace(/id="[^"]*"/, ''))).size).toBe(4);
  });

  for (const key of KEYS) {
    describe(key, () => {
      const t = GAME_THEMES[key];
      it('4 cores de fantasma distintas, nenhuma igual ao Pac-Man com poder', () => {
        expect(new Set(t.ghostColors.map(c => c.toUpperCase())).size).toBe(4);
        expect(t.ghostColors.map(c => c.toUpperCase())).not.toContain(t.pacmanPowerupColor.toUpperCase());
      });
      it('fantasmas ≥ 3:1 sobre o fundo (ou com contorno que garante isso)', () => {
        for (const c of t.ghostColors) {
          const ok = contrast(c, t.gridBackground) >= 3 || (!!t.ghostOutline && contrast(t.ghostOutline, t.gridBackground) >= 3);
          expect(ok, `${c} sobre ${t.gridBackground}`).toBe(true);
        }
      });
      it('o SVG pinta cada fantasma com a cor do tema', () => {
        const svg = svgFor(key);
        ['blinky', 'pinky', 'inky', 'clyde'].forEach((name, i) =>
          expect(symbol(svg, `ghost-${name}-right`)).toContain(`fill="${t.ghostColors[i]}"`));
        expect(symbol(svg, 'ghost-scared')).toContain(`fill="${t.scaredColor}"`);
        expect(symbol(svg, 'ghost-scared-flash')).toContain(`fill="${t.flashColor}"`);
      });
    });
  }

  it('contorno: branco no assustado do arcade, escuro nos fantasmas e olhos dos temas claros', () => {
    expect(symbol(svgFor('arcade'), 'ghost-scared')).toContain('stroke="#FFFFFF"');
    const light = svgFor('github');
    expect(symbol(light, 'ghost-blinky-right')).toContain(`stroke="${GAME_THEMES.github.ghostOutline}"`);
    expect(symbol(light, 'ghost-eyes-left')).toContain(`stroke="${GAME_THEMES.github.spriteOutline}"`);
    expect(symbol(svgFor('github-dark'), 'ghost-blinky-right')).not.toContain('stroke=');
  });
});
