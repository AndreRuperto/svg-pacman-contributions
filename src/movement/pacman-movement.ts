import { GRID_HEIGHT, GRID_WIDTH, POWERUP_FLASH_FRAMES } from '../core/constants.js';
import { ContributionLevel, Ghost, PlayerStyle, Point2d, StoreType } from '../types.js';
import { MovementUtils } from './movement-utils.js';
import { MinHeap } from '../utils/min-heap.js';

type Profile = { safety: number; points: number; horizon: number; powerupRange: number };

/** Pesos-base de cada estilo (os mesmos de antes) + horizonte de perigo e quando o power-up vale a pena. */
export const STYLE_PROFILES: Record<PlayerStyle, Profile> = {
  [PlayerStyle.CONSERVATIVE]:  { safety: 3.0, points: 0.3, horizon: 4, powerupRange: 3 },
  [PlayerStyle.OPPORTUNISTIC]: { safety: 1.2, points: 0.9, horizon: 3, powerupRange: 5 },
  [PlayerStyle.AGGRESSIVE]:    { safety: 0.4, points: 2.5, horizon: 1, powerupRange: Infinity }
};

const LEVEL_VALUE: Record<ContributionLevel, number> = {
  NONE: 0, FIRST_QUARTILE: 10, SECOND_QUARTILE: 20, THIRD_QUARTILE: 30, FOURTH_QUARTILE: 40
};
const DANGER_BASE = 15;
const DANGER_DECAY = 4;
const REVISIT_MAX = 50;
const REVISIT_DECAY_FRAMES = 50;

const key = (x: number, y: number) => `${x},${y}`;

export const getPlayerStyle = (store: StoreType): PlayerStyle =>
  store.config.playerStyle ?? PlayerStyle.OPPORTUNISTIC;

const debug = (store: StoreType, ...args: unknown[]) => { if (store.config.debug) console.log(...args); };

const dangerFactor = (g: Ghost) =>
  g.name === 'eyes' || g.inHouse ? 0 : !g.scared ? 1 : g.flashing ? 0.5 : 0;

/** Passos reais (paredes + túnel) de `from` até cada célula alcançável. */
const distanceMap = (from: Point2d): Map<string, number> => {
  const dist = new Map<string, number>([[key(from.x, from.y), 0]]);
  const queue: Point2d[] = [{ x: from.x, y: from.y }];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]; const d = dist.get(key(cur.x, cur.y))!;
    for (const n of MovementUtils.getNeighbors(cur.x, cur.y)) {
      const k = key(n.x, n.y);
      if (!dist.has(k)) { dist.set(k, d + 1); queue.push(n); }
    }
  }
  return dist;
};

/** Perigo previsto: BFS de cada fantasma até `horizon`; a casa à frente dele pesa como a dele. */
const buildDangerMap = (store: StoreType, horizon: number): Map<string, number> => {
  const map = new Map<string, number>();
  const bump = (k: string, v: number) => { if (v > (map.get(k) ?? 0)) map.set(k, v); };
  for (const g of store.ghosts) {
    const f = dangerFactor(g);
    if (!f) continue;
    const seen = new Map<string, number>([[key(g.x, g.y), 0]]);
    const queue: Point2d[] = [{ x: g.x, y: g.y }];
    bump(key(g.x, g.y), f * DANGER_BASE);
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i]; const d = seen.get(key(cur.x, cur.y))!;
      if (d >= horizon) continue;
      for (const n of MovementUtils.getNeighbors(cur.x, cur.y)) {
        const k = key(n.x, n.y);
        if (seen.has(k)) continue;
        const nd = d + 1;
        seen.set(k, nd); queue.push(n);
        const ahead = d === 0 && n.direction === g.direction;
        bump(k, f * Math.max(0, DANGER_BASE - (ahead ? 0 : nd * DANGER_DECAY)));
      }
    }
  }
  return map;
};

const revisitPenalty = (visitedFrame: number | undefined, frame: number): number =>
  visitedFrame === undefined ? 0 : REVISIT_MAX * Math.max(0, 1 - (frame - visitedFrame) / REVISIT_DECAY_FRAMES);

/** A*: custo do passo = 1 + perigo × segurança + revisita; heurística = gridDistance. Devolve só o próximo passo. */
const aStarNextStep = (
  start: Point2d, goal: Point2d, danger: Map<string, number>, safety: number,
  revisit: (k: string) => number
): Required<Point2d> | null => {
  if (start.x === goal.x && start.y === goal.y) return null;
  const startK = key(start.x, start.y), goalK = key(goal.x, goal.y);
  const g = new Map<string, number>([[startK, 0]]);
  const parent = new Map<string, { k: string; step: Required<Point2d> }>();
  const open = new MinHeap<{ x: number; y: number; k: string }>();
  open.push(MovementUtils.gridDistance(start, goal), { x: start.x, y: start.y, k: startK });
  const closed = new Set<string>();
  while (open.size) {
    const cur = open.pop()!;
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    if (cur.k === goalK) {
      let k = goalK; let step = parent.get(k)!;
      while (step.k !== startK) { k = step.k; step = parent.get(k)!; }
      return step.step;
    }
    for (const n of MovementUtils.getNeighbors(cur.x, cur.y)) {
      const nk = key(n.x, n.y);
      if (closed.has(nk)) continue;
      const cost = g.get(cur.k)! + 1 + (danger.get(nk) ?? 0) * safety + revisit(nk);
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        parent.set(nk, { k: cur.k, step: n });
        open.push(cost + MovementUtils.gridDistance(n, goal), { x: n.x, y: n.y, k: nk });
      }
    }
  }
  return null;
};

