import { describe, it, expect } from 'vitest';
import { makeStore, run } from './helpers.js';

describe('Game.step', () => {
  it('avança o frame e grava um snapshot por passo', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    run(store, 5);
    expect(store.game.frame).toBe(5);
    expect(store.gameHistory).toHaveLength(5);
  });
  it('libera pinky no frame 10', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    run(store, 12);
    const pinky = store.ghosts.find(g => g.name === 'pinky')!;
    expect(pinky.y).toBeLessThanOrEqual(2);
  });
});
