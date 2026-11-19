import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { GhostsMovement } from '../src/movement/ghosts-movement.js';
import { MovementUtils } from '../src/movement/movement-utils.js';
import { createRng } from '../src/utils/rng.js';

const setup = () => {
  const store = makeStore({ seed: 'fuga' });
  const g = store.ghosts[0];
  Object.assign(g, { x: 14, y: 0, inHouse: false, scared: true, name: 'blinky', direction: 'right' });
  store.ghosts.slice(1).forEach(o => { o.inHouse = true; o.x = 26; o.y = 3; });
  store.pacman.x = 10; store.pacman.y = 0;
  return { store, g };
};

describe('fantasma assustado', () => {
  it('não reverte num corredor', () => {
    const { store, g } = setup();
    for (let i = 0; i < 40; i++) {
      const dir = g.direction;
      const opts = MovementUtils.getNeighbors(g.x, g.y);
      const before = `${g.x},${g.y}`;
      GhostsMovement.moveScaredGhost(g, store);
      if (opts.length > 1 && `${g.x},${g.y}` !== before) {
        expect(g.direction).not.toBe(MovementUtils.opposite(dir));
      }
    }
  });

  it('se afasta mais do Pac-Man que um passeio aleatório', () => {
    const { store, g } = setup();
    let fleeSum = 0;
    for (let i = 0; i < 20; i++) { GhostsMovement.moveScaredGhost(g, store); fleeSum += MovementUtils.gridDistance(g, store.pacman); }

    const rng = createRng('fuga');
    let p = { x: 14, y: 0 }; let randSum = 0;
    for (let i = 0; i < 20; i++) {
      const n = MovementUtils.getNeighbors(p.x, p.y);
      p = n[Math.floor(rng() * n.length)];
      randSum += MovementUtils.gridDistance(p, store.pacman);
    }
    expect(fleeSum).toBeGreaterThan(randSum);
  });
});
