import { router } from '../trpc.js';
import { rankingRouter } from './ranking.js';
import { playerRouter } from './player.js';
import { gameRouter } from './game.js';

/**
 * Router principal que combina todos os sub-routers
 */
export const appRouter = router({
  ranking: rankingRouter,
  player: playerRouter,
  game: gameRouter,
});

/**
 * Exportar tipo do router para uso no cliente
 */
export type AppRouter = typeof appRouter;
