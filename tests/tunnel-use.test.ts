import { describe, it, expect } from 'vitest';
import { makeStore, run } from './helpers.js';

describe('uso do túnel', () => {
  it('Pac-Man atravessa o túnel quando o alvo está do outro lado', () => {
    const store = makeStore({ cells: [[51, 3, 'FIRST_QUARTILE']] });
    store.ghosts.forEach(g => { g.x = 26; g.y = 3; g.inHouse = true; });
    store.pacman.x = 1; store.pacman.y = 3;
    run(store, 3);
    expect(store.grid[51][3].level).toBe('NONE');
  });

  it('salto do túnel mantém a direção do movimento', () => {
    const store = makeStore({ cells: [[51, 3, 'FIRST_QUARTILE']] });
    store.ghosts.forEach(g => { g.x = 26; g.y = 3; g.inHouse = true; });
    store.pacman.x = 0; store.pacman.y = 3;
    run(store, 1);
    expect(store.pacman).toMatchObject({ x: 52, y: 3, direction: 'left' });
  });
});
