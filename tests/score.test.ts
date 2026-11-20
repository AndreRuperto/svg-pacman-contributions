import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { Game } from '../src/core/game.js';

const finish = (ghosts: number, deaths: number) => {
  const store = makeStore(); // grid vazio: o próximo passo encerra a partida
  Object.assign(store.statistics!, { ghostsEaten: ghosts, deaths, totalPoints: 1000 });
  Game.step(store);
  return store.statistics!;
};

describe('pontuação final', () => {
  it('multiplicador de eficiência tem teto de ×3', () => {
    expect(finish(27, 1).efficiencyMultiplier).toBe(3);
  });
  it('abaixo do teto continua 1 + fantasmas/mortes', () => {
    expect(finish(3, 2).efficiencyMultiplier).toBe(2.5);
  });
});

describe('combo de fantasmas', () => {
  it('a partir do 4º fantasma seguido, cada um vale 1600', () => {
    const store = makeStore();
    store.pacman.powerupRemainingDuration = 20;
    const paid: number[] = [];
    for (let i = 0; i < 6; i++) {
      const g = store.ghosts[i % 4];
      Object.assign(g, { inHouse: false, scared: true, name: 'blinky', x: store.pacman.x, y: store.pacman.y });
      const before = store.pacman.totalPoints;
      Game.checkCollisions(store);
      paid.push(store.pacman.totalPoints - before);
    }
    expect(paid).toEqual([200, 400, 800, 1600, 1600, 1600]);
  });
});
