import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { GhostsMovement } from '../src/movement/ghosts-movement.js';
import { Game } from '../src/core/game.js';

const freeGhost = (store: ReturnType<typeof makeStore>, x: number, y: number) => {
  const g = store.ghosts[0];
  Object.assign(g, { x, y, inHouse: false, scared: false, name: 'blinky', direction: 'left', moveTick: 0 });
  store.ghosts.slice(1).forEach(o => { o.inHouse = true; o.x = 26; o.y = 3; });
  return g;
};

describe('velocidade dos fantasmas', () => {
  it('normal anda todo frame', () => {
    const store = makeStore(); const g = freeGhost(store, 40, 0);
    const before = `${g.x},${g.y}`;
    GhostsMovement.moveGhosts(store);
    expect(`${g.x},${g.y}`).not.toBe(before);
  });
  it('no túnel anda 1 a cada 2 frames', () => {
    const store = makeStore(); const g = freeGhost(store, 1, 3);
    GhostsMovement.moveGhosts(store);
    expect(g).toMatchObject({ x: 1, y: 3 });
    GhostsMovement.moveGhosts(store);
    expect(`${g.x},${g.y}`).not.toBe('1,3');
  });
  it('assustado anda 1 a cada 2 frames', () => {
    const store = makeStore(); const g = freeGhost(store, 40, 0);
    g.scared = true;
    const moved: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const before = `${g.x},${g.y}`;
      GhostsMovement.moveGhosts(store);
      moved.push(`${g.x},${g.y}` !== before);
    }
    expect(moved).toEqual([false, true, false, true, false, true]);
  });
  it('vira de costas ao ser assustado', () => {
    const store = makeStore({ cells: [[5, 0, 'FOURTH_QUARTILE']] });
    const g = freeGhost(store, 40, 0);
    g.direction = 'left';
    store.pacman.x = 5; store.pacman.y = 0;
    Game.eatCell(store);
    expect(g.direction).toBe('right');
  });
});
