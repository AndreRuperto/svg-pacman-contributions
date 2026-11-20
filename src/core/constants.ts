import { GameTheme, GhostName, ThemeKeys } from '../types.js';

/* ───────────── Configurações gerais ───────────── */
export const CELL_SIZE  = 20;
export const GAP_SIZE   = 2;
export const GRID_WIDTH = 53;   // 52  semanas + semana corrente
export const GRID_HEIGHT = 7;   // dom … sáb

export const TUNNEL_ROW = 3;
/** Células de "boca" do túnel (fantasmas andam mais devagar aqui). */
export const isTunnelCell = (x: number, y: number) =>
  y === TUNNEL_ROW && (x <= 1 || x >= GRID_WIDTH - 2);

export const GHOST_HOUSE_COLOR = 'yellow';

export const PACMAN_COLOR          = 'yellow';
export const PACMAN_COLOR_POWERUP  = 'red';
export const PACMAN_COLOR_DEAD     = '#80808064';

export const GHOST_NAMES: GhostName[] = ['blinky', 'clyde', 'inky', 'pinky', 'eyes'];

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const DELTA_TIME              = 200;
export const PACMAN_DEATH_DURATION   = 10;
export const PACMAN_POWERUP_DURATION = 30;
export const POWERUP_FLASH_FRAMES    = 6;

/* ───────────── Paletas GitHub oficiais ─────────────
   Array de 5 cores: índice 0 = NONE … 4 = FOURTH_QUARTILE             */
const GITHUB_LIGHT = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const GITHUB_DARK  = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'/*'#FD0000'*/];
/* Carvão → laranja Brasa, a paleta do portfólio andreruperto.dev */
const BRASA        = ['#1A1614', '#5C2D0F', '#994B19', '#CC6521', '#FF7E29'];

/* Fliperama, neon, alto contraste e GitLab: prancha "SVG Pac-Man · Identidade e sistema de design" */
const ARCADE         = ['#0B0B14', '#14145C', '#22229A', '#3333CC', '#FFB8AE'];
const NEON           = ['#1A0F33', '#3B1D6B', '#6A2BA8', '#A63BD0', '#FF6EC7'];
const ALTO_CONTRASTE = ['#262626', '#003D80', '#0066D6', '#66B2FF', '#FFFFFF'];
const GITLAB_LIGHT   = ['#ececef', '#d2dcff', '#7992f5', '#3f51ae', '#2a2b59'];
const GITLAB_DARK    = ['#28272d', '#2f2a6b', '#4b4fc8', '#7992f5', '#d2dcff'];

/** Padrão dos temas escuros: Pac-Man amarelo sem contorno, poder vermelho, pisca em branco. */
const DARK_CHARACTERS = {
  pacmanColor: '#FFFF00', pacmanPowerupColor: '#FF4D4D', flashColor: '#FFFFFF', tunnelActiveColor: '#00FFFF',
  /* Fantasmas (prancha: A · Lençol): longe do amarelo do Pac-Man, do vermelho do poder e do verde das células */
  ghostColors: ['#B794F6', '#F783AC', '#66D9E8', '#FFA94D'] as [string, string, string, string],
  scaredColor: '#4C6EF5', scaredFace: '#FFE8CC', flashFace: '#4C6EF5'
};
/** Fantasmas dos temas claros: tons mais escuros e contorno. */
const LIGHT_GHOSTS = { scaredColor: '#364FC7', scaredFace: '#FFFFFF', flashFace: '#FFFFFF' };

