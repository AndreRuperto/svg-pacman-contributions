import { SVG } from '../renderers/svg.js';
import {
  DELTA_TIME,
  GHOST_NAMES,
  GRID_HEIGHT,
  GRID_WIDTH,
  PACMAN_DEATH_DURATION
} from './constants.js';
import { GhostsMovement } from '../movement/ghosts-movement.js';
import { PacmanMovement } from '../movement/pacman-movement.js';
import { Utils } from '../utils/utils.js';
import { registerPacmanDeath } from '../core/store.js';
import { StoreType, GhostName, ContributionLevel, PlayerStyle } from '../types.js';

// Constantes de pontuação
const POINTS_MAP: Record<ContributionLevel, number> = {
  'NONE': 0,
  'FIRST_QUARTILE': 10,
  'SECOND_QUARTILE': 20,
  'THIRD_QUARTILE': 30,
  'FOURTH_QUARTILE': 40,
};

const GHOST_BASE_POINTS = 100;
const BASE_DEATH_PENALTY = 200;

/* ---------- helpers de posicionamento ---------- */

const placePacman = (store: StoreType) => {
  store.pacman = {
    x: 0,
    y: 0,
    direction: 'right',
    points: 0,
    totalPoints: 0,
    deadRemainingDuration: 0,
    powerupRemainingDuration: 0,
    recentPositions: []
  };
};

const placeGhosts = (store: StoreType) => {
  store.ghosts = [
      { x: 26, y: 2, name: 'blinky', direction: 'left', scared: false, target: undefined, inHouse: false},
      { x: 25, y: 3, name: 'inky',   direction: 'up',   scared: false, target: undefined, inHouse: true},
      { x: 26, y: 3, name: 'pinky',  direction: 'down', scared: false, target: undefined, inHouse: true},
      { x: 27, y: 3, name: 'clyde',  direction: 'up',   scared: false, target: undefined, inHouse: true}
  ];

  // reset extras
  store.ghosts.forEach(g => {
      g.confusionFrames       = 0;
      g.justReleasedFromHouse = false;
      g.respawnCounter        = 0;
      g.isRespawning          = false;
      
      // Configurar direções diferentes para criar um efeito de movimento assíncrono
      if (g.inHouse) {
          // Distribuir as direções iniciais para não ficarem todos sincronizados
          if (g.name === 'inky') g.direction = 'up';
          else if (g.name === 'pinky') g.direction = 'down';
          else if (g.name === 'clyde') g.direction = 'up';
      }
  });
};

/* ---------- ciclo principal ---------- */

const stopGame = async (store: StoreType) => {
  clearInterval(store.gameInterval as number);
};

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

const startGame = async (store: StoreType) => {
  store.grid = Utils.createGridFromData(store);
  initRound(store);
  const remainingCells = () => store.grid.some(row => row.some(cell => cell.commitsCount > 0));
  if (store.config.outputFormat === 'svg') {
    while (remainingCells()) updateGame(store);
    updateGame(store); // snapshot final + callbacks
  } else {
    clearInterval(store.gameInterval as number);
    store.gameInterval = setInterval(() => updateGame(store), DELTA_TIME) as unknown as number;
  }
};

/* ---------- utilidades ---------- */

const resetPacman = (store: StoreType) => {
  store.pacman.x = 27;
  store.pacman.y = 7;
  store.pacman.direction = 'right';
  store.pacman.recentPositions = [];
};

export const determineGhostName = (index: number): GhostName => {
  const names: GhostName[] = ['blinky', 'inky', 'pinky', 'clyde'];
  return names[index % names.length];
};

/* ---------- snapshot helper ---------- */
const pushSnapshot = (store: StoreType) => {
  store.gameHistory.push({
    pacman: { ...store.pacman },
    ghosts: store.ghosts.map(g => ({ ...g })),
    grid: store.grid.map(row => row.map(col => ({ ...col })))
  });
};

/* ---------- colisões & house ---------- */

