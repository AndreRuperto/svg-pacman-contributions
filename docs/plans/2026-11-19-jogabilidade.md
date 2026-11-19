# Jogabilidade e IA — Plano de implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir os bugs de jogo, unificar power-ups/combo, adicionar túneis, fantasmas assustados realistas e uma IA do Pac-Man com A* — tudo reproduzível por semente e coberto por testes.

**Architecture:** Estado que hoje vive em variáveis de módulo (`frame`, combo, modo dos fantasmas) passa para `store.game`, para que `Game.step(store)` seja testável quadro a quadro. Todo movimento passa a expandir vizinhos por `MovementUtils.getNeighbors` (que já aplica o túnel) e medir distância por `gridDistance`. Sorteios usam `store.rng` (mulberry32 com semente). O renderizador ganha uma função de animação de posição que entende o salto do túnel.

**Tech Stack:** TypeScript 5 (ESM, imports com `.js`), Vitest, pnpm. Desenho: `docs/plans/2026-11-19-jogabilidade-design.md`.

**Convenções para quem executa:**
- Rodar tudo na raiz do worktree. Imports TS usam sufixo `.js` (ex.: `'../src/core/game.js'`); o Vitest resolve para `.ts`.
- Grid: 53 colunas (`x` 0–52) × 7 linhas (`y` 0–6). `WALLS.vertical[x][y]` = parede na borda **esquerda** da célula `(x,y)`; `WALLS.horizontal[x][y]` = parede na borda **de cima**. (O `hasWall` de `constants.ts` usa outra convenção e não é chamado por ninguém — não usar.)
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Após cada task: `pnpm test` e `pnpm exec tsc --noEmit` verdes antes do commit.

---

### Task 0: Ambiente e Vitest

**Files:**
- Modify: `package.json` (scripts, devDependencies)
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`

**Step 1: Instalar dependências**

Run: `pnpm install`
Se falhar compilando `canvas` (dependência nativa, não usada em `src/`), rodar `pnpm install --ignore-scripts`.

**Step 2: Adicionar Vitest**

Run: `pnpm add -D vitest@^3`
Em `package.json` → `scripts`, adicionar:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});
```

**Step 4: Teste de fumaça**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { GRID_WIDTH, GRID_HEIGHT } from '../src/core/constants.js';

describe('smoke', () => {
  it('carrega as constantes do grid', () => {
    expect(GRID_WIDTH).toBe(53);
    expect(GRID_HEIGHT).toBe(7);
  });
});
```

**Step 5: Rodar**

Run: `pnpm test` → Expected: 1 passed.
Run: `pnpm exec tsc --noEmit` → Expected: sem erros (se já houver erros antes de qualquer mudança, anotar a lista como linha de base e não piorá-la).

**Step 6: Commit**
```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/smoke.test.ts
git commit -m "test: adiciona Vitest"
```
(`pnpm-lock.yaml` está no `.gitignore`; se o `git add` reclamar, omita-o.)

---

### Task 1: RNG com semente

**Files:**
- Create: `src/utils/rng.ts`
- Test: `tests/rng.test.ts`

**Step 1: Teste**

`tests/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRng, defaultSeed } from '../src/utils/rng.js';

