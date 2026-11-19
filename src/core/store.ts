// store.ts
import type { Config, StoreType } from '../types.js';
import { createRng } from '../utils/rng.js';

export const Store: StoreType = {
	frameCount: 0,
	contributions: [],
	pacman: {
		x: 0,
		y: 0,
		direction: 'right',
		points: 0,
		totalPoints: 0,
		deadRemainingDuration: 0,
		powerupRemainingDuration: 0,
		recentPositions: []
	},
	ghosts: [],
	grid: [],
	monthLabels: [],
	pacmanMouthOpen: true,
	gameInterval: 0, // ← corrigido: number, conforme a tipagem de StoreType
	gameHistory: [],
	config: undefined as unknown as Config,
	useGithubThemeColor: true, // ← nova flag para usar cor real da API
	rng: createRng('padrao'), // substituído em start() pela semente do usuário
	game: { frame: 0, combo: 0, mode: 'scatter', modeTimer: 0 }
};

export function registerPacmanDeath(store: StoreType) {
	store.deathCount = (store.deathCount || 0) + 1;
}