/* ───────────── Temas do jogo ───────────── */
export const GAME_THEMES: { [key in ThemeKeys]: GameTheme } = {
  /* ---------- GitHub ---------- */
  github: {
    textColor:      '#57606a',
    textStrong:     '#1f2328',
    gridBackground: '#ffffff',
    wallColor:      '#000000',
    intensityColors: GITHUB_LIGHT,
    tunnelColor:       '#8c959f',
    tunnelActiveColor: '#0598BC',
    pacmanColor:       '#F2C200',
    pacmanStroke:      '#1f2328',
    pacmanPowerupColor:'#CF222E',
    flashColor:        '#24292F',
    spriteOutline:     '#1f2328', // olhos brancos somem no fundo branco
    ghostColors:       ['#7048E8', '#D6336C', '#0C8599', '#E8590C'],
    ghostOutline:      '#1f2328',
    ...LIGHT_GHOSTS
  },
  'github-dark': {
    textColor:      '#8b949e',
    textStrong:     '#e6edf3',
    gridBackground: '#0d1117',
    wallColor:      '#ffffff',
    intensityColors: GITHUB_DARK,
    tunnelColor:    '#6e7681',
    ...DARK_CHARACTERS
  },
  /* ---------- Brasa (escuro, em laranja) ---------- */
  brasa: {
    textColor:      '#988881',
    textStrong:     '#FBFAF9',
    gridBackground: '#120F0D',
    wallColor:      '#FBFAF9',
    intensityColors: BRASA,
    tunnelColor:    '#5C4F49',
    ...DARK_CHARACTERS,
    pacmanPowerupColor: '#FF3B5C', // vermelho puxado para o rosa: não some no laranja das células
    ghostColors: ['#B794F6', '#F783AC', '#66D9E8', '#C0EB75'] // sem laranja: as células já são laranja
  },
  /* ---------- Fliperama ---------- */
  arcade: {
    textColor:      '#BDBDBD',
    textStrong:     '#FFFFFF',
    gridBackground: '#000000',
    wallColor:      '#4D4DFF',
    intensityColors: ARCADE,
    tunnelColor:    '#555555',
    ...DARK_CHARACTERS,
    ghostColors: ['#E599F7', '#FF8FAB', '#66D9E8', '#FFA94D'],
    spriteOutline:  '#FFFFFF' // o assustado azul some nas células azuis
  },
  /* ---------- Neon ---------- */
  neon: {
    textColor:      '#B3A3D9',
    textStrong:     '#F5F0FF',
    gridBackground: '#0B0420',
    wallColor:      '#FF2E97',
    intensityColors: NEON,
    tunnelColor:    '#4A3A70',
    ...DARK_CHARACTERS,
    ghostColors: ['#C0EB75', '#66D9E8', '#FFA94D', '#F8F9FA'] // sem roxo e rosa: as células já são
  },
  /* ---------- Alto contraste: rampa de azul por claridade, paredes laranja ---------- */
  'alto-contraste': {
    textColor:      '#FFFFFF',
    textStrong:     '#FFFFFF',
    gridBackground: '#000000',
    wallColor:      '#FF9F1C',
    intensityColors: ALTO_CONTRASTE,
    tunnelColor:    '#8A8A8A',
    ...DARK_CHARACTERS,
    ghostColors: ['#E599F7', '#FF8FAB', '#C0EB75', '#FFA94D'], // sem ciano: as células são azuis
    spriteOutline: '#FFFFFF'
  },
  /* ---------- GitLab ---------- */
  gitlab: {
    textColor:      '#626168',
    textStrong:     '#1F1E24',
    gridBackground: '#ffffff',
    wallColor:      '#1F1E24',
    intensityColors: GITLAB_LIGHT,
    tunnelColor:       '#89888d',
    tunnelActiveColor: '#0598BC',
    pacmanColor:       '#F2C200',
    pacmanStroke:      '#1F1E24',
    pacmanPowerupColor:'#DD2B0E',
    flashColor:        '#1F1E24',
    spriteOutline:     '#1F1E24',
    ghostColors:       ['#C2255C', '#E8590C', '#0C8599', '#2B8A3E'], // sem violeta: as células são roxo-azuladas
    ghostOutline:      '#1F1E24',
    ...LIGHT_GHOSTS
  },
  'gitlab-dark': {
    textColor:      '#a4a3a8',
    textStrong:     '#ececef',
    gridBackground: '#18171d',
    wallColor:      '#ececef',
    intensityColors: GITLAB_DARK,
    tunnelColor:    '#737278',
    ...DARK_CHARACTERS,
    ghostColors: ['#F783AC', '#FFA94D', '#66D9E8', '#C0EB75'] // sem violeta: as células são roxas
  }
};

export const WALLS: {
	horizontal: { active: boolean; id: string; color?: string }[][];
	vertical:   { active: boolean; id: string; color?: string }[][];
  } = {
	horizontal: Array(GRID_WIDTH + 1)
	  .fill(null)
	  .map(() => Array(GRID_HEIGHT + 1).fill({ active: false, id: '' })),
	vertical: Array(GRID_WIDTH + 1)
	  .fill(null)
	  .map(() => Array(GRID_HEIGHT + 1).fill({ active: false, id: '' }))
  };

  export const setWall = (
	x: number, 
	y: number, 
	direction: 'horizontal' | 'vertical', 
	lineId: string,
	color?: string
  ) => {
	if (direction === 'horizontal') {
	  if (x >= 0 && x < WALLS.horizontal.length && y >= 0 && y < WALLS.horizontal[0].length) {
		WALLS.horizontal[x][y] = { active: true, id: lineId, color };
	  }
	} else {
	  if (x >= 0 && x < WALLS.vertical.length && y >= 0 && y < WALLS.vertical[0].length) {
		WALLS.vertical[x][y] = { active: true, id: lineId, color };
	  }
	}
  };
