import {
	CELL_SIZE,
	DELTA_TIME,
	GAP_SIZE,
	GRID_HEIGHT,
	GRID_WIDTH,
	PACMAN_COLOR_DEAD,
	TUNNEL_ROW,
	WALLS
} from '../core/constants.js';
import { MovementUtils } from '../movement/movement-utils.js';
import { AnimationData, Config, GameTheme, Ghost, GhostName, StoreType } from '../types.js';
import { Utils } from '../utils/utils.js';

const SPEED_PRESETS: Record<string, number> = { slow: 0.5, normal: 1, fast: 2 };

/** Duração de um frame no SVG, já aplicando `config.animationSpeed`. Valor inválido = normal. */
export const frameDurationMs = (config: Pick<Config, 'animationSpeed'>): number => {
	const s = config.animationSpeed;
	const mult = typeof s === 'number' ? s : SPEED_PRESETS[s ?? 'normal'];
	return mult && Number.isFinite(mult) && mult > 0 ? DELTA_TIME / mult : DELTA_TIME;
};

const toPixel = (x: number, y: number) => `${x * (CELL_SIZE + GAP_SIZE)},${y * (CELL_SIZE + GAP_SIZE) + 15}`;
const samePos = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;
/** Salto do túnel: mesma linha, de uma borda à outra (um teleporte qualquer na mesma linha não conta). */
const isWrap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	a.y === b.y && Math.min(a.x, b.x) === 0 && Math.max(a.x, b.x) === GRID_WIDTH - 1;
/** Qualquer outro salto de mais de uma casa (renascimento, saída da casa dos fantasmas). */
const isTeleport = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1;

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
			keyTimes.push(fmt(Math.min(mid + 0.000001, t(i)))); values.push(toPixel(enterX, p.y));
		} else if (i > 0 && isTeleport(points[i - 1], p)) {
			// Renascimento: fica parado e salta no instante do frame, sem deslizar pelo grid.
			const prev = points[i - 1];
			keyTimes.push(fmt(Math.max(t(i - 1), t(i) - 0.000001))); values.push(toPixel(prev.x, prev.y));
		}
		const keep = i === 0 || i === n - 1 || !samePos(p, points[i - 1]) || !samePos(p, points[i + 1]);
		if (keep) { keyTimes.push(fmt(t(i))); values.push(toPixel(p.x, p.y)); }
	}
	return { keyTimes: keyTimes.join(';'), values: values.join(';') };
};

