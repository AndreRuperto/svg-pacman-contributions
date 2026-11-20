import { describe, it, expect } from 'vitest';
import { GAME_THEMES } from '../src/core/constants.js';
import { SVG } from '../src/renderers/svg.js';
import { makeStore, run } from './helpers.js';
import type { ThemeKeys } from '../src/types.js';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const KEYS: ThemeKeys[] = ['github', 'github-dark', 'brasa', 'arcade', 'neon', 'alto-contraste', 'gitlab', 'gitlab-dark'];

describe('temas', () => {
  it('existem os 8 temas da prancha', () => {
    expect(Object.keys(GAME_THEMES).sort()).toEqual([...KEYS].sort());
  });

  for (const key of KEYS) {
    describe(key, () => {
      const t = GAME_THEMES[key];
      it('texto ≥ 4,5:1 e valor do placar ≥ 4,5:1 sobre o fundo', () => {
        expect(contrast(t.textColor, t.gridBackground)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.textStrong, t.gridBackground)).toBeGreaterThanOrEqual(4.5);
      });
      it('paredes ≥ 3:1 sobre o fundo', () => {
        expect(contrast(t.wallColor, t.gridBackground)).toBeGreaterThanOrEqual(3);
      });
      it('Pac-Man ≥ 3:1 sobre a célula vazia (ou com contorno que garante isso)', () => {
        const ok = contrast(t.pacmanColor, t.intensityColors[0]) >= 3
          || (!!t.pacmanStroke && contrast(t.pacmanStroke, t.intensityColors[0]) >= 3);
        expect(ok).toBe(true);
      });
      it('boca acesa do túnel ≥ 3:1 sobre o fundo e nunca amarela', () => {
        expect(contrast(t.tunnelActiveColor, t.gridBackground)).toBeGreaterThanOrEqual(3);
        expect(t.tunnelActiveColor.toUpperCase()).not.toMatch(/^#FFFF/);
      });
      it('5 níveis de célula com claridade sempre crescendo ou decrescendo', () => {
        const l = t.intensityColors.map(lum);
        const up = l.every((v, i) => i === 0 || v > l[i - 1]);
        const down = l.every((v, i) => i === 0 || v < l[i - 1]);
        expect(t.intensityColors).toHaveLength(5);
        expect(up || down).toBe(true);
      });
    });
  }

  it('o SVG usa as cores do tema para Pac-Man, contorno e fantasma piscando', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']], config: { gameTheme: 'github' } });
    run(store, 3);
    const svg = SVG.generateAnimatedSVG(store);
    const t = GAME_THEMES.github;
    expect(svg).toContain(`fill="${t.pacmanColor}"`);
    expect(svg).toContain(`stroke="${t.pacmanStroke}"`);
    expect(svg).not.toContain('fill="yellow"');
  });
});
