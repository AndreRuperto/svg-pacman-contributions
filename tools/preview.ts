/**
 * Preview local do SVG.
 *   pnpm preview                                  → mapa sorteado, oportunista, github-dark
 *   pnpm preview --style agressivo --theme brasa --seed abc
 *   GITHUB_TOKEN=... pnpm preview --user <login>  → contribuições reais
 * Grava em outputs/preview-<estilo>-<tema>.svg e abre no navegador (use --no-open para não abrir).
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';
import { PacmanRenderer } from '../src/index.js';
import { Game } from '../src/core/game.js';
import { Store } from '../src/core/store.js';
import { Grid } from '../src/utils/grid.js';
import { Utils } from '../src/utils/utils.js';
import { createRng } from '../src/utils/rng.js';
import { PlayerStyle, type Config, type Contribution, type ContributionLevel, type StoreType, type ThemeKeys } from '../src/types.js';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const style = (arg('style') ?? 'oportunista') as PlayerStyle;
const theme = (arg('theme') ?? 'github-dark') as ThemeKeys;
const seed = arg('seed') ?? 'preview';
const user = arg('user');
const speed = arg('speed');

if (!Object.values(PlayerStyle).includes(style)) {
  console.error(`Estilo inválido: ${style}. Use: ${Object.values(PlayerStyle).join(', ')}`);
  process.exit(1);
}

/** Um ano de contribuições sorteadas (reproduzível pela semente). */
const fakeContributions = (s: string): Contribution[] => {
  const rng = createRng(`mapa:${s}`);
  const levels: ContributionLevel[] = ['NONE', 'NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
  const out: Contribution[] = [];
  const today = new Date();
  for (let d = 0; d < 365; d++) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - d));
    const r = rng();
    const level = r < 0.55 ? 'NONE' : r < 0.95 ? levels[2 + Math.floor(rng() * 3)] : levels[5];
    out.push({ date, count: level === 'NONE' ? 0 : 1 + Math.floor(rng() * 10), color: '', level });
  }
  return out;
};

const run = (): Promise<string> => new Promise((done, fail) => {
  let svg = '';
  const config: Partial<Config> = {
    platform: 'github', username: user ?? 'preview', outputFormat: 'svg', gameTheme: theme,
    playerStyle: style, seed, ...(speed ? { animationSpeed: Number(speed) } : {}),
    svgCallback: (s: string) => { svg = s; },
    gameOverCallback: () => done(svg)
  };
  if (user) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return fail(new Error('Defina GITHUB_TOKEN para usar --user.'));
    new PacmanRenderer({ ...config, githubSettings: { accessToken: token } } as Config).start().catch(fail);
    return;
  }
  const store: StoreType = JSON.parse(JSON.stringify(Store));
  store.config = { canvas: undefined as unknown as HTMLCanvasElement, gameSpeed: 1, enableSounds: false, ...config } as Config;
  store.rng = createRng(seed);
  store.contributions = fakeContributions(seed);
  Grid.buildWalls();
  Utils.buildGrid(store);
  Utils.buildMonthLabels(store);
  Game.startGame(store).catch(fail);
});

run().then(svg => {
  mkdirSync('outputs', { recursive: true });
  const file = resolve(`outputs/preview-${style}-${theme}.svg`);
  writeFileSync(file, svg);
  console.log(`SVG gerado: ${file}`);
  if (!process.argv.includes('--no-open')) {
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]]
      : process.platform === 'darwin' ? ['open', [file]] : ['xdg-open', [file]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  }
}).catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