const generateAnimatedSVG = (store: StoreType) => {
	// Dimensões e duração
	const svgWidth = GRID_WIDTH * (CELL_SIZE + GAP_SIZE);
	const theme = Utils.getCurrentTheme(store);
	const svgHeight = PANEL_TOP + PANEL_HEIGHT; // grid + faixa dos meses + placar
	const frameMs = frameDurationMs(store.config);
	const totalDurationMs = store.gameHistory.length * frameMs;
	const totalSecs = Math.round(totalDurationMs / 1000);
	const totalDurationFormatted = `${Math.floor(totalSecs / 60)}m ${String(totalSecs % 60).padStart(2, '0')}s`;
	
	// Estrutura básica do SVG
	let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="pacman-svg-titulo pacman-svg-desc" xmlns="http://www.w3.org/2000/svg">`;
	svg += `<title id="pacman-svg-titulo">Pac-Man nas contribuições do GitHub</title>`;
	svg += `<desc id="pacman-svg-desc">Animação do Pac-Man em um calendário de contribuições, com fantasmas e placar final. O gráfico de contribuições não representa uma partida controlada pelo usuário.</desc>`;
	// SVG embutido como imagem: estilos internos não dependem da página hospedeira.
	// Desativa elementos SMIL quando o sistema pede menos movimento.
	svg += `<style>@media (prefers-reduced-motion: reduce) { animate, animateTransform, animateMotion, set { display: none !important; } }</style>`;
	// Com config.date, a data vem do dia jogado: o SVG de um dia fica estável.
	const day = store.config.date;
	svg += `<desc>Generated with pacman-contribution-graph on ${day ?? new Date()}</desc>`;
	svg += `<metadata>
	  <info>
		<frames>${store.gameHistory.length}</frames>
		<frameRate>${1000 / frameMs}</frameRate>
		<durationMs>${totalDurationMs}</durationMs>
		<generatedOn>${day ? `${day}T00:00:00.000Z` : new Date().toISOString()}</generatedOn>
	  </info>
	</metadata>`;
	svg += `<rect width="100%" height="100%" fill="${Utils.getCurrentTheme(store).gridBackground}"/>`;
	
	svg += generateGhostsPredefinition(theme);
	const arenaHeight = GRID_HEIGHT * (CELL_SIZE + GAP_SIZE);
	svg += `<defs><clipPath id="arena"><rect x="0" y="15" width="${svgWidth}" height="${arenaHeight}"/></clipPath></defs>`;
  
	// Month labels
	let lastMonth = '';
	for (let y = 0; y < GRID_WIDTH; y++) {
	  if (store.monthLabels[y] !== lastMonth) {
		const xPos = y * (CELL_SIZE + GAP_SIZE) + CELL_SIZE / 2;
		svg += `<text x="${xPos}" y="10" text-anchor="middle" font-size="10" fill="${Utils.getCurrentTheme(store).textColor}">${store.monthLabels[y]}</text>`;
		lastMonth = store.monthLabels[y];
	  }
	}
  
	// Grid
	for (let x = 0; x < GRID_WIDTH; x++) {
	  for (let y = 0; y < GRID_HEIGHT; y++) {
		const cellX = x * (CELL_SIZE + GAP_SIZE);
		const cellY = y * (CELL_SIZE + GAP_SIZE) + 15;
		const cellColorAnimation = generateChangingValuesAnimation(store, generateCellColorValues(store, x, y));
		svg += `<rect id="c-${x}-${y}" x="${cellX}" y="${cellY}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="5" fill="${Utils.getCurrentTheme(store).intensityColors[0]}">
		  <animate attributeName="fill" dur="${totalDurationMs}ms" repeatCount="indefinite" 
			values="${cellColorAnimation.values}" 
			keyTimes="${cellColorAnimation.keyTimes}"/>
		</rect>`;
	  }
	}
  
	// Walls
	for (let x = 0; x < GRID_WIDTH; x++) {
	  for (let y = 0; y < GRID_HEIGHT; y++) {
		if (WALLS.horizontal[x][y].active) {
		  const wallColor = WALLS.horizontal[x][y].color || Utils.getCurrentTheme(store).wallColor;
		  svg += `<rect id="wh-${x}-${y}" x="${x * (CELL_SIZE + GAP_SIZE) - GAP_SIZE}" y="${y * (CELL_SIZE + GAP_SIZE) - GAP_SIZE + 15}" width="${CELL_SIZE + GAP_SIZE}" height="${GAP_SIZE}" rx="5" fill="${wallColor}"></rect>`;
		}
		if (WALLS.vertical[x][y].active) {
		  const wallColor = WALLS.vertical[x][y].color || Utils.getCurrentTheme(store).wallColor;
		  svg += `<rect id="wv-${x}-${y}" x="${x * (CELL_SIZE + GAP_SIZE) - GAP_SIZE}" y="${y * (CELL_SIZE + GAP_SIZE) - GAP_SIZE + 15}" width="${GAP_SIZE}" height="${CELL_SIZE + GAP_SIZE}" rx="5" fill="${wallColor}"></rect>`;
		}
	  }
	}

	// Bocas do túnel: acendem quando o Pac-Man está a até 3 passos
	const mouthColors = (mouthX: number) => generateChangingValuesAnimation(store, store.gameHistory.map(s =>
		MovementUtils.gridDistance(s.pacman, { x: mouthX, y: TUNNEL_ROW }) <= 3 ? theme.tunnelActiveColor : theme.tunnelColor));
	const mouthY = TUNNEL_ROW * (CELL_SIZE + GAP_SIZE) + 15;
	for (const [id, mx, rx] of [['tunnel-left', 0, 0], ['tunnel-right', GRID_WIDTH - 1, (GRID_WIDTH - 1) * (CELL_SIZE + GAP_SIZE) + CELL_SIZE - 3]] as const) {
		const a = mouthColors(mx);
		svg += `<rect id="${id}" x="${rx}" y="${mouthY}" width="3" height="${CELL_SIZE}" rx="1.5" fill="${theme.tunnelColor}">
		  <animate attributeName="fill" dur="${totalDurationMs}ms" repeatCount="indefinite" keyTimes="${a.keyTimes}" values="${a.values}"/>
		</rect>`;
	}

	// Personagens ficam recortados na arena (somem pela borda do túnel)
	svg += `<g clip-path="url(#arena)">`;

	// Pacman
	const pacmanColorAnimation = generateChangingValuesAnimation(store, generatePacManColors(store));
	const pacmanPositionAnimation = generatePositionAnimation(store.gameHistory.map(s => s.pacman));
	const pacmanRotationAnimation = generateChangingValuesAnimation(store, generatePacManRotations(store));
	const pacmanStroke = theme.pacmanStroke ? ` stroke="${theme.pacmanStroke}" stroke-width="1.5" stroke-linejoin="round"` : '';
	svg += `<path id="pacman" d="${generatePacManPath(0.55)}" fill="${theme.pacmanColor}"${pacmanStroke}>
	  <animate attributeName="fill" dur="${totalDurationMs}ms" repeatCount="indefinite"
		keyTimes="${pacmanColorAnimation.keyTimes}"
		values="${pacmanColorAnimation.values}"/>
	  <animateTransform attributeName="transform" type="translate" dur="${totalDurationMs}ms" repeatCount="indefinite"
		keyTimes="${pacmanPositionAnimation.keyTimes}"
		values="${pacmanPositionAnimation.values}"
		additive="sum"/>
	  <animateTransform attributeName="transform" type="rotate" dur="${totalDurationMs}ms" repeatCount="indefinite"
		keyTimes="${pacmanRotationAnimation.keyTimes}"
		values="${pacmanRotationAnimation.values}"
		additive="sum"/>
	  <animate attributeName="d" dur="0.5s" repeatCount="indefinite"
		values="${generatePacManPath(0.55)};${generatePacManPath(0.05)};${generatePacManPath(0.55)}"/>
	</path>`;
  
	// Fantasmas
	store.ghosts.forEach((ghost, index) => {
	  const ghostPositionAnimation = generatePositionAnimation(store.gameHistory.map(s => s.ghosts[index] ?? { x: 0, y: 0 }));
	  
	  // Grupo para o fantasma
	  svg += `<g id="ghost${index}" transform="translate(0,0)">
		<animateTransform attributeName="transform" type="translate" 
		  dur="${totalDurationMs}ms" repeatCount="indefinite"
		  keyTimes="${ghostPositionAnimation.keyTimes}"
		  values="${ghostPositionAnimation.values}"
		  additive="replace"/>`;
	  
	  // Mapeie estados e direções
	  const stateChanges = mapGhostStateChanges(store, index);
	  
	  // Crie elementos de uso para cada estado
	  for (const [state, keyframes] of Object.entries(stateChanges)) {
		if (keyframes.length === 0) continue;
		
		const href = `#ghost-${state}`;
		const keyTimes = keyframes.map(kf => kf.time).join(';');
		const values = keyframes.map(kf => kf.visible ? 'visible' : 'hidden').join(';');
		const initialVisibility = keyframes[0].visible ? 'visible' : 'hidden';
		
		svg += `<use href="${href}" width="${CELL_SIZE}" height="${CELL_SIZE}" visibility="${initialVisibility}">
		  <animate attributeName="visibility" 
			dur="${totalDurationMs}ms" repeatCount="indefinite"
			keyTimes="${keyTimes}"
			values="${values}" />
		</use>`;
	  }
	  
	  svg += `</g>`;
	});
	svg += `</g>`; // fim do recorte da arena
  
	svg += generateStatsPanel(store, svgWidth, totalDurationFormatted);
	
	svg += '</svg>';
	return svg;
  };

