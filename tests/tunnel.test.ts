import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { MovementUtils } from '../src/movement/movement-utils.js';
import { GRID_WIDTH, TUNNEL_ROW, isTunnelCell } from '../src/core/constants.js';

describe('túnel', () => {
  makeStore(); // garante paredes construídas

  it('borda esquerda da linha 3 leva à direita', () => {
    const n = MovementUtils.getNeighbors(0, TUNNEL_ROW);
    expect(n).toContainEqual({ x: GRID_WIDTH - 1, y: TUNNEL_ROW, direction: 'left' });
  });
  it('borda direita da linha 3 leva à esquerda', () => {
    const n = MovementUtils.getNeighbors(GRID_WIDTH - 1, TUNNEL_ROW);
    expect(n).toContainEqual({ x: 0, y: TUNNEL_ROW, direction: 'right' });
  });
  it('outras linhas não dão a volta', () => {
    expect(MovementUtils.getNeighbors(0, 0).some(p => p.x === GRID_WIDTH - 1)).toBe(false);
  });
  it('gridDistance usa o atalho', () => {
    expect(MovementUtils.gridDistance({ x: 1, y: 3 }, { x: 51, y: 3 })).toBe(3);
    expect(MovementUtils.gridDistance({ x: 10, y: 0 }, { x: 12, y: 1 })).toBe(3);
  });
  it('opposite', () => {
    expect(MovementUtils.opposite('left')).toBe('right');
    expect(MovementUtils.opposite('up')).toBe('down');
  });
  it('isTunnelCell', () => {
    expect(isTunnelCell(1, 3)).toBe(true);
    expect(isTunnelCell(51, 3)).toBe(true);
    expect(isTunnelCell(2, 3)).toBe(false);
    expect(isTunnelCell(0, 2)).toBe(false);
  });
});
