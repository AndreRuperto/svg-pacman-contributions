import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { PacmanAI, STYLE_PROFILES } from '../src/movement/pacman-movement.js';
import { PlayerStyle } from '../src/types.js';

const setup = (style: PlayerStyle) => {
  const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE'], [44, 0, 'FOURTH_QUARTILE']], config: { playerStyle: style } });
  store.pacman.x = 42; store.pacman.y = 0;
  store.pacman.target = { x: 40, y: 0 };
  return store;
};
const ctx = (store: ReturnType<typeof makeStore>) => {
  const p = STYLE_PROFILES[store.config.playerStyle!];
  const danger = PacmanAI.buildDangerMap(store, p.horizon);
  return { p, danger, dist: PacmanAI.distanceMap(store.pacman), w: PacmanAI.dynamicWeights(store, p) };
};

describe('ajustes da IA', () => {
  it('limiar do alvo grudento depende do estilo', () => {
    expect(STYLE_PROFILES[PlayerStyle.CONSERVATIVE].stickyDanger)
      .toBeLessThan(STYLE_PROFILES[PlayerStyle.AGGRESSIVE].stickyDanger);
  });

  it('larga o alvo antigo para pegar o power-up quando um fantasma se aproxima', () => {
    const store = setup(PlayerStyle.OPPORTUNISTIC);
    const g = store.ghosts[0];
    Object.assign(g, { x: 38, y: 1, inHouse: false, scared: false, name: 'blinky', direction: 'right' });
    const { p, danger, dist, w } = ctx(store);
    expect(PacmanAI.chooseTarget(store, dist, danger, p, w)).toMatchObject({ x: 44, y: 0 });
  });

  it('sem fantasma por perto, mantém o alvo antigo', () => {
    const store = setup(PlayerStyle.OPPORTUNISTIC);
    const { p, danger, dist, w } = ctx(store);
    expect(PacmanAI.chooseTarget(store, dist, danger, p, w)).toMatchObject({ x: 40, y: 0 });
  });

  it('vizinho seguro evita a casa recém-visitada e a casa letal', () => {
    const store = makeStore();
    store.pacman.x = 40; store.pacman.y = 0;
    store.pacman.visitedAt = { '41,0': store.frameCount };
    const lethal = new Set<string>(['39,0']);
    const step = PacmanAI.safestNeighbor(store, new Map(), lethal, store.frameCount)!;
    expect(`${step.x},${step.y}`).not.toBe('41,0');
    expect(`${step.x},${step.y}`).not.toBe('39,0');
  });
});