// Função auxiliar para mapear todas as mudanças de estado dos fantasmas
function mapGhostStateChanges(store: StoreType, ghostIndex: number) {
    // Um mapa de estados para frames onde eles estão visíveis
    // Chave: "nome-direção" ou "scared" ou "eyes-direção"
    // Valor: array de {time: number, visible: boolean}
    const stateChanges: Record<string, {time: number, visible: boolean}[]> = {};
    
    // Inicializar estados possíveis para todos os fantasmas
    const allPossibleStates = [
        'blinky-up', 'blinky-down', 'blinky-left', 'blinky-right',
        'inky-up', 'inky-down', 'inky-left', 'inky-right',
        'pinky-up', 'pinky-down', 'pinky-left', 'pinky-right',
        'clyde-up', 'clyde-down', 'clyde-left', 'clyde-right',
        'eyes-up', 'eyes-down', 'eyes-left', 'eyes-right',
        'scared', 'scared-flash'
    ];

    // Estado visual de um fantasma num frame (piscando alterna entre azul e branco)
    const stateOf = (g: Ghost, frameIndex: number) =>
        g.scared ? (g.flashing && frameIndex % 2 === 1 ? 'scared-flash' : 'scared')
        : g.name === 'eyes' ? `eyes-${g.direction || 'right'}` : `${g.name}-${g.direction || 'right'}`;
    
    // Inicializar todos os estados como ocultos
    allPossibleStates.forEach(state => {
        stateChanges[state] = [{ time: 0, visible: false }];
    });
    
    // Obter o fantasma inicial
    const initialGhost = store.gameHistory[0]?.ghosts[ghostIndex] ?? store.ghosts[ghostIndex];
    if (!initialGhost) return stateChanges;
    
    // Definir o estado inicial corretamente
    const initialState = stateOf(initialGhost, 0);
    
    // Marcar esse estado como visível inicialmente
    stateChanges[initialState] = [{ time: 0, visible: true }];
    
    // Rastrear o último estado
    let lastState = initialState;
    
    // Processar cada frame do histórico do jogo
    store.gameHistory.forEach((state, frameIndex) => {
        // Se o fantasma não existe neste frame, pular
        if (ghostIndex >= state.ghosts.length) return;
        
        const ghost = state.ghosts[ghostIndex];
        const currentTime = frameIndex / (store.gameHistory.length - 1);
        
        // Determinar o estado atual
        const currentState = stateOf(ghost, frameIndex);
        
        // Se o estado mudou
        if (currentState !== lastState) {
            // Ocultar o estado anterior
            stateChanges[lastState].push({ time: currentTime, visible: false });
            
            // Mostrar o novo estado
            if (!stateChanges[currentState]) {
                stateChanges[currentState] = [{ time: 0, visible: false }];
            }
            stateChanges[currentState].push({ time: currentTime, visible: true });
            
            // Atualizar o último estado
            lastState = currentState;
        }
    });
    
    // Garantir que o último estado continue visível até o final
    stateChanges[lastState].push({ time: 1, visible: true });
    
    // Garantir que todos os outros estados fiquem ocultos até o final
    Object.keys(stateChanges).forEach(state => {
        if (state !== lastState && stateChanges[state].length > 0) {
            const lastKeyframe = stateChanges[state][stateChanges[state].length - 1];
            if (lastKeyframe.time < 1) {
                stateChanges[state].push({ time: 1, visible: false });
            }
        }
    });
    
    return stateChanges;
}