describe('rng', () => {
  it('mesma semente gera mesma sequência', () => {
    const a = createRng('x'), b = createRng('x');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('sementes diferentes geram sequências diferentes', () => {
    expect(createRng('x')()).not.toBe(createRng('y')());
  });
  it('valores ficam em [0, 1)', () => {
    const r = createRng('z');
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('semente padrão = usuário + dia (UTC)', () => {
    expect(defaultSeed('ana', new Date('2026-11-19T23:00:00Z'))).toBe('ana:2026-11-19');
  });
});
```

**Step 2:** Run `pnpm test tests/rng.test.ts` → FAIL (módulo não existe).

**Step 3: Implementação**

`src/utils/rng.ts`:
```ts
/** FNV-1a de 32 bits: transforma a semente textual em inteiro. */
export const hashSeed = (seed: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32: gerador rápido e reproduzível, devolve números em [0, 1). */
export const createRng = (seed: string): (() => number) => {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Mesma animação durante o dia; muda no dia seguinte. */
export const defaultSeed = (username: string, date: Date = new Date()): string =>
  `${username}:${date.toISOString().slice(0, 10)}`;
```

**Step 4:** Run `pnpm test tests/rng.test.ts` → 4 passed.

**Step 5: Commit** — `git add src/utils/rng.ts tests/rng.test.ts && git commit -m "feat: gerador aleatório com semente"`

---

### Task 2: Estado do jogo no store + `Game.step` testável

Objetivo: tirar `frame`, `ghostsEatenInCurrentPowerUp`, `currentMode`, `modeTimer` e `dotsRemaining` de variáveis de módulo; expor `Game.initRound` e `Game.step`; plugar `store.rng`. **Sem mudar comportamento** além disso.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/store.ts`
- Modify: `src/core/game.ts`
- Modify: `src/movement/ghosts-movement.ts`
- Modify: `src/index.ts`
- Create: `tests/helpers.ts`
- Test: `tests/game-step.test.ts`

**Step 1: Tipos** — em `src/types.ts`:

Em `Config`, adicionar:
```ts
  seed?: string;     // sobrepõe a semente padrão (usuário + dia)
  debug?: boolean;   // liga logs de diagnóstico
```
Adicionar antes de `StoreType`:
```ts
export interface GameState {
  frame: number;                 // frames desde o início da rodada (libera fantasmas)
  combo: number;                 // fantasmas comidos no power-up atual
  mode: 'scatter' | 'chase';
  modeTimer: number;
}
```
Em `StoreType`, adicionar:
```ts
  rng: () => number;
  game: GameState;
```
Em `Ghost`, adicionar:
```ts
  flashing?: boolean;   // power-up acabando
  moveTick?: number;    // contador para andar mais devagar
```

**Step 2: Store padrão** — em `src/core/store.ts`, dentro de `Store`, adicionar:
```ts
	rng: Math.random,
	game: { frame: 0, combo: 0, mode: 'scatter', modeTimer: 0 },
```

**Step 3: Helper de teste** — `tests/helpers.ts`:
```ts
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
```

**Step 4: Teste** — `tests/game-step.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeStore, run } from './helpers.js';

describe('Game.step', () => {
  it('avança o frame e grava um snapshot por passo', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    run(store, 5);
    expect(store.game.frame).toBe(5);
    expect(store.gameHistory).toHaveLength(5);
  });
  it('libera pinky no frame 10', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    run(store, 12);
    const pinky = store.ghosts.find(g => g.name === 'pinky')!;
    expect(pinky.y).toBeLessThanOrEqual(2);
  });
});
```

**Step 5:** Run `pnpm test tests/game-step.test.ts` → FAIL (`Game.initRound` não existe).

**Step 6: `src/core/game.ts`**

- Apagar `let frame = 0;` e `let ghostsEatenInCurrentPowerUp = 0;`. Trocar todos os usos por `store.game.frame` e `store.game.combo`.
- Criar `initRound` com o miolo de inicialização que hoje está em `startGame`:
```ts
const initRound = (store: StoreType) => {
  store.frameCount = 0;
  store.gameHistory = [];
  store.game = { frame: 0, combo: 0, mode: 'scatter', modeTimer: 0 };
  store.statistics = {
    totalPoints: 0, ghostsEaten: 0, deaths: 0, powerUpsCollected: 0,
    highestGhostCombo: 0, efficiencyMultiplier: 0, timeBonus: 0,
    pointsFromContributions: 0, pointsFromGhosts: 0
  };
  placePacman(store);
  placeGhosts(store);
};
```
- Mover a liberação dos fantasmas para dentro de `updateGame`, logo após o frame-skip:
```ts
  const f = store.game.frame;
  if (f === 10) releaseGhostFromHouse(store, 'pinky');
  if (f === 20) releaseGhostFromHouse(store, 'inky');
  if (f === 30) releaseGhostFromHouse(store, 'clyde');
  store.game.frame++;
```
- Onde hoje tem `frame = 0;` (fim da morte), trocar por `store.game.frame = 0;`.
- `startGame` fica:
```ts
const startGame = async (store: StoreType) => {
  store.grid = Utils.createGridFromData(store);
  initRound(store);
  const remainingCells = () => store.grid.some(row => row.some(cell => cell.commitsCount > 0));
  if (store.config.outputFormat === 'svg') {
    while (remainingCells()) await updateGame(store);
    await updateGame(store); // snapshot final + callbacks
  } else {
    clearInterval(store.gameInterval as number);
    store.gameInterval = setInterval(() => updateGame(store), DELTA_TIME) as unknown as number;
  }
};
```
- `updateGame` deixa de ser `async` (não tem `await` dentro). Ajuste: `const updateGame = (store: StoreType) => { ... }` e no `startGame` remover os `await` das chamadas.
- Apagar `resetFrame` (só zerava a variável removida; `grep -rn resetFrame src github-action/src` deve dar vazio).
- Export: `export const Game = { startGame, stopGame, initRound, step: updateGame };`

**Step 7: `src/movement/ghosts-movement.ts`**

- Apagar `let currentMode`, `let modeTimer`, `let currentLevel`, `let dotsRemaining`.
- `updateGameMode` usa `store.game.mode` / `store.game.modeTimer`.
- `countRemainingDots` passa a ser chamado onde `dotsRemaining` é lido (`calculateGhostTarget`): `const dotsRemaining = countRemainingDots(store);`.
- `moveGhosts` usa `store.game.mode === 'scatter'`.
- Trocar **todo** `Math.random()` por `store.rng()`. Em `BFSTargetLocation`, adicionar parâmetro final `rng: () => number` e passar `store.rng` nas chamadas.

**Step 8: `src/index.ts`** — depois de `this.store.config = {...}`:
```ts
    this.store.rng = createRng(this.store.config.seed ?? defaultSeed(this.store.config.username));
```
com `import { createRng, defaultSeed } from './utils/rng.js';`.

**Step 9:** Run `pnpm test` → tudo verde. `pnpm exec tsc --noEmit` → sem erros novos. `grep -rn "Math.random" src --include=*.ts | grep -v backup` → vazio.

**Step 10: Commit** — `git add -A src tests && git commit -m "refactor: estado do jogo no store e Game.step testável"`

---

### Task 3: Uma regra de comer, power-up que renova, combo, colisão por troca

**Files:**
- Modify: `src/core/constants.ts`
- Modify: `src/core/game.ts`
- Modify: `src/movement/pacman-movement.ts`
- Test: `tests/eating.test.ts`

**Step 1: Teste** — `tests/eating.test.ts`:
```ts
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
```

**Step 2:** Run `pnpm test tests/eating.test.ts` → FAIL.

**Step 3: Constantes** — em `constants.ts`: `PACMAN_POWERUP_DURATION = 30;` e adicionar `export const POWERUP_FLASH_FRAMES = 6;`.

**Step 4: `game.ts`**

- `GHOST_BASE_POINTS = 200`.
- Extrair o bloco "comer" de `updateGame` para `eatCell(store)`:
```ts
const eatCell = (store: StoreType) => {
  const cell = store.grid[store.pacman.x]?.[store.pacman.y];
  if (!cell || cell.level === 'NONE') return;
  const points = POINTS_MAP[cell.level];
  store.pacman.points += points;
  store.pacman.totalPoints += points;
  store.statistics!.totalPoints += points;
  store.statistics!.pointsFromContributions = (store.statistics!.pointsFromContributions ?? 0) + points;
  const isPowerUp = cell.level === 'FOURTH_QUARTILE';
  cell.commitsCount = 0;
  cell.level = 'NONE';
  cell.color = Utils.getCurrentTheme(store).intensityColors[0];
  if (isPowerUp) activatePowerUp(store);
};

const activatePowerUp = (store: StoreType) => {
  if (store.pacman.powerupRemainingDuration === 0) store.game.combo = 0;
  store.pacman.powerupRemainingDuration = PACMAN_POWERUP_DURATION;
  store.statistics!.powerUpsCollected++;
  store.ghosts.forEach(g => {
    if (g.inHouse || g.name === 'eyes') return;
    g.scared = true;
    g.flashing = false;
  });
};
```
- Em `updateGame`, trocar o bloco antigo por `eatCell(store);` logo após `PacmanMovement.movePacman(store);`.
- Timer do power-up:
```ts
  if (store.pacman.powerupRemainingDuration > 0) {
    store.pacman.powerupRemainingDuration--;
    const left = store.pacman.powerupRemainingDuration;
    store.ghosts.forEach(g => { if (g.scared) g.flashing = left > 0 && left <= POWERUP_FLASH_FRAMES; });
    if (left === 0) {
      store.ghosts.forEach(g => { g.scared = false; g.flashing = false; });
      store.game.combo = 0;
    }
  }
```
- `checkCollisions`: trocar `ghostsEatenInCurrentPowerUp` por `store.game.combo`; ao comer fantasma também `ghost.flashing = false`; ignorar fantasmas `inHouse`. Extrair o corpo da colisão de um fantasma para `collideWith(store, ghost)` e fazer `checkCollisions` chamá-lo quando posições coincidem.
- Colisão por troca:
```ts
const checkSwapCollisions = (store: StoreType, pacPrev: Point2d, ghostsPrev: Point2d[]) => {
  if (store.pacman.deadRemainingDuration) return;
  store.ghosts.forEach((g, i) => {
    const gp = ghostsPrev[i];
    if (!gp || g.name === 'eyes' || g.inHouse) return;
    const swapped = gp.x === store.pacman.x && gp.y === store.pacman.y && g.x === pacPrev.x && g.y === pacPrev.y;
    if (swapped) collideWith(store, g);
  });
};
```
Em `updateGame`, antes de `movePacman` guardar `const pacPrev = { x: store.pacman.x, y: store.pacman.y };`; antes de `moveGhosts` guardar `const ghostsPrev = store.ghosts.map(g => ({ x: g.x, y: g.y }));`; depois do `checkCollisions` final chamar `checkSwapCollisions(store, pacPrev, ghostsPrev)`.
- Export: `export const Game = { startGame, stopGame, initRound, step: updateGame, eatCell, checkCollisions, checkSwapCollisions };` (importar `Point2d` de `../types.js`).

**Step 5: `pacman-movement.ts`** — apagar `checkAndEatPoint`, `activatePowerUp` e a chamada `checkAndEatPoint(store)` em `movePacman`; remover import de `PACMAN_POWERUP_DURATION` e `Utils` se ficarem sem uso.

**Step 6:** Run `pnpm test` → verde.

**Step 7: Commit** — `git commit -am "fix: comer uma vez só, power-up renova, combo 200→1600, colisão por troca"`

---

### Task 4: Renascimento no grid, estilo do jogador, Action

**Files:**
- Modify: `src/core/game.ts` (`resetPacman`, respawn)
- Modify: `src/movement/ghosts-movement.ts` (respawn em `moveGhostInHouse`)
- Modify: `src/movement/pacman-movement.ts` (`getPlayerStyle`)
- Modify: `github-action/src/index.js`, `action.yml`
- Test: `tests/respawn-style.test.ts`

**Step 1: Teste** — `tests/respawn-style.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeStore, run } from './helpers.js';
import { GRID_HEIGHT, PACMAN_DEATH_DURATION } from '../src/core/constants.js';
import { getPlayerStyle } from '../src/movement/pacman-movement.js';
import { PlayerStyle } from '../src/types.js';

describe('renascimento e estilo', () => {
  it('Pac-Man renasce dentro do grid', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    store.pacman.deadRemainingDuration = 1;
    run(store, 1);
    expect(store.pacman.y).toBeGreaterThanOrEqual(0);
    expect(store.pacman.y).toBeLessThan(GRID_HEIGHT);
    expect(store.pacman).toMatchObject({ x: 26, y: 5 });
  });

  it('fantasma comido renasce perigoso mesmo com power-up ativo', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    const g = store.ghosts[0];
    Object.assign(g, { name: 'eyes', originalName: 'blinky', inHouse: true, respawnCounter: 1, x: 26, y: 3, scared: false });
    store.pacman.powerupRemainingDuration = 20;
    run(store, 1);
    expect(g.name).toBe('blinky');
    expect(g.scared).toBe(false);
  });

  it('estilo vem da config', () => {
    const store = makeStore({ config: { playerStyle: PlayerStyle.CONSERVATIVE } });
    expect(getPlayerStyle(store)).toBe(PlayerStyle.CONSERVATIVE);
    expect(getPlayerStyle(makeStore())).toBe(PlayerStyle.OPPORTUNISTIC);
  });
});
```
(`PACMAN_DEATH_DURATION` importado só para documentar; remova o import se o lint de TS reclamar.)

**Step 2:** Run → FAIL.

**Step 3:** 
- `resetPacman`: `store.pacman.x = 26; store.pacman.y = 5;` e zerar `recentPositions`. A casa dos fantasmas ocupa `x` 25–27, `y` 2–3 (paredes `GH_*`), então `(27,3)` cairia dentro dela; `(26,5)` fica logo abaixo, em área livre.
- Respawn em `game.ts` e em `moveGhostInHouse`: `ghost.scared = false; ghost.flashing = false;`.
- `pacman-movement.ts`:
```ts
export const getPlayerStyle = (store: StoreType): PlayerStyle =>
  store.config.playerStyle ?? PlayerStyle.OPPORTUNISTIC;
```
  e trocar a chamada `getPlayerStyle()` por `getPlayerStyle(store)`.
- `github-action/src/index.js`: `playerStyle: 'oportunista'` → `playerStyle`.
- `action.yml`, em `inputs`:
```yaml
  player_style:
    description: 'Estilo do Pac-Man (oportunista, conservador, agressivo)'
    required: false
    default: 'oportunista'
```

**Step 4:** Run `pnpm test` → verde.

**Step 5: Commit** — `git commit -am "fix: renascimento dentro do grid, estilo do jogador vindo da config e da Action"`

---

### Task 5: Túneis — vizinhos e distância

**Files:**
- Modify: `src/core/constants.ts`
- Modify: `src/movement/movement-utils.ts`
- Test: `tests/tunnel.test.ts`

**Step 1: Teste** — `tests/tunnel.test.ts`:
```ts
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
```

**Step 2:** Run → FAIL.

**Step 3: Implementação**

`constants.ts`:
```ts
export const TUNNEL_ROW = 3;
/** Células de "boca" do túnel (fantasmas andam mais devagar aqui). */
export const isTunnelCell = (x: number, y: number) =>
  y === TUNNEL_ROW && (x <= 1 || x >= GRID_WIDTH - 2);
```

`movement-utils.ts` — adicionar (e exportar no objeto `MovementUtils`):
```ts
type Dir = 'right' | 'left' | 'up' | 'down';

const dirOf = (dx: number, dy: number): Dir =>
  dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';

const opposite = (d: Dir): Dir =>
  ({ right: 'left', left: 'right', up: 'down', down: 'up' } as const)[d];

/** Vizinhos alcançáveis, já com o salto do túnel e a direção do passo. */
const getNeighbors = (x: number, y: number): Required<Point2d>[] => {
  const res: Required<Point2d>[] = getValidMoves(x, y).map(([dx, dy]) => ({ x: x + dx, y: y + dy, direction: dirOf(dx, dy) }));
  if (y === TUNNEL_ROW && x === 0) res.push({ x: GRID_WIDTH - 1, y, direction: 'left' });
  if (y === TUNNEL_ROW && x === GRID_WIDTH - 1) res.push({ x: 0, y, direction: 'right' });
  return res;
};

/** Manhattan considerando o atalho do túnel. Nunca superestima (serve de heurística do A*). */
const gridDistance = (a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const direct = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const viaTunnel =
    Math.min(a.x, b.x) + 1 + (GRID_WIDTH - 1 - Math.max(a.x, b.x)) +
    Math.abs(a.y - TUNNEL_ROW) + Math.abs(b.y - TUNNEL_ROW);
  return Math.min(direct, viaTunnel);
};
```
Importar `TUNNEL_ROW` de `../core/constants.js`. Reescrever `findNextStepDijkstra` para expandir com `getNeighbors` (mantendo a assinatura; retorna o `Point2d` com `direction`).

**Step 4:** Run → verde. **Step 5: Commit** — `git commit -am "feat: túnel na linha 3 (vizinhos e distância)"`

---

### Task 6: Todo mundo anda pelo túnel

Trocar `getValidMoves` + `x + dx` por `getNeighbors` em todos os chamadores, e direção calculada pelo sinal de `dx` pela `direction` do vizinho.

**Files:**
- Modify: `src/movement/ghosts-movement.ts` (`BFSTargetLocation`, `getValidMovesWithoutReverse`, `moveEyesToHome`)
- Modify: `src/movement/pacman-movement.ts` (`calculateOptimalPath`, `buildPredictiveDanger`, `makeDesperationMove`, `updatePacmanPosition`)
- Test: `tests/tunnel-use.test.ts`

**Step 1: Teste**
```ts
import { describe, it, expect } from 'vitest';
import { makeStore, run } from './helpers.js';

describe('uso do túnel', () => {
  it('Pac-Man atravessa o túnel quando o alvo está do outro lado', () => {
    const store = makeStore({ cells: [[51, 3, 'FIRST_QUARTILE']] });
    store.ghosts.forEach(g => { g.x = 26; g.y = 3; g.inHouse = true; });
    store.pacman.x = 1; store.pacman.y = 3;
    run(store, 3);
    expect(store.grid[51][3].level).toBe('NONE');
  });

  it('salto do túnel mantém a direção do movimento', () => {
    const store = makeStore({ cells: [[51, 3, 'FIRST_QUARTILE']] });
    store.ghosts.forEach(g => { g.x = 26; g.y = 3; g.inHouse = true; });
    store.pacman.x = 0; store.pacman.y = 3;
    run(store, 1);
    expect(store.pacman).toMatchObject({ x: 52, y: 3, direction: 'left' });
  });
});
```
(Os fantasmas ficam presos na casa para não interferirem; `inHouse` sem `justReleasedFromHouse` só os faz quicar dentro dela. A liberação automática ocorre no frame 10, depois do teste.)

**Step 2:** Run → FAIL.

**Step 3:**
- `updatePacmanPosition(store, position)` passa a usar `position.direction` quando existir; o cálculo por `dx/dy` fica só como fallback.
- `BFSTargetLocation`: expandir com `getNeighbors(x, y)`; filtro de reversão vira `n.direction !== opposite(direction)` (permitindo reversão quando é o único vizinho); devolver `{ x, y, direction }` do primeiro passo; fallback aleatório escolhe `neighbors[Math.floor(rng() * neighbors.length)]`.
- `getValidMovesWithoutReverse` → `getNeighborsWithoutReverse(ghost)` devolvendo vizinhos.
- `moveEyesToHome`: direção vem de `nextMove.direction`.
- `pacman-movement.ts`: em `calculateOptimalPath`, `buildPredictiveDanger` e `makeDesperationMove`, iterar `getNeighbors` em vez de `getValidMoves`. (Esse arquivo será reescrito na Task 10; aqui basta funcionar.)

**Step 4:** `pnpm test` → verde. **Step 5: Commit** — `git commit -am "feat: Pac-Man, fantasmas e olhos usam o túnel"`

---

### Task 7: Velocidade dos fantasmas (túnel e assustados) + virar ao assustar

**Files:**
- Modify: `src/movement/ghosts-movement.ts`
- Modify: `src/core/game.ts` (`activatePowerUp`)
- Test: `tests/ghost-speed.test.ts`

**Step 1: Teste**
```ts
import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { GhostsMovement } from '../src/movement/ghosts-movement.js';
import { Game } from '../src/core/game.js';

const freeGhost = (store: ReturnType<typeof makeStore>, x: number, y: number) => {
  const g = store.ghosts[0];
  Object.assign(g, { x, y, inHouse: false, scared: false, name: 'blinky', direction: 'left', moveTick: 0 });
  store.ghosts.slice(1).forEach(o => { o.inHouse = true; o.x = 26; o.y = 3; });
  return g;
};

describe('velocidade dos fantasmas', () => {
  it('normal anda todo frame', () => {
    const store = makeStore(); const g = freeGhost(store, 40, 0);
    const before = `${g.x},${g.y}`;
    GhostsMovement.moveGhosts(store);
    expect(`${g.x},${g.y}`).not.toBe(before);
  });
  it('no túnel anda 1 a cada 2 frames', () => {
    const store = makeStore(); const g = freeGhost(store, 1, 3);
    GhostsMovement.moveGhosts(store);
    expect(g).toMatchObject({ x: 1, y: 3 });
    GhostsMovement.moveGhosts(store);
    expect(`${g.x},${g.y}`).not.toBe('1,3');
  });
  it('assustado anda 1 a cada 2 frames', () => {
    const store = makeStore(); const g = freeGhost(store, 40, 0);
    g.scared = true;
    const moved: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const before = `${g.x},${g.y}`;
      GhostsMovement.moveGhosts(store);
      moved.push(`${g.x},${g.y}` !== before);
    }
    expect(moved).toEqual([false, true, false, true, false, true]);
  });
  it('vira de costas ao ser assustado', () => {
    const store = makeStore({ cells: [[5, 0, 'FOURTH_QUARTILE']] });
    const g = freeGhost(store, 40, 0);
    g.direction = 'left';
    store.pacman.x = 5; store.pacman.y = 0;
    Game.eatCell(store);
    expect(g.direction).toBe('right');
  });
});
```

**Step 2:** Run → FAIL.

**Step 3:**
`ghosts-movement.ts`, no laço de `moveGhosts`, logo após o tratamento de `inHouse` e antes de escolher o movimento:
```ts
        if (ghost.name !== 'eyes') {
            let every = 1;
            if (ghost.scared) every *= 2;
            if (isTunnelCell(ghost.x, ghost.y)) every *= 2;
            ghost.moveTick = (ghost.moveTick ?? 0) + 1;
            if (ghost.moveTick < every) continue;
            ghost.moveTick = 0;
        }
```
Apagar a linha `if (store.pacman.powerupRemainingDuration && Math.random() < 0.6) return;` de `moveScaredGhost`.

`game.ts` → `activatePowerUp`: antes de `g.scared = true`, `if (!g.scared) g.direction = MovementUtils.opposite(g.direction);` (importar `MovementUtils`).

**Step 4:** `pnpm test` → verde. **Step 5: Commit** — `git commit -am "feat: fantasmas lentos no túnel e assustados; viram de costas no power-up"`

---

### Task 8: Fuga com ruído

**Files:**
- Modify: `src/movement/ghosts-movement.ts` (`moveScaredGhost`; apagar `getRandomDestination`)
- Test: `tests/scared.test.ts`

**Step 1: Teste**
```ts
import { describe, it, expect } from 'vitest';
import { makeStore } from './helpers.js';
import { GhostsMovement } from '../src/movement/ghosts-movement.js';
import { MovementUtils } from '../src/movement/movement-utils.js';
import { createRng } from '../src/utils/rng.js';

const setup = () => {
  const store = makeStore({ seed: 'fuga' });
  const g = store.ghosts[0];
  Object.assign(g, { x: 14, y: 0, inHouse: false, scared: true, name: 'blinky', direction: 'right' });
  store.ghosts.slice(1).forEach(o => { o.inHouse = true; o.x = 26; o.y = 3; });
  store.pacman.x = 10; store.pacman.y = 0;
  return { store, g };
};

describe('fantasma assustado', () => {
  it('não reverte num corredor', () => {
    const { store, g } = setup();
    for (let i = 0; i < 40; i++) {
      const dir = g.direction;
      const opts = MovementUtils.getNeighbors(g.x, g.y);
      const before = `${g.x},${g.y}`;
      GhostsMovement.moveScaredGhost(g, store);
      if (opts.length > 1 && `${g.x},${g.y}` !== before) {
        expect(g.direction).not.toBe(MovementUtils.opposite(dir));
      }
    }
  });

  it('se afasta mais do Pac-Man que um passeio aleatório', () => {
    const { store, g } = setup();
    let fleeSum = 0;
    for (let i = 0; i < 20; i++) { GhostsMovement.moveScaredGhost(g, store); fleeSum += MovementUtils.gridDistance(g, store.pacman); }

    const rng = createRng('fuga');
    let p = { x: 14, y: 0 }; let randSum = 0;
    for (let i = 0; i < 20; i++) {
      const n = MovementUtils.getNeighbors(p.x, p.y);
      p = n[Math.floor(rng() * n.length)];
      randSum += MovementUtils.gridDistance(p, store.pacman);
    }
    expect(fleeSum).toBeGreaterThan(randSum);
  });
});
```

**Step 2:** Run → FAIL (`moveScaredGhost` não exportado).

**Step 3:** Substituir `moveScaredGhost`:
```ts
/** Foge do Pac-Man com ruído: maioria das vezes se afasta, às vezes hesita. */
const moveScaredGhost = (ghost: Ghost, store: StoreType) => {
    const all = MovementUtils.getNeighbors(ghost.x, ghost.y);
    const forward = all.filter(n => n.direction !== MovementUtils.opposite(ghost.direction));
    const choices = forward.length ? forward : all;
    if (!choices.length) return;

    const weights = choices.map(n => {
        const flee = MovementUtils.gridDistance(n, store.pacman);
        const deadEnd = MovementUtils.getNeighbors(n.x, n.y).length <= 1 ? 4 : 0;
        const noise = store.rng() * 3;
        const w = Math.max(0.1, flee - deadEnd + noise);
        return w * w; // acentua a preferência pela fuga
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = store.rng() * total;
    let idx = 0;
    for (; idx < weights.length - 1; idx++) {
        r -= weights[idx];
        if (r <= 0) break;
    }
    const next = choices[idx];
    ghost.x = next.x;
    ghost.y = next.y;
    ghost.direction = next.direction;
};
```
Apagar `getRandomDestination`. Exportar: `export const GhostsMovement = { moveGhosts, moveScaredGhost };`

**Step 4:** `pnpm test` → verde. Se o teste de fuga falhar por pouco, aumentar o expoente (`w ** 3`) antes de mexer no teste.

**Step 5: Commit** — `git commit -am "feat: fantasmas assustados fogem com ruído reproduzível"`

---

### Task 9: Renderizador — salto do túnel, recorte, bocas do túnel, piscar

**Files:**
- Modify: `src/types.ts` (`GameTheme`)
- Modify: `src/core/constants.ts` (tokens nos 3 temas)
- Modify: `src/renderers/svg.ts`
- Test: `tests/svg.test.ts`

**Step 1: Teste**
```ts
import { describe, it, expect } from 'vitest';
import { generatePositionAnimation, SVG } from '../src/renderers/svg.js';
import { CELL_SIZE, GAP_SIZE, GRID_WIDTH } from '../src/core/constants.js';
import { makeStore, run } from './helpers.js';

const px = (x: number) => x * (CELL_SIZE + GAP_SIZE);

describe('svg', () => {
  it('salto do túnel não passa pelo meio do mapa', () => {
    const anim = generatePositionAnimation([{ x: 1, y: 3 }, { x: 0, y: 3 }, { x: 52, y: 3 }, { x: 51, y: 3 }]);
    const xs = anim.values.split(';').map(v => Number(v.split(',')[0]));
    // entre 0 e 52 só aparecem as posições fora da borda (-1 e 53)
    const i0 = xs.indexOf(px(0)), i52 = xs.indexOf(px(52));
    expect(xs.slice(i0 + 1, i52)).toEqual([px(-1), px(GRID_WIDTH)]);
    const times = anim.keyTimes.split(';').map(Number);
    expect(times[0]).toBe(0);
    expect(times[times.length - 1]).toBe(1);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
  });

  it('mantém só as pontas de cada trecho parado', () => {
    const anim = generatePositionAnimation([{ x: 5, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }]);
    expect(anim.keyTimes.split(';')).toHaveLength(3); // 0, fim do trecho parado, 1
  });

  it('gera SVG com recorte, bocas do túnel e estado de piscar', () => {
    const store = makeStore({ cells: [[40, 0, 'FIRST_QUARTILE']] });
    store.ghosts[0].inHouse = false;
    store.pacman.powerupRemainingDuration = 8;
    store.ghosts[0].scared = true;
    run(store, 6);
    const svg = SVG.generateAnimatedSVG(store);
    expect(svg).toContain('clip-path="url(#arena)"');
    expect(svg).toContain('id="tunnel-left"');
    expect(svg).toContain('id="tunnel-right"');
    expect(svg).toContain('#ghost-scared-flash');
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Tokens de tema** — `GameTheme` ganha `tunnelColor: string; tunnelActiveColor: string;`. Em `GAME_THEMES`:
- `github`: `tunnelColor: '#8c959f', tunnelActiveColor: '#00FFFF'`
- `github-dark`: `tunnelColor: '#6e7681', tunnelActiveColor: '#00FFFF'`
- `brasa`: `tunnelColor: '#5C4F49', tunnelActiveColor: '#00FFFF'`

**Step 4: `svg.ts`**

a) Nova função exportada (substitui `generatePacManPositions` e `generateGhostPositions`, que devem ser apagadas):
```ts
const toPixel = (x: number, y: number) => `${x * (CELL_SIZE + GAP_SIZE)},${y * (CELL_SIZE + GAP_SIZE) + 15}`;
const samePos = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;
const isWrap = (a: { x: number; y: number }, b: { x: number; y: number }) => a.y === b.y && Math.abs(a.x - b.x) > 1;

/** Animação de posição com interpolação linear entre frames; o salto do túnel some por uma borda e surge pela outra. */
export const generatePositionAnimation = (points: { x: number; y: number }[]): AnimationData => {
	const n = points.length;
	if (n === 0) return { keyTimes: '0;1', values: '0,0;0,0' };
	if (n === 1) { const v = toPixel(points[0].x, points[0].y); return { keyTimes: '0;1', values: `${v};${v}` }; }
	const t = (i: number) => i / (n - 1);
	const fmt = (v: number) => Number(v.toFixed(6));
	const keyTimes: number[] = [];
	const values: string[] = [];
	for (let i = 0; i < n; i++) {
		const p = points[i];
		if (i > 0 && isWrap(points[i - 1], p)) {
			const prev = points[i - 1];
			const mid = (t(i - 1) + t(i)) / 2;
			const exitX = prev.x === 0 ? -1 : GRID_WIDTH;
			const enterX = p.x === 0 ? -1 : GRID_WIDTH;
			keyTimes.push(fmt(mid)); values.push(toPixel(exitX, p.y));
			keyTimes.push(fmt(mid + 0.000001)); values.push(toPixel(enterX, p.y));
		}
		const keep = i === 0 || i === n - 1 || !samePos(p, points[i - 1]) || !samePos(p, points[i + 1]);
		if (keep) { keyTimes.push(fmt(t(i))); values.push(toPixel(p.x, p.y)); }
	}
	return { keyTimes: keyTimes.join(';'), values: values.join(';') };
};
```
Uso: Pac-Man → `generatePositionAnimation(store.gameHistory.map(s => s.pacman))`; fantasma `i` → `generatePositionAnimation(store.gameHistory.map(s => s.ghosts[i] ?? { x: 0, y: 0 }))`.

b) Recorte: logo depois de `generateGhostsPredefinition()`:
```ts
	const arenaHeight = GRID_HEIGHT * (CELL_SIZE + GAP_SIZE);
	svg += `<defs><clipPath id="arena"><rect x="0" y="15" width="${svgWidth}" height="${arenaHeight}"/></clipPath></defs>`;
```
Envolver o `<path id="pacman">` e todos os `<g id="ghost…">` em `<g clip-path="url(#arena)"> … </g>`.

c) Bocas do túnel (depois das paredes):
```ts
	const theme = Utils.getCurrentTheme(store);
	const mouthColors = (mouthX: number) => generateChangingValuesAnimation(store, store.gameHistory.map(s =>
		MovementUtils.gridDistance(s.pacman, { x: mouthX, y: TUNNEL_ROW }) <= 3 ? theme.tunnelActiveColor : theme.tunnelColor));
	const mouthY = TUNNEL_ROW * (CELL_SIZE + GAP_SIZE) + 15;
	for (const [id, mx, rx] of [['tunnel-left', 0, 0], ['tunnel-right', GRID_WIDTH - 1, svgWidth - 3]] as const) {
		const a = mouthColors(mx);
		svg += `<rect id="${id}" x="${rx}" y="${mouthY}" width="3" height="${CELL_SIZE}" rx="1.5" fill="${theme.tunnelColor}">
		  <animate attributeName="fill" dur="${totalDurationMs}ms" repeatCount="indefinite" keyTimes="${a.keyTimes}" values="${a.values}"/>
		</rect>`;
	}
```
(importar `TUNNEL_ROW` e `MovementUtils`.)

d) Piscar: em `generateGhostsPredefinition`, adicionar:
```ts
    defs += `
    <filter id="flash-white"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>
    <symbol id="ghost-scared-flash" viewBox="0 0 ${CELL_SIZE} ${CELL_SIZE}">
        <image href="${(GHOSTS['scared'] as { imgDate: string }).imgDate}" width="${CELL_SIZE}" height="${CELL_SIZE}" filter="url(#flash-white)"/>
    </symbol>`;
```
Em `mapGhostStateChanges`: adicionar `'scared-flash'` a `allPossibleStates`; o estado de um frame vira
```ts
const stateOf = (g: Ghost, frameIndex: number) =>
    g.scared ? (g.flashing && frameIndex % 2 === 1 ? 'scared-flash' : 'scared')
    : g.name === 'eyes' ? `eyes-${g.direction || 'right'}` : `${g.name}-${g.direction || 'right'}`;
```
usado tanto para o estado inicial (`stateOf(initialGhost, 0)`) quanto no laço.

**Step 5:** `pnpm test` → verde.

**Step 6: Commit** — `git commit -am "feat(svg): salto do túnel, recorte da arena, bocas do túnel e fantasma piscando"`

---

### Task 10: IA do Pac-Man (A*, alvo, perigo previsto, pesos dinâmicos, revisita)

**Files:**
- Create: `src/utils/min-heap.ts`
- Rewrite: `src/movement/pacman-movement.ts`
- Modify: `src/types.ts` (`Pacman.visitedAt`), `src/core/store.ts`, `src/core/game.ts` (`placePacman`, `resetPacman`)
- Test: `tests/pacman-ai.test.ts`

**Step 1: Teste**
```ts
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
```

**Step 2:** Run → FAIL.

**Step 3: Heap** — `src/utils/min-heap.ts`:
```ts
export class MinHeap<T> {
  private items: { key: number; value: T }[] = [];
  get size() { return this.items.length; }
  push(key: number, value: T) {
    const a = this.items; a.push({ key, value });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].key <= a[i].key) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items; if (!a.length) return undefined;
    const top = a[0].value; const last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].key < a[m].key) m = l;
        if (r < a.length && a[r].key < a[m].key) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}
```

**Step 4: Tipos/estado** — `Pacman`: trocar `recentPositions: string[]` por `visitedAt: Record<string, number>`; atualizar `store.ts`, `placePacman` e `resetPacman` (`visitedAt: {}`). `pushSnapshot` copia `pacman` raso — ok, o renderizador não lê `visitedAt`.

**Step 5: Reescrever `src/movement/pacman-movement.ts`:**
```ts
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
```
Nota: no teste, `aStarNextStep(cur, goal, danger, safety, () => 0)` — o 5º parâmetro é a função de revisita.

**Step 6:** `pnpm test` → verde. Se o teste do desvio falhar por haver parede entre `x` 34–38 nas linhas 0–1, escolher outro trecho aberto (ex.: `x` 13–17 linha 0 — conferir com `MovementUtils.getNeighbors`) e manter a lógica do teste.

**Step 7: Commit** — `git commit -am "feat: IA do Pac-Man com A*, perigo previsto por estilo, pesos dinâmicos e revisita com decaimento"`

---

### Task 11: Limpeza e partida completa

**Files:**
- Delete: `src/movement/pacman-movement-backup.ts`
- Modify: `src/core/constants.ts` (apagar `hasWall`, não usado)
- Test: `tests/full-game.test.ts`

**Step 1: Teste**
```ts
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { makeStore, remaining, type CellSpec } from './helpers.js';
import { Game } from '../src/core/game.js';
import { SVG } from '../src/renderers/svg.js';
import { createRng } from '../src/utils/rng.js';
import { PlayerStyle } from '../src/types.js';
import { GRID_HEIGHT, GRID_WIDTH } from '../src/core/constants.js';

const LEVELS = ['FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'] as const;
const randomCells = (seed: string, n: number): CellSpec[] => {
  const r = createRng(seed); const cells = new Map<string, CellSpec>();
  while (cells.size < n) {
    const x = Math.floor(r() * GRID_WIDTH), y = Math.floor(r() * GRID_HEIGHT);
    const level = r() < 0.08 ? 'FOURTH_QUARTILE' : LEVELS[Math.floor(r() * 3)];
    cells.set(`${x},${y}`, [x, y, level]);
  }
  return [...cells.values()];
};

describe('partida completa', () => {
  for (const style of Object.values(PlayerStyle)) {
    it(`termina com estilo ${style}`, () => {
      const store = makeStore({ cells: randomCells('mapa', 150), config: { playerStyle: style }, seed: 'partida' });
      let frames = 0;
      while (remaining(store) && frames < 20000) { Game.step(store); frames++; }
      expect(remaining(store)).toBe(false);
      Game.step(store); // finaliza estatísticas
      const s = store.statistics!;
      console.log(`${style}: ${frames} frames, ${s.deaths} mortes, ${s.ghostsEaten} fantasmas, combo ${s.highestGhostCombo}, ${s.totalPoints} pts`);
      mkdirSync('outputs', { recursive: true });
      writeFileSync(`outputs/partida-${style}.svg`, SVG.generateAnimatedSVG(store));
    }, 60000);
  }
});
```

**Step 2:** Run `pnpm test tests/full-game.test.ts` → espera-se verde já (é teste de integração). Se algum estilo não terminar em 20000 frames, **parar e investigar com @superpowers:systematic-debugging** (rodar com `config.debug: true` e olhar onde o Pac-Man fica preso) — não aumentar o limite.

**Step 3: Limpeza**
- `git rm src/movement/pacman-movement-backup.ts`
- Apagar `hasWall` de `constants.ts` (`grep -rn hasWall src` deve ficar vazio).
- `grep -rn "console.log" src --include=*.ts` — remover os de diagnóstico por frame em `ghosts-movement.ts`/`game.ts` ou trocá-los por `if (store.config.debug)`. Manter os de `index.ts` (uma vez por geração).
- Apagar o bloco de log `__loggedGhosts` em `moveGhosts` (só alimentava logs comentados) e o campo `__loggedGhosts` de `StoreType`.

**Step 4:** `pnpm test` e `pnpm exec tsc --noEmit` → verdes.

**Step 5: Revisão visual** — abrir `outputs/partida-*.svg` no navegador (painel do app) e conferir: Pac-Man some e reaparece pelo túnel sem atravessar a tela; bocas do túnel acendem em ciano; fantasmas viram e piscam no fim do power-up; nenhum personagem aparece fora do grid.

**Step 6: Commit** — `git commit -am "chore: remove backup e logs por frame; teste de partida completa"`

---

### Task 12: Build da Action, docs e entrega

**Files:**
- Modify: `github-action/dist/index.js` (gerado), `dist/pacman-contribution-graph.min.js` (gerado)
- Modify: `README.md` (tabela de opções: `player_style` na Action, `seed`, túneis)
- Create/Modify: `PROXIMOS_PASSOS.md`

**Step 1:** Run `pnpm run build:action` → gera `github-action/dist/index.js`. Run `pnpm run build:web` → gera o `.min.js`. Se algum build falhar por dependência ausente, registrar no `PROXIMOS_PASSOS.md` e não commitar artefato quebrado.

**Step 2:** README: documentar `player_style` no exemplo YAML (já aparece) e na tabela; mencionar túneis e que a animação é estável durante o dia (semente usuário + data).

**Step 3:** `PROXIMOS_PASSOS.md` com o que foi feito, o que ficou de fora (temas, placar, velocidade, preview, ESLint/CI) e comandos (`pnpm test`, `pnpm run build:action`).

**Step 4: Commit e push**
```bash
git add -A
git commit -m "build: atualiza Action e bundle; docs de jogabilidade"
git push
```

**Step 5:** Abrir PR contra `main` com @superpowers:finishing-a-development-branch.
