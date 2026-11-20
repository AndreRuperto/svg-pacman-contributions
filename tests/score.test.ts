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