const generatePacManPath = (mouthAngle: number) => {
	const radius = CELL_SIZE / 2;
	const startAngle = mouthAngle;
	const endAngle = 2 * Math.PI - mouthAngle;

	return `M ${radius},${radius}
            L ${radius + radius * Math.cos(startAngle)},${radius + radius * Math.sin(startAngle)}
            A ${radius},${radius} 0 1,1 ${radius + radius * Math.cos(endAngle)},${radius + radius * Math.sin(endAngle)}
            Z`;
};

const generatePacManRotations = (store: StoreType): string[] => {
	const pivit = CELL_SIZE / 2;
	return store.gameHistory.map((state) => {
		switch (state.pacman.direction) {
			case 'right':
				return `0 ${pivit} ${pivit}`;
			case 'left':
				return `180 ${pivit} ${pivit}`;
			case 'up':
				return `270 ${pivit} ${pivit}`;
			case 'down':
				return `90 ${pivit} ${pivit}`;
			default:
				return `0 ${pivit} ${pivit}`;
		}
	});
};

const generatePacManColors = (store: StoreType): string[] => {
	const theme = Utils.getCurrentTheme(store);
	return store.gameHistory.map((state) => {
		if (state.pacman.deadRemainingDuration) return PACMAN_COLOR_DEAD;
		if (state.pacman.powerupRemainingDuration) return theme.pacmanPowerupColor;
		return theme.pacmanColor;
	});
};

