import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/game.js';
import { makeStore } from './helpers.js';

describe('fim de jogo no modo svg', () => {
  it('termina mesmo com o Pac-Man morto prestes a renascer', () => {
    let over = 0;
    let svg = '';
    const store = makeStore({ config: { gameOverCallback: () => { over++; }, svgCallback: (s) => { svg = s; } } });
    // Sem células: o próximo quadro já seria o fim, mas o ramo do renascimento retorna antes.
    store.pacman.deadRemainingDuration = 1;
    Game.finishGame(store);
    expect(over).toBe(1);
    expect(store.game.over).toBe(true);
    expect(svg).toMatch(/^<svg/);
  });
  it('fim de jogo roda uma vez só', () => {
    let over = 0;
    const store = makeStore({ config: { gameOverCallback: () => { over++; } } });
    Game.finishGame(store);
    Game.finishGame(store);
    expect(over).toBe(1);
  });
});
