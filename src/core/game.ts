import { SVG } from '../renderers/svg.js';
import {
  DELTA_TIME,
  PACMAN_DEATH_DURATION,
  PACMAN_POWERUP_DURATION,
  POWERUP_FLASH_FRAMES
} from './constants.js';
import { GhostsMovement } from '../movement/ghosts-movement.js';
import { PacmanMovement } from '../movement/pacman-movement.js';
import { MovementUtils } from '../movement/movement-utils.js';
import { Utils } from '../utils/utils.js';
import { registerPacmanDeath } from '../core/store.js';
import { StoreType, GhostName, ContributionLevel, PlayerStyle, Point2d, Ghost } from '../types.js';

// Constantes de pontuação
const POINTS_MAP: Record<ContributionLevel, number> = {
  'NONE': 0,
  'FIRST_QUARTILE': 10,
  'SECOND_QUARTILE': 20,
  'THIRD_QUARTILE': 30,
  'FOURTH_QUARTILE': 40,
};

/** Limite de segurança do loop do SVG (~20 min de animação). */
const MAX_FRAMES = 6000;
/** Teto do multiplicador de eficiência (1 + fantasmas/mortes), para a pontuação não explodir. */
const MAX_EFFICIENCY_MULTIPLIER = 3;
const GHOST_BASE_POINTS = 200;
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
    visitedAt: {}
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
    while (remainingCells() && store.frameCount < MAX_FRAMES) updateGame(store);
    if (remainingCells()) {
      // Salvaguarda: nunca gerar uma animação infinita; encerra limpando o que sobrou.
      console.warn(`Partida interrompida em ${MAX_FRAMES} frames; células restantes foram limpas.`);
      const empty = Utils.getCurrentTheme(store).intensityColors[0];
      store.grid.forEach(col => col.forEach(c => { c.commitsCount = 0; c.level = 'NONE'; c.color = empty; }));
    }
    updateGame(store); // snapshot final + callbacks
  } else {
    clearInterval(store.gameInterval as number);
    store.gameInterval = setInterval(() => updateGame(store), DELTA_TIME) as unknown as number;
  }
};

/* ---------- utilidades ---------- */

const resetPacman = (store: StoreType) => {
  store.pacman.x = 26;
  store.pacman.y = 5;
  store.pacman.target = undefined;
  store.pacman.direction = 'right';
  store.pacman.visitedAt = {};
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

const collideWith = (store: StoreType, ghost: Ghost) => {
  if (store.pacman.powerupRemainingDuration && ghost.scared) {
    // Calcular pontos por fantasma com base na sequência
    store.game.combo++;
    
    if (store.statistics) {
      store.statistics.ghostsEaten++;
    }
    
    // Pontuação que dobra a cada fantasma comido em sequência
    const ghostPoints = GHOST_BASE_POINTS * Math.pow(2, Math.min(store.game.combo, 4) - 1); // 200, 400, 800 e depois 1600 fixo
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
    ghost.flashing = false;
    ghost.target = { x: 26, y: 3 };
  } else {
    // Penalidade por morte
    store.pacman.points = 0;
    store.pacman.powerupRemainingDuration = 0;
    store.ghosts.forEach(g => { g.scared = false; g.flashing = false; });
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
};

const checkCollisions = (store: StoreType) => {
  if (store.pacman.deadRemainingDuration) return;

  store.ghosts.forEach(ghost => {
    // Olhos e fantasmas na casa não colidem
    if (ghost.name === 'eyes' || ghost.inHouse) return;
    if (ghost.x === store.pacman.x && ghost.y === store.pacman.y) collideWith(store, ghost);
  });
};

const checkSwapCollisions = (store: StoreType, pacPrev: Point2d, ghostsPrev: Point2d[]) => {
  if (store.pacman.deadRemainingDuration) return;
  store.ghosts.forEach((g, i) => {
    const gp = ghostsPrev[i];
    if (!gp || g.name === 'eyes' || g.inHouse) return;
    const swapped = gp.x === store.pacman.x && gp.y === store.pacman.y && g.x === pacPrev.x && g.y === pacPrev.y;
    if (swapped) collideWith(store, g);
  });
};

/* ---------- comer ---------- */

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
    if (!g.scared) g.direction = MovementUtils.opposite(g.direction);
    g.scared = true;
    g.flashing = false;
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
      pushSnapshot(store); // quadro do renascimento: todos parados na posição inicial
      return;
    }
  }

  if (store.pacman.powerupRemainingDuration > 0) {
    store.pacman.powerupRemainingDuration--;
    const left = store.pacman.powerupRemainingDuration;
    store.ghosts.forEach(g => { if (g.scared) g.flashing = left > 0 && left <= POWERUP_FLASH_FRAMES; });
    if (left === 0) {
      store.ghosts.forEach(g => { g.scared = false; g.flashing = false; });
      store.game.combo = 0;
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
        ghost.scared = false;
        ghost.flashing = false;
        ghost.justReleasedFromHouse = true;
        ghost.confusionFrames = 30;
      }
    }
  });

  /* -------- fim de jogo -------- */
  const remaining = store.grid.some(row => row.some(c => c.commitsCount > 0));
  if (!remaining && store.statistics) { // Verifica se statistics existe
    // Calcular Bônus de Tempo
    const actualFrames = store.frameCount;
    const timeBonus = Math.max(0, 10000 - (actualFrames * 10));
    store.statistics.timeBonus = timeBonus;

    // Calcular Multiplicador de Eficiência
    const ghostsEaten = store.statistics.ghostsEaten;
    const deaths = Math.max(1, store.statistics.deaths);
    const efficiencyMultiplier = Math.min(MAX_EFFICIENCY_MULTIPLIER, parseFloat((1 + (ghostsEaten / deaths)).toFixed(2)));
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
  const pacPrev = { x: store.pacman.x, y: store.pacman.y };
  PacmanMovement.movePacman(store);
  eatCell(store);

  checkCollisions(store);

  const ghostsPrev = store.ghosts.map(g => ({ x: g.x, y: g.y }));
  if (store.pacman.deadRemainingDuration === 0) {
    GhostsMovement.moveGhosts(store);
    checkCollisions(store);
  }
  checkSwapCollisions(store, pacPrev, ghostsPrev);

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

export const Game = { startGame, stopGame, initRound, step: updateGame, eatCell, checkCollisions, checkSwapCollisions };