const checkCollisions = (store: StoreType) => {
  if (store.pacman.deadRemainingDuration) return;

  store.ghosts.forEach(ghost => {
    // Se o fantasma for olhos, não deve haver colisão
    if (ghost.name === 'eyes') return;
    
    if (ghost.x === store.pacman.x && ghost.y === store.pacman.y) {
      if (store.pacman.powerupRemainingDuration && ghost.scared) {
        // Calcular pontos por fantasma com base na sequência
        store.game.combo++;
        
        if (store.statistics) {
          store.statistics.ghostsEaten++;
        }
        
        // Pontuação que dobra a cada fantasma comido em sequência
        const ghostPoints = GHOST_BASE_POINTS * Math.pow(2, store.game.combo - 1);
        store.pacman.points += ghostPoints;
        store.pacman.totalPoints += ghostPoints;
        
        if (store.statistics) {
          store.statistics.totalPoints += ghostPoints;
          store.statistics.pointsFromGhosts = (store.statistics.pointsFromGhosts || 0) + ghostPoints;
          
          // Atualizar recorde de combo
          store.statistics.highestGhostCombo = Math.max(
            store.statistics.highestGhostCombo || 0, 
            store.game.combo
          );
        }
        
        ghost.originalName = ghost.name;
        ghost.name = 'eyes';
        ghost.scared = false;
        ghost.target = { x: 26, y: 3 };
      } else {
        // Penalidade por morte
        store.pacman.points = 0;
        store.pacman.powerupRemainingDuration = 0;
        store.game.combo = 0; // Resetar combo ao morrer
        
        if (store.pacman.deadRemainingDuration === 0) {
          store.pacman.deadRemainingDuration = PACMAN_DEATH_DURATION;
          registerPacmanDeath(store);
          
          // Obter o estilo diretamente da config
          const style = store.config.playerStyle || PlayerStyle.OPPORTUNISTIC;
          
          // Determinar a penalidade com base no estilo
          let penalty = BASE_DEATH_PENALTY; // Valor padrão
          switch (style) {
            case PlayerStyle.CONSERVATIVE:
              penalty = 150;
              break;
            case PlayerStyle.AGGRESSIVE:
              penalty = 250;
              break;
            case PlayerStyle.OPPORTUNISTIC:
            default:
              penalty = 200;
              break;
          }
          
          store.pacman.totalPoints = Math.max(0, store.pacman.totalPoints - penalty);
          
          if (store.statistics) {
            store.statistics.deaths = (store.statistics.deaths || 0) + 1;
            store.statistics.totalPoints = Math.max(0, store.statistics.totalPoints - penalty);
          }
        }
      }
    }
  });
};

/* ---------- update por frame ---------- */

