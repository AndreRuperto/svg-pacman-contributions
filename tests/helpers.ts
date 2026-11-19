import { Grid } from '../src/utils/grid.js';
import { Store } from '../src/core/store.js';
import { GAME_THEMES, GRID_HEIGHT, GRID_WIDTH } from '../src/core/constants.js';
import { createRng } from '../src/utils/rng.js';
import { Game } from '../src/core/game.js';
import { levelToIndex } from '../src/utils/utils.js';
import type { Config, ContributionLevel, StoreType } from '../src/types.js';

let wallsBuilt = false;

export type CellSpec = [x: number, y: number, level: ContributionLevel];

/** Store pronto para Game.step: grid vazio + células dadas, paredes, semente fixa. */
export function makeStore(opts: { cells?: CellSpec[]; config?: Partial<Config>; seed?: string } = {}): StoreType {
  if (!wallsBuilt) { Grid.buildWalls(); wallsBuilt = true; }
  const store: StoreType = JSON.parse(JSON.stringify(Store));
  store.config = {
    platform: 'github',
    username: 'teste',
    canvas: undefined as unknown as HTMLCanvasElement,
    outputFormat: 'svg',
    svgCallback: () => {},
    gameOverCallback: () => {},
    gameTheme: 'github-dark',
    gameSpeed: 1,
    enableSounds: false,
    ...opts.config
  };
  const theme = GAME_THEMES[store.config.gameTheme];
  store.grid = Array.from({ length: GRID_WIDTH }, () =>
    Array.from({ length: GRID_HEIGHT }, () => ({
      commitsCount: 0, level: 'NONE' as ContributionLevel, color: theme.intensityColors[0]
    })));
  for (const [x, y, level] of opts.cells ?? []) {
    store.grid[x][y] = { commitsCount: 1, level, color: theme.intensityColors[levelToIndex(level)] };
  }
  store.monthLabels = Array(GRID_WIDTH).fill('');
  store.rng = createRng(opts.seed ?? 'seed-fixa');
  Game.initRound(store);
  return store;
}

/** Roda `n` frames. */
export const run = (store: StoreType, n: number) => { for (let i = 0; i < n; i++) Game.step(store); };

export const remaining = (store: StoreType) =>
  store.grid.some(col => col.some(c => c.level !== 'NONE'));
