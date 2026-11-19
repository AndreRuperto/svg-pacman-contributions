import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { PacmanMovement } from '../src/movement/pacman-movement.js';
import { PlayerStyle } from '../src/types.js';

describe('porta da casa dos fantasmas', () => {
  for (const style of Object.values(PlayerStyle)) {
    it(`${style}: não entra na casa onde um fantasma está saindo`, () => {
      const store = makeStore({ cells: [[27, 3, 'FIRST_QUARTILE']], config: { playerStyle: style } });
      store.pacman.x = 26; store.pacman.y = 1;
      const pinky = store.ghosts.find(g => g.name === 'pinky')!;
      Object.assign(pinky, { x: 26, y: 2, inHouse: true, justReleasedFromHouse: true, direction: 'up', scared: false });
      PacmanMovement.movePacman(store);
      expect(store.pacman).not.toMatchObject({ x: 26, y: 2 });
    });
  }
});
