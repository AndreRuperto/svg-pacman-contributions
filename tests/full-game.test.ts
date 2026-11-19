import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { makeStore, remaining, type CellSpec } from './helpers.js';
import { Game } from '../src/core/game.js';
import { SVG } from '../src/renderers/svg.js';
import { createRng } from '../src/utils/rng.js';
import { PlayerStyle } from '../src/types.js';
import { GRID_HEIGHT, GRID_WIDTH } from '../src/core/constants.js';

const LEVELS = ['FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'] as const;
const randomCells = (seed: string, n: number): CellSpec[] => {
  const r = createRng(seed); const cells = new Map<string, CellSpec>();
  while (cells.size < n) {
    const x = Math.floor(r() * GRID_WIDTH), y = Math.floor(r() * GRID_HEIGHT);
    const level = r() < 0.08 ? 'FOURTH_QUARTILE' : LEVELS[Math.floor(r() * 3)];
    cells.set(`${x},${y}`, [x, y, level]);
  }
  return [...cells.values()];
};

describe('partida completa', () => {
  for (const style of Object.values(PlayerStyle)) {
    it(`termina com estilo ${style}`, () => {
      const store = makeStore({ cells: randomCells('mapa', 150), config: { playerStyle: style }, seed: 'partida' });
      let frames = 0;
      while (remaining(store) && frames < 20000) { Game.step(store); frames++; }
      expect(remaining(store)).toBe(false);
      Game.step(store); // finaliza estatísticas
      const s = store.statistics!;
      console.log(`${style}: ${frames} frames, ${s.deaths} mortes, ${s.ghostsEaten} fantasmas, combo ${s.highestGhostCombo}, ${s.totalPoints} pts`);
      mkdirSync('outputs', { recursive: true });
      writeFileSync(`outputs/partida-${style}.svg`, SVG.generateAnimatedSVG(store));
    }, 60000);
  }
});
