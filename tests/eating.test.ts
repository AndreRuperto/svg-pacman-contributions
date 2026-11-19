import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { Game } from '../src/core/game.js';
import { PACMAN_POWERUP_DURATION } from '../src/core/constants.js';

/** Coloca o Pac-Man ao lado de (x,y) e força o próximo passo para lá. */
const eatAt = (store: ReturnType<typeof makeStore>, x: number, y: number) => {
  store.pacman.x = x; store.pacman.y = y;
  Game.eatCell(store);
};

describe('comer', () => {
  it('pontua pelo nível e zera a célula', () => {
    const store = makeStore({ cells: [[5, 0, 'THIRD_QUARTILE']] });
    eatAt(store, 5, 0);
    expect(store.pacman.totalPoints).toBe(30);
    expect(store.statistics!.pointsFromContributions).toBe(30);
    expect(store.grid[5][0].level).toBe('NONE');
  });

  it('power-up conta, dura PACMAN_POWERUP_DURATION e assusta só quem está fora da casa', () => {
    const store = makeStore({ cells: [[5, 0, 'FOURTH_QUARTILE']] });
    store.ghosts[0].inHouse = false; // blinky já está fora
    eatAt(store, 5, 0);
    expect(store.statistics!.powerUpsCollected).toBe(1);
    expect(store.pacman.powerupRemainingDuration).toBe(PACMAN_POWERUP_DURATION);
    expect(store.ghosts.find(g => g.name === 'blinky')!.scared).toBe(true);
    expect(store.ghosts.find(g => g.name === 'pinky')!.scared).toBe(false); // na casa
  });

  it('segundo power-up renova o tempo e mantém o combo', () => {
    const store = makeStore({ cells: [[5, 0, 'FOURTH_QUARTILE'], [6, 0, 'FOURTH_QUARTILE']] });
    eatAt(store, 5, 0);
    store.pacman.powerupRemainingDuration = 3;
    store.game.combo = 2;
    eatAt(store, 6, 0);
    expect(store.pacman.powerupRemainingDuration).toBe(PACMAN_POWERUP_DURATION);
    expect(store.game.combo).toBe(2);
    expect(store.statistics!.powerUpsCollected).toBe(2);
  });

  it('combo paga 200, 400, 800, 1600', () => {
    const store = makeStore();
    store.pacman.powerupRemainingDuration = 20;
    const paid: number[] = [];
    for (let i = 0; i < 4; i++) {
      const g = store.ghosts[i];
      g.inHouse = false; g.scared = true; g.name = (['blinky','inky','pinky','clyde'] as const)[i];
      g.x = store.pacman.x; g.y = store.pacman.y;
      const before = store.pacman.totalPoints;
      Game.checkCollisions(store);
      paid.push(store.pacman.totalPoints - before);
    }
    expect(paid).toEqual([200, 400, 800, 1600]);
  });

  it('combo zera quando o power-up acaba', () => {
    const store = makeStore({ cells: [[40, 6, 'FIRST_QUARTILE']] });
    store.pacman.powerupRemainingDuration = 1;
    store.game.combo = 3;
    Game.step(store);
    expect(store.game.combo).toBe(0);
  });

  it('detecta colisão quando Pac-Man e fantasma trocam de casa', () => {
    const store = makeStore();
    const g = store.ghosts[0];
    Game.checkSwapCollisions(store, { x: 10, y: 0 }, [{ x: 11, y: 0 }]);
    // nada acontece se não houve troca
    expect(store.pacman.deadRemainingDuration).toBe(0);
    store.pacman.x = 11; store.pacman.y = 0;
    g.x = 10; g.y = 0; g.inHouse = false; g.scared = false; g.name = 'blinky';
    Game.checkSwapCollisions(store, { x: 10, y: 0 }, [{ x: 11, y: 0 }, ...store.ghosts.slice(1).map(o => ({ x: o.x, y: o.y }))]);
    expect(store.pacman.deadRemainingDuration).toBeGreaterThan(0);
  });
});
