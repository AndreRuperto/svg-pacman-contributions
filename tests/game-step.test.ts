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
    const pinky = () => store.ghosts.find(g => g.name === 'pinky')!;
    run(store, 10);
    expect(pinky().inHouse).toBe(true);
    run(store, 2);
    expect(pinky().inHouse).toBe(false);
  });
  it('mesma semente gera a mesma partida', () => {
    const cells = [[40, 0, 'FIRST_QUARTILE'], [10, 5, 'FOURTH_QUARTILE']] as const;
    const a = makeStore({ cells: [...cells], seed: 's1' });
    const b = makeStore({ cells: [...cells], seed: 's1' });
    run(a, 60); run(b, 60);
    expect(JSON.stringify(a.gameHistory)).toBe(JSON.stringify(b.gameHistory));
  });
});
