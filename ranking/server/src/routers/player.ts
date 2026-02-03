import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, gameSessions, userBadges, badges } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * Router para endpoints de perfil do jogador
 */
export const playerRouter = router({
  /**
   * Buscar perfil completo do jogador
   */
  profile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      const { username } = input;

      // Buscar usuário
      const user = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (!user) {
        throw new Error('Jogador não encontrado');
      }

      // Buscar estatísticas gerais
      const stats = await db
        .select({
          totalGames: sql<number>`COUNT(${gameSessions.id})`,
          highScore: sql<number>`MAX(${gameSessions.score})`,
          averageScore: sql<number>`AVG(${gameSessions.score})`,
          totalGhostsEaten: sql<number>`SUM(${gameSessions.ghostsEaten})`,
          maxCombo: sql<number>`MAX(${gameSessions.maxCombo})`,
          totalPlayTime: sql<number>`SUM(${gameSessions.duration})`,
        })
        .from(gameSessions)
        .where(eq(gameSessions.userId, user.id));

      // Buscar última partida
      const recentGame = await db.query.gameSessions.findFirst({
        where: eq(gameSessions.userId, user.id),
        orderBy: [desc(gameSessions.playedAt)],
      });

      // Buscar badges do usuário
      const userBadgesData = await db
        .select({
          code: badges.code,
          name: badges.name,
          icon: badges.icon,
          tier: badges.tier,
          description: badges.description,
          unlockedAt: userBadges.unlockedAt,
        })
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.id))
        .where(eq(userBadges.userId, user.id))
        .orderBy(desc(userBadges.unlockedAt));

      // Calcular ranking global
      const globalRankResult = await db.execute(sql`
        WITH user_max_scores AS (
          SELECT
            user_id,
            MAX(score) as max_score
          FROM game_sessions
          GROUP BY user_id
        )
        SELECT COUNT(*) + 1 as rank
        FROM user_max_scores
        WHERE max_score > (
          SELECT MAX(score)
          FROM game_sessions
          WHERE user_id = ${user.id}
        )
      `);

      const globalRank = (globalRankResult.rows[0] as any)?.rank || 1;

      return {
        id: user.id,
        username: user.username,
        githubUsername: user.githubUsername,
        avatarUrl: user.avatarUrl,
        stats: stats[0],
        recentGame,
        badges: userBadgesData,
        ranking: {
          global: globalRank,
        },
      };
    }),

  /**
   * Histórico de partidas do jogador
   */
  gameHistory: publicProcedure
    .input(
      z.object({
        username: z.string(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { username, limit, offset } = input;

      // Buscar usuário
      const user = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (!user) {
        throw new Error('Jogador não encontrado');
      }

      // Buscar histórico de partidas
      const games = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.userId, user.id))
        .orderBy(desc(gameSessions.playedAt))
        .limit(limit)
        .offset(offset);

      return games;
    }),

  /**
   * Estatísticas por estilo de jogo
   */
  styleStats: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      const { username } = input;

      // Buscar usuário
      const user = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (!user) {
        throw new Error('Jogador não encontrado');
      }

      // Buscar estatísticas por estilo
      const styleStats = await db
        .select({
          style: gameSessions.style,
          games: sql<number>`COUNT(${gameSessions.id})`,
          avgScore: sql<number>`AVG(${gameSessions.score})`,
          highScore: sql<number>`MAX(${gameSessions.score})`,
          avgGhosts: sql<number>`AVG(${gameSessions.ghostsEaten})`,
        })
        .from(gameSessions)
        .where(eq(gameSessions.userId, user.id))
        .groupBy(gameSessions.style);

      return styleStats;
    }),

  /**
   * Vincular conta GitHub ao usuário
   */
  linkGithub: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        githubUsername: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { userId, githubUsername } = input;

      // Verificar se GitHub username já está em uso
      const existing = await db.query.users.findFirst({
        where: eq(users.githubUsername, githubUsername),
      });

      if (existing && existing.id !== userId) {
        throw new Error('GitHub username já está vinculado a outro usuário');
      }

      // Atualizar usuário
      await db
        .update(users)
        .set({
          githubUsername,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { success: true };
    }),
});
