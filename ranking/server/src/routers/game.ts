import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import { gameSessions, users } from '../db/schema.js';
import { checkAndAwardBadges } from '../services/badge-checker.js';

/**
 * Schema de validação para submissão de partida
 */
const gameSubmissionSchema = z.object({
  userId: z.number(),
  score: z.number().min(0),
  ghostsEaten: z.number().min(0).default(0),
  maxCombo: z.number().min(0).default(0),
  contributionsCollected: z.number().min(0).default(0),
  totalContributions: z.number().min(0).default(0),
  duration: z.number().min(0), // em segundos
  style: z.enum(['aggressive', 'opportunistic', 'conservative']),
  svgUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Router para endpoints de partidas
 */
export const gameRouter = router({
  /**
   * Submeter nova partida
   */
  submit: publicProcedure.input(gameSubmissionSchema).mutation(async ({ input }) => {
    // Inserir game session
    const [gameSession] = await db
      .insert(gameSessions)
      .values({
        ...input,
        playedAt: new Date(),
      })
      .returning();

    // Verificar e conceder badges
    const newBadges = await checkAndAwardBadges(input.userId, gameSession.id);

    return {
      success: true,
      gameSession,
      newBadges,
    };
  }),

  /**
   * Buscar partida por ID
   */
  getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const game = await db.query.gameSessions.findFirst({
      where: (gameSessions, { eq }) => eq(gameSessions.id, input.id),
      with: {
        user: true,
      },
    });

    if (!game) {
      throw new Error('Partida não encontrada');
    }

    return game;
  }),

  /**
   * Deletar partida (apenas para o próprio usuário)
   */
  delete: publicProcedure
    .input(z.object({ gameId: z.number(), userId: z.number() }))
    .mutation(async ({ input }) => {
      const { gameId, userId } = input;

      // Verificar se a partida pertence ao usuário
      const game = await db.query.gameSessions.findFirst({
        where: (gameSessions, { eq }) => eq(gameSessions.id, gameId),
      });

      if (!game) {
        throw new Error('Partida não encontrada');
      }

      if (game.userId !== userId) {
        throw new Error('Você não tem permissão para deletar esta partida');
      }

      // Deletar partida
      await db.delete(gameSessions).where((gameSessions, { eq }) => eq(gameSessions.id, gameId));

      return { success: true };
    }),

  /**
   * Submissão via webhook do GitHub
   * Este endpoint será chamado pela GitHub Action após gerar o SVG
   */
  webhookSubmit: publicProcedure
    .input(
      z.object({
        githubUsername: z.string(),
        score: z.number().min(0),
        ghostsEaten: z.number().min(0).default(0),
        maxCombo: z.number().min(0).default(0),
        contributionsCollected: z.number().min(0).default(0),
        totalContributions: z.number().min(0).default(0),
        duration: z.number().min(0),
        style: z.enum(['aggressive', 'opportunistic', 'conservative']),
        svgUrl: z.string().url(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { githubUsername, ...gameData } = input;

      // Encontrar usuário pelo GitHub username
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.githubUsername, githubUsername),
      });

      if (!user) {
        throw new Error(`Usuário com GitHub username '${githubUsername}' não encontrado`);
      }

      // Inserir game session
      const [gameSession] = await db
        .insert(gameSessions)
        .values({
          userId: user.id,
          ...gameData,
          playedAt: new Date(),
        })
        .returning();

      // Verificar e conceder badges
      const newBadges = await checkAndAwardBadges(user.id, gameSession.id);

      return {
        success: true,
        gameSession,
        newBadges,
        message: newBadges.length > 0 ? `🎉 ${newBadges.length} nova(s) badge(s) desbloqueada(s)!` : 'Partida registrada com sucesso!',
      };
    }),
});
