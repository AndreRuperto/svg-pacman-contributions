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
  /** A partida bateu o limite de quadros e as células restantes foram limpas. */
  interrupted?: boolean;
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
export type AnimationSpeed = 'slow' | 'normal' | 'fast' | number;

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
  seed?: string;
  /** Velocidade da animação: 'slow' (½×), 'normal' (1×), 'fast' (2×) ou um multiplicador > 0. */
  animationSpeed?: AnimationSpeed;     // sobrepõe a semente padrão (usuário + dia)
  debug?: boolean;   // liga logs de diagnóstico
  /** Dia a jogar (AAAA-MM-DD, UTC); padrão = hoje. Define a janela do gráfico e a semente padrão. */
  date?: string;
}

/* ───────────────────────── Temas ──────────────────────────────────── */
export type ThemeKeys =
  | 'github' | 'github-dark' | 'brasa'
  | 'arcade' | 'neon' | 'alto-contraste' | 'gitlab' | 'gitlab-dark';

export interface GameTheme {
  textColor: string;
  gridBackground: string;
  wallColor: string;
  intensityColors: string[];  // 5 cores (NONE … FOURTH)
  /** Valores do placar. */
  textStrong: string;
  pacmanColor: string;
  /** Contorno do Pac-Man (temas claros); vazio = sem contorno. */
  pacmanStroke?: string;
  pacmanPowerupColor: string;
  /** Cor do fantasma assustado piscando no fim do power-up. */
  flashColor: string;
  /** Contorno de 1 px no fantasma assustado, no piscando e nos olhos, onde eles sumiriam no tema. */
  spriteOutline?: string;
  /** Corpo de cada fantasma: perseguidor (blinky), emboscada (pinky), imprevisível (inky), tímido (clyde). */
  ghostColors: [string, string, string, string];
  /** Contorno dos fantasmas normais (temas claros). */
  ghostOutline?: string;
  scaredColor: string;
  /** Olhos e boca do fantasma assustado. */
  scaredFace: string;
  /** Olhos e boca do fantasma piscando. */
  flashFace: string;
  tunnelColor: string;        // boca do túnel em repouso
  tunnelActiveColor: string;  // boca do túnel com o Pac-Man perto
}

/* ───────────────────────── SVG Animation helper ──────────────────── */
export interface AnimationData {
  keyTimes: string;
  values: string;
}