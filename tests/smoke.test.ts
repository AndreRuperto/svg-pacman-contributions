import { describe, it, expect } from 'vitest';
import { GRID_WIDTH, GRID_HEIGHT } from '../src/core/constants.js';

describe('smoke', () => {
  it('carrega as constantes do grid', () => {
    expect(GRID_WIDTH).toBe(53);
    expect(GRID_HEIGHT).toBe(7);
  });
});
