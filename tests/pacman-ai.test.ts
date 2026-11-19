import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { PacmanAI } from '../src/movement/pacman-movement.js';
import { MovementUtils } from '../src/movement/movement-utils.js';
import type { Point2d } from '../src/types.js';

const walk = (start: Point2d, goal: Point2d, danger = new Map<string, number>(), safety = 1) => {
  const path: Point2d[] = []; let cur = start;
  for (let i = 0; i < 200 && !(cur.x === goal.x && cur.y === goal.y); i++) {
    const next = PacmanAI.aStarNextStep(cur, goal, danger, safety, () => 0)!;
    path.push(next); cur = next;
  }
  return path;
};

describe('IA do Pac-Man', () => {
  makeStore();

  it('A* acha a rota mais curta contornando paredes', () => {
    const start = { x: 0, y: 0 }, goal = { x: 0, y: 4 };
    const dist = PacmanAI.distanceMap(start);
    expect(walk(start, goal)).toHaveLength(dist.get('0,4')!);
  });

  it('A* usa o túnel quando é mais curto', () => {
    const path = walk({ x: 1, y: 3 }, { x: 51, y: 3 });
    expect(path).toHaveLength(3);
    expect(path[0]).toMatchObject({ x: 0, y: 3 });
  });

  it('peso de segurança alto desvia de casa perigosa; zero passa por cima', () => {
    // Se houver parede no trecho, trocar por outro trecho aberto de linhas 0–1.
    const danger = new Map([['36,0', 15]]);
    const careful = walk({ x: 34, y: 0 }, { x: 38, y: 0 }, danger, 3);
    const reckless = walk({ x: 34, y: 0 }, { x: 38, y: 0 }, danger, 0);
    expect(careful.some(p => p.x === 36 && p.y === 0)).toBe(false);
    expect(reckless.some(p => p.x === 36 && p.y === 0)).toBe(true);
  });

  it('horizonte do perigo depende do estilo', () => {
    const store = makeStore();
    const g = store.ghosts[0];
    Object.assign(g, { x: 40, y: 0, inHouse: false, scared: false, name: 'blinky', direction: 'left' });
    const far = PacmanAI.distanceMap(g);
    const cellAt3 = [...far.entries()].find(([, d]) => d === 3)![0];
    expect(PacmanAI.buildDangerMap(store, 4).get(cellAt3) ?? 0).toBeGreaterThan(0);
    expect(PacmanAI.buildDangerMap(store, 1).get(cellAt3) ?? 0).toBe(0);
  });

  it('penalidade de revisita decai a zero em 50 frames', () => {
    expect(PacmanAI.revisitPenalty(0, 0)).toBe(50);
    expect(PacmanAI.revisitPenalty(0, 25)).toBe(25);
    expect(PacmanAI.revisitPenalty(0, 50)).toBe(0);
    expect(PacmanAI.revisitPenalty(undefined, 10)).toBe(0);
  });

  it('gridDistance é admissível frente ao BFS', () => {
    const from = { x: 3, y: 1 };
    for (const [k, d] of PacmanAI.distanceMap(from)) {
      const [x, y] = k.split(',').map(Number);
      expect(MovementUtils.gridDistance(from, { x, y })).toBeLessThanOrEqual(d);
    }
  });
});
