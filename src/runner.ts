import { createRequire } from 'module';
import { Game } from './core/game.js';
import { Store } from './core/store.js';
import { Grid } from './utils/grid.js';
import { Utils } from './utils/utils.js';
import { createRng, defaultSeed } from './utils/rng.js';
import type { Config, Contribution, PlayerStyle, StoreType, ThemeKeys } from './types.js';

/**
 * Versão do motor, lida do package.json. Procura `../package.json` (rodando de `src/`
 * via tsx) e `../../package.json` (compilado em `dist/src/`).
 */
const readEngineVersion = (): string => {
  const require = createRequire(import.meta.url);
  for (const path of ['../package.json', '../../package.json']) {
    try {
      const pkg = require(path) as { name?: string; version?: string };
      if (pkg.name === 'svg-pacman-contributions' && pkg.version) return pkg.version;
    } catch {
      // tenta o próximo caminho
    }
  }
  return '0.0.0';
};

export const ENGINE_VERSION = readEngineVersion();

/** Números de uma partida (um jogador, um dia). Os nomes seguem as colunas do site. */
export interface Partida {
  login: string;
  /** AAAA-MM-DD (UTC). */
  data: string;
  pontos: number;
  fantasmas: number;
  mortes: number;
  maior_combo: number;
  quadros: number;
  /** Células com contribuição na janela do dia. */
  celulas: number;
  /** pontos / celulas. */
  eficiencia: number;
  interrompida: boolean;
  versao_motor: string;
  /** Só quando `withSvg` for verdadeiro. */
  svg?: string;
}

export interface PlayDayOptions {
  login: string;
  /** AAAA-MM-DD (UTC). */
  date: string;
  contributions: Contribution[];
  theme?: ThemeKeys;
  style?: PlayerStyle;
  withSvg?: boolean;
}

/** Joga a partida de um dia sem rede. Sem contribuições na janela, devolve `null`. */
export async function playDay(opts: PlayDayOptions): Promise<Partida | null> {
  const { login, date, contributions, theme, style, withSvg } = opts;
  let svg = '';
  let resolveOver!: () => void;
  const over = new Promise<void>((resolve) => { resolveOver = resolve; });

  const config: Config = {
    platform: 'github',
    username: login,
    date,
    canvas: undefined as unknown as HTMLCanvasElement,
    outputFormat: 'svg',
    svgCallback: (s: string) => { svg = s; },
    gameOverCallback: () => resolveOver(),
    gameTheme: theme ?? 'github-dark',
    gameSpeed: 1,
    enableSounds: false,
    playerStyle: style
  };

  const store: StoreType = JSON.parse(JSON.stringify(Store));
  store.config = config;
  store.rng = createRng(defaultSeed(login, new Date(`${date}T00:00:00Z`)));
  store.contributions = contributions;

  Grid.buildWalls();
  Utils.buildGrid(store);
  Utils.buildMonthLabels(store);

  const celulas = store.grid.flat().filter((c) => c.level !== 'NONE').length;
  if (celulas === 0) return null;

  await Game.startGame(store);
  await over;

  const stats = store.statistics!;
  const partida: Partida = {
    login,
    data: date,
    pontos: stats.totalPoints,
    fantasmas: stats.ghostsEaten,
    mortes: stats.deaths,
    maior_combo: stats.highestGhostCombo,
    quadros: store.gameHistory.length,
    celulas,
    eficiencia: stats.totalPoints / celulas,
    interrompida: !!stats.interrupted,
    versao_motor: ENGINE_VERSION
  };
  if (withSvg) partida.svg = svg;
  return partida;
}