const updateGame = (store: StoreType) => {
  store.frameCount++;

  /* ---- FRAME-SKIP restaurado ---- */
  if (store.frameCount % store.config.gameSpeed !== 0) {
    pushSnapshot(store);
    return;
  }

  const f = store.game.frame;
  if (f === 10) releaseGhostFromHouse(store, 'pinky');
  if (f === 20) releaseGhostFromHouse(store, 'inky');
  if (f === 30) releaseGhostFromHouse(store, 'clyde');
  store.game.frame++;

  /* -------- timers pacman -------- */
  if (store.pacman.deadRemainingDuration > 0) {
    store.pacman.deadRemainingDuration--;
    if (store.pacman.deadRemainingDuration === 0) {
      resetPacman(store);
      placeGhosts(store);
      store.game.frame = 0;
    }
  }

  if (store.pacman.powerupRemainingDuration > 0) {
    store.pacman.powerupRemainingDuration--;
    if (store.pacman.powerupRemainingDuration === 0) {
      store.ghosts.forEach(g => { if (g.name !== 'eyes') g.scared = false; });
      store.game.combo = 0; // Resetar contador quando o power-up acabar
    }
  }

  /* -- respawn fantasmas (sem mudanças) -- */
  store.ghosts.forEach(ghost => {
    if (ghost.inHouse && ghost.respawnCounter && ghost.respawnCounter > 0) {
      ghost.respawnCounter--;
      if (ghost.respawnCounter === 0) {
        ghost.name = ghost.originalName || determineGhostName(store.ghosts.indexOf(ghost));
        ghost.inHouse = false;
        ghost.isRespawning = false;
        ghost.scared = store.pacman.powerupRemainingDuration > 0;
        ghost.justReleasedFromHouse = true;
        ghost.confusionFrames = 30;
      }
    }
  });

  /* -------- fim de jogo -------- */
  const remaining = store.grid.some(row => row.some(c => c.commitsCount > 0));
  if (!remaining && store.statistics) { // Verifica se statistics existe
    // Calcular Bônus de Tempo
    const idealFrames = store.contributions.length * 2;
    const actualFrames = store.frameCount;
    const timeBonus = Math.max(0, 10000 - (actualFrames * 10));
    store.statistics.timeBonus = timeBonus;

    // Calcular Multiplicador de Eficiência
    const ghostsEaten = store.statistics.ghostsEaten;
    const deaths = Math.max(1, store.statistics.deaths);
    const efficiencyMultiplier = parseFloat((1 + (ghostsEaten / deaths)).toFixed(2));
    store.statistics.efficiencyMultiplier = efficiencyMultiplier;

    // Aplicar bônus e multiplicador à pontuação final em statistics
    const pointsBeforeBonus = store.statistics.totalPoints;
    let finalPoints = pointsBeforeBonus;
    finalPoints += store.statistics.timeBonus;
    finalPoints = Math.round(finalPoints * store.statistics.efficiencyMultiplier);
    
    // Garantir que a pontuação final seja pelo menos 0 (não negativa)
    finalPoints = Math.max(0, finalPoints);

    store.statistics.totalPoints = finalPoints;
    store.pacman.totalPoints = finalPoints;

    // Chamar callbacks
    if (store.config.outputFormat === 'svg') {
      const svgContent = SVG.generateAnimatedSVG(store);
      store.config.svgCallback(svgContent);
    }
    store.config.gameOverCallback();
    return; // Fim do jogo
  }

  /* -------- movimentos -------- */
  PacmanMovement.movePacman(store);

  const cell = store.grid[store.pacman.x]?.[store.pacman.y];
  if (cell && cell.commitsCount > 0) {
    // Calcular pontos com base no nível da célula
    const cellPoints = POINTS_MAP[cell.level as ContributionLevel] || 0;
    
    // Atualizar pontuação do Pac-Man
    store.pacman.points += cellPoints;
    store.pacman.totalPoints += cellPoints;
    
    // Atualizar estatísticas
    if (store.statistics) {
      store.statistics.totalPoints += cellPoints;
      store.statistics.pointsFromContributions = (store.statistics.pointsFromContributions || 0) + cellPoints;
    }

    // Se for power-up (FOURTH_QUARTILE)
    if (cell.level === 'FOURTH_QUARTILE' && store.pacman.powerupRemainingDuration === 0) {
      if (store.statistics) {
        store.statistics.powerUpsCollected++;
      }
      store.pacman.powerupRemainingDuration = 30;
      store.ghosts.forEach(g => { if (g.name !== 'eyes') g.scared = true; });
      store.game.combo = 0; // Resetar contador ao iniciar power-up
    }

    // Zerar a célula (sempre)
    cell.commitsCount = 0;
    cell.level = 'NONE';
    cell.color = Utils.getCurrentTheme(store).intensityColors[0];
  }

  checkCollisions(store);

  if (store.pacman.deadRemainingDuration === 0) {
    GhostsMovement.moveGhosts(store);
    checkCollisions(store);
  }

  store.pacmanMouthOpen = !store.pacmanMouthOpen;

  /* ---- único snapshot por frame ---- */
  pushSnapshot(store);
};

const releaseGhostFromHouse = (store: StoreType, name: GhostName) => {
  const ghost = store.ghosts.find(g => g.name === name && g.inHouse);
  if (ghost) {
    ghost.justReleasedFromHouse = true;
    ghost.y = 2;
    ghost.direction = 'up';
    ghost.justReleasedFromHouse = true;
    ghost.confusionFrames = 30;
  }
};

export const Game = { startGame, stopGame, initRound, step: updateGame };