/* ───────────────────────── Tipos auxiliares ───────────────────────── */
export type Point2d = { 
  x: number; 
  y: number;
  direction?: 'right' | 'left' | 'up' | 'down';
};

/* ───────────────────────── Contribuições ──────────────────────────── */
export type ContributionLevel =
  | 'NONE'
  | 'FIRST_QUARTILE'
  | 'SECOND_QUARTILE'
  | 'THIRD_QUARTILE'
  | 'FOURTH_QUARTILE';

  export enum PlayerStyle {
    CONSERVATIVE = 'conservador',
    AGGRESSIVE = 'agressivo',
    OPPORTUNISTIC = 'oportunista'
  }

export interface Contribution {
  date: Date;
  count: number;
  color: string;              // cor hex que o GitHub devolve (tema claro)
  level: ContributionLevel;   // bucket calculado pelo GitHub
}

/* ───────────────────────── Pac‑Man & Fantasmas ────────────────────── */
export interface Pacman {
  x: number;
  y: number;
  direction: 'right' | 'left' | 'up' | 'down';
  points: number;
  totalPoints: number;
  deadRemainingDuration: number;
  powerupRemainingDuration: number;
  visitedAt: Record<string, number>;
  target?: Point2d;
}

export type GhostName = 'blinky' | 'clyde' | 'inky' | 'pinky' | 'eyes';

export interface Ghost {
  x: number;
  y: number;
  name: GhostName;
  originalName?: GhostName;
  scared: boolean;
  direction: 'right' | 'left' | 'up' | 'down';
  target?: Point2d;
  inHouse?: boolean;
  isRespawning?: boolean;
  respawnCounter?: number;
  immunityFrames?: number;
  justReleasedFromHouse?: boolean;
  confusionFrames?: number;
  flashing?: boolean;   // power-up acabando
  moveTick?: number;    // contador para andar mais devagar
}

/* ───────────────────────── Grid & Store ───────────────────────────── */
export interface GridCell {
  commitsCount: number;
  color: string;              // cor já pronta para render
  level: ContributionLevel;
}

export interface GameStatistics {
  totalPoints: number;
  ghostsEaten: number;
  deaths: number;
  powerUpsCollected: number;
  highestGhostCombo: number;
  efficiencyMultiplier: number;
  timeBonus: number;
  lastPoints?: number;
  pointsFromContributions?: number;
  pointsFromGhosts?: number;
  pointsFromPowerUps?: number;
}

export interface GameState {
  frame: number;                 // frames desde o início da rodada (libera fantasmas)
  combo: number;                 // fantasmas comidos no power-up atual
  mode: 'scatter' | 'chase';
  modeTimer: number;
}

export interface StoreType {
	frameCount: number;
	contributions: Contribution[];
	pacman: Pacman;
	ghosts: Ghost[];
	grid: GridCell[][];         // [week][day]
	monthLabels: string[];
	pacmanMouthOpen: boolean;
	gameInterval: number;
	gameHistory: {
	  pacman: Pacman;
	  ghosts: Ghost[];
	  grid: GridCell[][];
	}[];
	config: Config;
	useGithubThemeColor: boolean;
  moveCounter?: number;
  deathCount?: number;
  statistics?: GameStatistics;
  rng: () => number;
  game: GameState;
}  

/* ───────────────────────── Configuração ───────────────────────────── */
export interface Config {
  platform: 'github';
  username: string;
  canvas: HTMLCanvasElement;
  outputFormat: 'canvas' | 'svg';
  svgCallback: (blobUrl: string) => void;
  gameOverCallback: () => void;
  gameTheme: ThemeKeys;
  gameSpeed: number;
  enableSounds: boolean;
  githubSettings?: {
    accessToken: string;      // necessário para GraphQL
  };
  playerStyle?: PlayerStyle;
  joinRanking?: boolean;
  seed?: string;     // sobrepõe a semente padrão (usuário + dia)
  debug?: boolean;   // liga logs de diagnóstico
}

/* ───────────────────────── Temas ──────────────────────────────────── */
export type ThemeKeys = 'github' | 'github-dark' | 'brasa';

export interface GameTheme {
  textColor: string;
  gridBackground: string;
  wallColor: string;
  intensityColors: string[];  // 5 cores (NONE … FOURTH)
  tunnelColor: string;        // boca do túnel em repouso
  tunnelActiveColor: string;  // boca do túnel com o Pac-Man perto
}

/* ───────────────────────── SVG Animation helper ──────────────────── */
export interface AnimationData {
  keyTimes: string;
  values: string;
}