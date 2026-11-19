import { describe, it, expect } from 'vitest';
import { makeStore, run } from './helpers.js';
import { GRID_HEIGHT, PACMAN_DEATH_DURATION } from '../src/core/constants.js';
import { getPlayerStyle } from '../src/movement/pacman-movement.js';
import { PlayerStyle } from '../src/types.js';

describe('renascimento e estilo', () => {
  it('Pac-Man renasce dentro do grid', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    store.pacman.deadRemainingDuration = 1;
    run(store, 1);
    expect(store.pacman.y).toBeGreaterThanOrEqual(0);
    expect(store.pacman.y).toBeLessThan(GRID_HEIGHT);
    expect(store.pacman).toMatchObject({ x: 26, y: 5 });
  });

  it('fantasma comido renasce perigoso mesmo com power-up ativo', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    const g = store.ghosts[0];
    Object.assign(g, { name: 'eyes', originalName: 'blinky', inHouse: true, respawnCounter: 1, x: 26, y: 3, scared: false });
    store.pacman.powerupRemainingDuration = 20;
    run(store, 1);
    expect(g.name).toBe('blinky');
    expect(g.scared).toBe(false);
  });

  it('estilo vem da config', () => {
    const store = makeStore({ config: { playerStyle: PlayerStyle.CONSERVATIVE } });
    expect(getPlayerStyle(store)).toBe(PlayerStyle.CONSERVATIVE);
    expect(getPlayerStyle(makeStore())).toBe(PlayerStyle.OPPORTUNISTIC);
  });
});