const closestDangerousGhost = (store: StoreType): number => {
  let best = Infinity;
  for (const g of store.ghosts) if (dangerFactor(g) === 1) best = Math.min(best, MovementUtils.gridDistance(g, store.pacman));
  return best;
};

/** Pesos dinâmicos: cautela com fantasma por perto, ousadia no power-up, pressa no fim. */
const dynamicWeights = (store: StoreType, p: Profile) => {
  let safety = p.safety, points = p.points;
  const closest = closestDangerousGhost(store);
  if (closest <= 3) safety *= 3; else if (closest <= 6) safety *= 1.5;
  if (store.pacman.powerupRemainingDuration > POWERUP_FLASH_FRAMES) safety *= 0.2;
  let left = 0;
  for (let x = 0; x < GRID_WIDTH; x++) for (let y = 0; y < GRID_HEIGHT; y++) if (store.grid[x][y].level !== 'NONE') left++;
  if (left <= 10) points *= 2;
  return { safety, points };
};

const chooseTarget = (
  store: StoreType, dist: Map<string, number>, danger: Map<string, number>,
  p: Profile, w: { safety: number; points: number }
): Point2d | null => {
  // 1) Com power-up folgado, caçar o fantasma assustado mais próximo que dá para alcançar.
  const left = store.pacman.powerupRemainingDuration;
  if (left > POWERUP_FLASH_FRAMES) {
    let best: Point2d | null = null, bestD = Infinity;
    for (const g of store.ghosts) {
      if (!g.scared || g.inHouse || g.name === 'eyes') continue;
      const d = dist.get(key(g.x, g.y));
      if (d !== undefined && d < left && d < bestD) { best = { x: g.x, y: g.y }; bestD = d; }
    }
    if (best) return best;
  }

  // 2) Manter o alvo atual enquanto ainda tem ponto e não ficou perigoso.
  const t = store.pacman.target;
  if (t && store.grid[t.x]?.[t.y]?.level !== 'NONE' && dist.has(key(t.x, t.y)) && (danger.get(key(t.x, t.y)) ?? 0) < 8) return t;

  // 3) Melhor célula por valor ÷ passos reais.
  const threat = closestDangerousGhost(store);
  let best: Point2d | null = null, bestScore = -Infinity;
  for (let x = 0; x < GRID_WIDTH; x++) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const cell = store.grid[x][y];
      if (cell.level === 'NONE') continue;
      const d = dist.get(key(x, y));
      if (!d) continue;
      let value = cell.level === 'FOURTH_QUARTILE' ? (threat <= p.powerupRange ? 200 : 1) : LEVEL_VALUE[cell.level];
      value += 5 * MovementUtils.getNeighbors(x, y).filter(n => store.grid[n.x][n.y].level !== 'NONE').length;
      const score = (value * w.points) / d - (danger.get(key(x, y)) ?? 0) * w.safety * 0.5;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
  }
  store.pacman.target = best ?? undefined;
  return best;
};

/** Sem alvo/rota: vizinho com menos perigo. */
const safestNeighbor = (store: StoreType, danger: Map<string, number>) =>
  MovementUtils.getNeighbors(store.pacman.x, store.pacman.y)
    .sort((a, b) => (danger.get(key(a.x, a.y)) ?? 0) - (danger.get(key(b.x, b.y)) ?? 0))[0] ?? null;

const updatePacmanPosition = (store: StoreType, step: Required<Point2d>, frame: number) => {
  store.pacman.visitedAt[key(store.pacman.x, store.pacman.y)] = frame;
  store.pacman.x = step.x;
  store.pacman.y = step.y;
  store.pacman.direction = step.direction;
};

const movePacman = (store: StoreType) => {
  if (store.pacman.deadRemainingDuration) return;
  store.pacman.visitedAt ||= {};
  const profile = STYLE_PROFILES[getPlayerStyle(store)];
  const weights = dynamicWeights(store, profile);
  const danger = buildDangerMap(store, profile.horizon);
  const dist = distanceMap(store.pacman);
  const target = chooseTarget(store, dist, danger, profile, weights);
  const frame = store.frameCount;
  const revisit = (k: string) => revisitPenalty(store.pacman.visitedAt[k], frame);
  const step = (target && aStarNextStep(store.pacman, target, danger, weights.safety, revisit)) || safestNeighbor(store, danger);
  if (step) updatePacmanPosition(store, step, frame);
  debug(store, `[pacman] f=${frame} alvo=${target ? key(target.x, target.y) : '-'} passo=${step ? key(step.x, step.y) : '-'}`);
};

export const PacmanAI = { distanceMap, buildDangerMap, aStarNextStep, revisitPenalty, chooseTarget, dynamicWeights };
export const PacmanMovement = { movePacman };
