import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import { gameSessions, users, userBadges, badges } from '../db/schema.js';
import { desc, eq, and, sql } from 'drizzle-orm';

/**
 * Router para endpoints de ranking
 */
export const rankingRouter = router({
  /**
   * Ranking global - Top 100 jogadores por high score
   */
  global: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { limit, offset } = input;

      // Query para pegar o melhor score de cada usuário
      const rankings = await db
        .select({
          rank: sql<number>`ROW_NUMBER() OVER (ORDER BY MAX(${gameSessions.score}) DESC)`,
          userId: users.id,
          username: users.username,
          githubUsername: users.githubUsername,
          avatarUrl: users.avatarUrl,
          highScore: sql<number>`MAX(${gameSessions.score})`,
          totalGames: sql<number>`COUNT(${gameSessions.id})`,
          totalGhostsEaten: sql<number>`SUM(${gameSessions.ghostsEaten})`,
          maxCombo: sql<number>`MAX(${gameSessions.maxCombo})`,
          badgeCount: sql<number>`COUNT(DISTINCT ${userBadges.badgeId})`,
        })
        .from(users)
        .innerJoin(gameSessions, eq(users.id, gameSessions.userId))
        .leftJoin(userBadges, eq(users.id, userBadges.userId))
        .groupBy(users.id)
        .orderBy(desc(sql`MAX(${gameSessions.score})`))
        .limit(limit)
        .offset(offset);

      return rankings;
    }),

  /**
   * Ranking por estilo de jogo
   */
  byStyle: publicProcedure
    .input(
      z.object({
        style: z.enum(['aggressive', 'opportunistic', 'conservative']),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const { style, limit } = input;

      const rankings = await db
        .select({
          rank: sql<number>`ROW_NUMBER() OVER (ORDER BY MAX(${gameSessions.score}) DESC)`,
          userId: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
          highScore: sql<number>`MAX(${gameSessions.score})`,
          totalGames: sql<number>`COUNT(${gameSessions.id})`,
        })
        .from(users)
        .innerJoin(gameSessions, eq(users.id, gameSessions.userId))
        .where(eq(gameSessions.style, style))
        .groupBy(users.id)
        .orderBy(desc(sql`MAX(${gameSessions.score})`))
        .limit(limit);

      return rankings;
    }),

  /**
   * Posição do usuário no ranking
   */
  userPosition: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      const { username } = input;

      // Encontrar usuário
      const user = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Calcular posição global
      const globalRank = await db
        .select({
          rank: sql<number>`COUNT(*) + 1`,
        })
        .from(gameSessions)
        .where(
          sql`${gameSessions.userId} IN (
            SELECT ${users.id} FROM ${users}
          ) AND (
            SELECT MAX(${gameSessions.score})
            FROM ${gameSessions}
            WHERE ${gameSessions.userId} = ${users.id}
          ) > (
            SELECT MAX(${gameSessions.score})
            FROM ${gameSessions}
            WHERE ${gameSessions.userId} = ${user.id}
          )`
        );

      return {
        globalRank: globalRank[0]?.rank || 1,
        userId: user.id,
      };
    }),

  /**
   * Estatísticas gerais do ranking
   */
  stats: publicProcedure.query(async () => {
    const stats = await db
      .select({
        totalPlayers: sql<number>`COUNT(DISTINCT ${users.id})`,
        totalGames: sql<number>`COUNT(${gameSessions.id})`,
        highestScore: sql<number>`MAX(${gameSessions.score})`,
        totalGhostsEaten: sql<number>`SUM(${gameSessions.ghostsEaten})`,
        averageScore: sql<number>`AVG(${gameSessions.score})`,
      })
      .from(users)
      .leftJoin(gameSessions, eq(users.id, gameSessions.userId));

    return stats[0];
  }),
});