/* ───────────── Placar (prancha: "3 · Painel de estatísticas") ───────────── */
const MONTHS_BAND = 15;
const PANEL_TOP = MONTHS_BAND + GRID_HEIGHT * (CELL_SIZE + GAP_SIZE) + 8;
const PANEL_HEIGHT = 52;
/** O SVG vai para o README como <img>, que não carrega fontes externas. */
const SYSTEM_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** 84450 → "84.450" (sem depender do ICU do Node). */
export const formatThousands = (n: number): string =>
	String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const escapeXml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const generateStatsPanel = (store: StoreType, svgWidth: number, duration: string): string => {
	const theme = Utils.getCurrentTheme(store);
	const s = store.statistics;
	const items: [string, string][] = [
		['PONTOS', formatThousands(s?.totalPoints ?? 0)],
		['FANTASMAS', String(s?.ghostsEaten ?? 0)],
		['MAIOR COMBO', `×${s?.highestGhostCombo ?? 0}`],
		['MORTES', String(s?.deaths ?? 0)],
		['DURAÇÃO', duration]
	];
	const col = svgWidth / items.length;
	let out = `<g id="placar" font-family="${SYSTEM_MONO}">`;
	out += `<rect x="0" y="${PANEL_TOP}" width="${svgWidth}" height="1" fill="${theme.tunnelColor}"/>`;
	items.forEach(([label, value], i) => {
		const x = Math.round(i * col + 16);
		out += `<text x="${x}" y="${PANEL_TOP + 19}" font-size="12" letter-spacing="0.96" fill="${theme.textColor}">${escapeXml(label)}</text>`;
		out += `<text x="${x}" y="${PANEL_TOP + 46}" font-size="28" font-weight="700" fill="${theme.textStrong}">${escapeXml(value)}</text>`;
	});
	return out + '</g>';
};

const generateCellColorValues = (store: StoreType, x: number, y: number): string[] => {
	return store.gameHistory.map((state) => state.grid[x][y].color);
};

/* ───────────── Fantasmas em vetor (prancha: "4 · Fantasmas", direção A · Lençol) ─────────────
   Desenho próprio numa grade de 20 × 20: cúpula + barra recortada de um jeito por personalidade.
   Direção do olhar = deslocar as pupilas. Cores vêm do tema. */
const r2 = (n: number) => Math.round(n * 100) / 100;
const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
	`M${r2(cx - rx)} ${r2(cy)}a${rx} ${ry} 0 1 0 ${r2(2 * rx)} 0a${rx} ${ry} 0 1 0 ${r2(-2 * rx)} 0Z`;

/** Corpos: perseguidor (pontas), emboscada (ondas), imprevisível (dois cortes), tímido (cauda torta). */
const BODIES = [
	'M3 18.5V9a7 7 0 0 1 14 0v9.5l-2.33-2-2.34 2-2.33-2-2.33 2-2.34-2Z',
	'M3 18.5V9a7 7 0 0 1 14 0v9.5q-1.75-2.5-3.5 0t-3.5 0t-3.5 0t-3.5 0Z',
	'M3 18.5V9a7 7 0 0 1 14 0v9.5h-3.5l-1-2-1 2h-3l-1-2-1 2Z',
	'M3 18.5V9a7 7 0 0 1 14 0v7c-1.5 3.5-4 .5-6.5 1.8S5 19.5 3 18.5Z'
] as const;
const GHOST_ORDER: GhostName[] = ['blinky', 'pinky', 'inky', 'clyde'];
const DIRS: Record<string, [number, number]> = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
const EYE_WHITE = '#FFFFFF';
const PUPIL = '#1F2A6B';

const strokeAttr = (color?: string, width = 0.8) => (color ? ` stroke="${color}" stroke-width="${width}" stroke-linejoin="round"` : '');

const eyesMarkup = (dir: string, outline?: string) => {
	const [dx, dy] = DIRS[dir];
	return `<path d="${ellipsePath(7.3, 9.4, 2.3, 2.7)}${ellipsePath(12.7, 9.4, 2.3, 2.7)}" fill="${EYE_WHITE}"${strokeAttr(outline, 0.7)}/>`
		+ `<path d="${ellipsePath(r2(7.3 + dx * 1.1), r2(9.6 + dy * 1.3), 1.25, 1.25)}${ellipsePath(r2(12.7 + dx * 1.1), r2(9.6 + dy * 1.3), 1.25, 1.25)}" fill="${PUPIL}"/>`;
};

