import {
	CELL_SIZE,
	DELTA_TIME,
	GAP_SIZE,
	GHOSTS,
	GRID_HEIGHT,
	GRID_WIDTH,
	PACMAN_COLOR,
	PACMAN_COLOR_DEAD,
	PACMAN_COLOR_POWERUP,
	TUNNEL_ROW,
	WALLS
} from '../core/constants.js';
import { MovementUtils } from '../movement/movement-utils.js';
import { AnimationData, Config, Ghost, GhostName, StoreType } from '../types.js';
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
	const svgHeight = GRID_HEIGHT * (CELL_SIZE + GAP_SIZE) + 50; // Altura extra para estatísticas
	const frameMs = frameDurationMs(store.config);
	const totalDurationMs = store.gameHistory.length * frameMs;
	const totalDurationSecs = totalDurationMs / 1000;
	const minutes = Math.floor(totalDurationSecs / 60);
	const seconds = Math.round(totalDurationSecs % 60);
	const totalDurationFormatted = `${minutes}m ${seconds}s`;
	
	// Estrutura básica do SVG
	let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
	svg += `<desc>Generated with pacman-contribution-graph on ${new Date()}</desc>`;
	svg += `<metadata>
	  <info>
		<frames>${store.gameHistory.length}</frames>
		<frameRate>${1000 / frameMs}</frameRate>
		<durationMs>${totalDurationMs}</durationMs>
		<generatedOn>${new Date().toISOString()}</generatedOn>
	  </info>
	</metadata>`;
	svg += `<rect width="100%" height="100%" fill="${Utils.getCurrentTheme(store).gridBackground}"/>`;
	
	svg += generateGhostsPredefinition();
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
	const theme = Utils.getCurrentTheme(store);
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
	svg += `<path id="pacman" d="${generatePacManPath(0.55)}" fill="${PACMAN_COLOR}">
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
  
	// Estatísticas e barra de progresso
	const textColor = Utils.getCurrentTheme(store).textColor;
	
	// Estatísticas de jogo
	svg += `
	<g transform="translate(0, ${svgHeight - 15})">
	<text x="10" y="0" font-size="12" fill="${textColor}">
		Pontos: ${store.statistics?.totalPoints || 0}
 | Fantasmas: ${store.statistics?.ghostsEaten || 0} | Mortes: ${store.statistics?.deaths || 0}
	</text>
	<text x="${svgWidth - 10}" y="0" text-anchor="end" font-size="12" fill="${textColor}">
		Duração: ${totalDurationFormatted} (${store.gameHistory.length} frames)
	</text>
	</g>`;
	
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
	return store.gameHistory.map((state) => {
		if (state.pacman.deadRemainingDuration) {
			return PACMAN_COLOR_DEAD;
		} else if (state.pacman.powerupRemainingDuration) {
			return PACMAN_COLOR_POWERUP;
		} else {
			return PACMAN_COLOR;
		}
	});
};

const generateCellColorValues = (store: StoreType, x: number, y: number): string[] => {
	return store.gameHistory.map((state) => state.grid[x][y].color);
};

const generateGhostsPredefinition = () => {
	// console.log("Definindo símbolos dos fantasmas");
    let defs = `<defs>`;
    
    // Para cada fantasma regular
    ['blinky', 'inky', 'pinky', 'clyde'].forEach(ghostName => {
        // Para cada direção
        ['up', 'down', 'left', 'right'].forEach(direction => {
            const ghostObj = GHOSTS[ghostName as GhostName] as Record<string, string>;
            
            if (direction in ghostObj) {
                defs += `
                <symbol id="ghost-${ghostName}-${direction}" viewBox="0 0 ${CELL_SIZE} ${CELL_SIZE}">
                    <image href="${ghostObj[direction]}" width="${CELL_SIZE}" height="${CELL_SIZE}"/>
                </symbol>
                `;
            }
        });
    });
    
    // Adicionar o fantasma assustado
    defs += `
    <symbol id="ghost-scared" viewBox="0 0 ${CELL_SIZE} ${CELL_SIZE}">
        <image href="${(GHOSTS['scared'] as { imgDate: string }).imgDate}" width="${CELL_SIZE}" height="${CELL_SIZE}"/>
    </symbol>`;

    // Fantasma assustado piscando (mesma imagem, toda branca)
    defs += `
    <filter id="flash-white"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>
    <symbol id="ghost-scared-flash" viewBox="0 0 ${CELL_SIZE} ${CELL_SIZE}">
        <image href="${(GHOSTS['scared'] as { imgDate: string }).imgDate}" width="${CELL_SIZE}" height="${CELL_SIZE}" filter="url(#flash-white)"/>
    </symbol>`;
    
    // Adicionar os olhos do fantasma (para cada direção)
    ['up', 'down', 'left', 'right'].forEach(direction => {
        if (GHOSTS['eyes'] && direction in (GHOSTS['eyes'] as Record<string, string>)) {
            const eyesObj = GHOSTS['eyes'] as Record<string, string>;
            defs += `
            <symbol id="ghost-eyes-${direction}" viewBox="0 0 ${CELL_SIZE} ${CELL_SIZE}">
                <image href="${eyesObj[direction]}" width="${CELL_SIZE}" height="${CELL_SIZE}"/>
            </symbol>
            `;
        } else {
            // Fallback caso a direção não esteja definida
            console.warn(`Imagem para eyes-${direction} não encontrada, usando placeholder`);
            defs += `
            <symbol id="ghost-eyes-${direction}" viewBox="0 0 ${CELL_SIZE} ${CELL_SIZE}">
                <circle cx="${CELL_SIZE/2}" cy="${CELL_SIZE/2}" r="${CELL_SIZE/3}" fill="white"/>
            </symbol>
            `;
        }
    });
    
    defs += `</defs>`;
    return defs;
};

const generateChangingValuesAnimation = (store: StoreType, changingValues: string[]): AnimationData => {
	if (store.gameHistory.length !== changingValues.length) {
		throw new Error(`A quantidade de valores (${changingValues.length}) não corresponde ao tamanho do histórico do jogo (${store.gameHistory.length})`);
	}

	const totalFrames = store.gameHistory.length;
	if (totalFrames === 0) {
	    return { keyTimes: "0;1", values: changingValues[0] || '#000;#000' };
	}
	
	let keyTimes: number[] = [];
	let values: string[] = [];
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