const scaredFaceMarkup = (face: string) =>
	`<path d="${ellipsePath(7.3, 9, 1.1, 1.1)}${ellipsePath(12.7, 9, 1.1, 1.1)}" fill="${face}"/>`
	+ `<path d="M5.5 13.6l1.5-1.1 1.5 1.1 1.5-1.1 1.5 1.1 1.5-1.1 1.5 1.1" fill="none" stroke="${face}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;

const symbolMarkup = (id: string, inner: string) =>
	`<symbol id="${id}" viewBox="0 0 ${CELL_SIZE} ${CELL_SIZE}">${inner}</symbol>`;

const generateGhostsPredefinition = (theme: GameTheme) => {
	let defs = '<defs>';
	GHOST_ORDER.forEach((name, i) => {
		for (const dir of Object.keys(DIRS)) {
			defs += symbolMarkup(`ghost-${name}-${dir}`,
				`<path d="${BODIES[i]}" fill="${theme.ghostColors[i]}"${strokeAttr(theme.ghostOutline)}/>${eyesMarkup(dir)}`);
		}
	});
	defs += symbolMarkup('ghost-scared',
		`<path d="${BODIES[0]}" fill="${theme.scaredColor}"${strokeAttr(theme.spriteOutline)}/>${scaredFaceMarkup(theme.scaredFace)}`);
	// Piscando: sem contorno quando ele teria a mesma cor do corpo
	const flashOutline = theme.spriteOutline && theme.spriteOutline.toUpperCase() !== theme.flashColor.toUpperCase() ? theme.spriteOutline : undefined;
	defs += symbolMarkup('ghost-scared-flash',
		`<path d="${BODIES[0]}" fill="${theme.flashColor}"${strokeAttr(flashOutline)}/>${scaredFaceMarkup(theme.flashFace)}`);
	for (const dir of Object.keys(DIRS)) defs += symbolMarkup(`ghost-eyes-${dir}`, eyesMarkup(dir, theme.spriteOutline));
	return defs + '</defs>';
};

export const GhostArt = { BODIES };


const generateChangingValuesAnimation = (store: StoreType, changingValues: string[]): AnimationData => {
	if (store.gameHistory.length !== changingValues.length) {
		throw new Error(`A quantidade de valores (${changingValues.length}) não corresponde ao tamanho do histórico do jogo (${store.gameHistory.length})`);
	}

	const totalFrames = store.gameHistory.length;
	if (totalFrames === 0) {
	    return { keyTimes: "0;1", values: changingValues[0] || '#000;#000' };
	}
	
	const keyTimes: number[] = [];
	const values: string[] = [];
	let lastValue: string | null = null;
	let lastIndex: number | null = null;

	changingValues.forEach((currentValue, index) => {
		if (currentValue !== lastValue) {
			if (lastValue !== null && lastIndex !== null && index - 1 !== lastIndex) {
				// Add a keyframe right before the value change
				keyTimes.push(Number(((index - 0.000001) / (totalFrames - 1)).toFixed(6)));
				values.push(lastValue);
			}
			// Add the new value keyframe
			keyTimes.push(Number((index / (totalFrames - 1)).toFixed(6)));
			values.push(currentValue);
			lastValue = currentValue;
			lastIndex = index;
		}
	});

	// Ensure the last frame is always included
	if (keyTimes.length === 0 || keyTimes[keyTimes.length - 1] !== 1) {
	    // Se não houver keyframes, adicionar frame inicial e final
	    if (keyTimes.length === 0) {
	        keyTimes.push(0, 1);
	        values.push(changingValues[0] || '#000', changingValues[changingValues.length - 1] || '#000');
	    } else {
    		keyTimes.push(1);
    		values.push(lastValue || changingValues[changingValues.length - 1] || '#000');
    	}
	}

	return {
		keyTimes: keyTimes.join(';'),
		values: values.join(';')
	};
};

export const SVG = {
	generateAnimatedSVG
};