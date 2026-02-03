import { db } from '../db/index.js';
import { badges, userBadges, gameSessions } from '../db/schema.js';
import { eq, sql, and } from 'drizzle-orm';

/**
 * Verifica e concede badges ao usuário baseado na partida atual
 * @param userId ID do usuário
 * @param gameSessionId ID da sessão de jogo
 * @returns Array de badges conquistadas
 */
export async function checkAndAwardBadges(userId: number, gameSessionId: number) {
  // Buscar a partida atual
  const currentGame = await db.query.gameSessions.findFirst({
    where: eq(gameSessions.id, gameSessionId),
  });

  if (!currentGame) {
    throw new Error('Sessão de jogo não encontrada');
  }

  // Buscar todas as badges
  const allBadges = await db.select().from(badges);

  // Buscar badges já conquistadas pelo usuário
  const existingBadges = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));

  const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId));

  // Buscar todas as partidas do usuário para estatísticas gerais
  const userGamesStats = await db
    .select({
      totalGames: sql<number>`COUNT(${gameSessions.id})`,
      totalGhostsEaten: sql<number>`SUM(${gameSessions.ghostsEaten})`,
      maxScoreEver: sql<number>`MAX(${gameSessions.score})`,
      maxComboEver: sql<number>`MAX(${gameSessions.maxCombo})`,
    })
    .from(gameSessions)
    .where(eq(gameSessions.userId, userId));

  const stats = userGamesStats[0];

  // Contar partidas por estilo
  const styleGames = await db
    .select({
      style: gameSessions.style,
      count: sql<number>`COUNT(${gameSessions.id})`,
    })
    .from(gameSessions)
    .where(eq(gameSessions.userId, userId))
    .groupBy(gameSessions.style);

  const styleCount = Object.fromEntries(styleGames.map((s) => [s.style, s.count]));

  // Taxa de coleta
  const collectionRate =
    currentGame.totalContributions > 0
      ? (currentGame.contributionsCollected / currentGame.totalContributions) * 100
      : 0;

  // Verificar cada badge
  const newBadges = [];

  for (const badge of allBadges) {
    // Pular se já possui
    if (existingBadgeIds.has(badge.id)) continue;

    const req = badge.requirement as any;
    let unlocked = false;

    // Verificar requisitos baseado no tipo
    if (req.games !== undefined) {
      unlocked = (stats.totalGames || 0) >= req.games;
    } else if (req.score !== undefined) {
      unlocked = currentGame.score >= req.score;
    } else if (req.ghostsEaten !== undefined) {
      unlocked = currentGame.ghostsEaten >= req.ghostsEaten;
    } else if (req.maxCombo !== undefined) {
      unlocked = currentGame.maxCombo >= req.maxCombo;
    } else if (req.collectionRate !== undefined) {
      unlocked = collectionRate >= req.collectionRate;
    } else if (req.style !== undefined && req.games !== undefined) {
      const styleGameCount = styleCount[req.style] || 0;
      unlocked = styleGameCount >= req.games;
    } else if (req.totalGames !== undefined) {
      unlocked = (stats.totalGames || 0) >= req.totalGames;
    } else if (req.rank !== undefined) {
      // Ranking badges são verificadas separadamente
      // TODO: Implementar verificação de ranking
      continue;
    }

    // Se desbloqueou, inserir no banco
    if (unlocked) {
      await db.insert(userBadges).values({
        userId,
        badgeId: badge.id,
        gameSessionId,
        unlockedAt: new Date(),
      });

      newBadges.push(badge);
    }
  }

  return newBadges;
}

/**
 * Verifica badges de ranking (executado periodicamente ou após atualização de ranking)
 */
export async function checkRankingBadges(userId: number) {
  // Calcular posição do usuário no ranking global
  const rankResult = await db.execute(sql`
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
      WHERE user_id = ${userId}
    )
  `);

  const rank = (rankResult.rows[0] as any)?.rank || 1;

  // Buscar badges de ranking
  const rankingBadges = await db
    .select()
    .from(badges)
    .where(sql`requirement->>'rank' IS NOT NULL`);

  // Buscar badges já conquistadas
  const existingBadges = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));

  const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId));

  const newBadges = [];

  for (const badge of rankingBadges) {
    if (existingBadgeIds.has(badge.id)) continue;

    const req = badge.requirement as any;
    if (req.rank !== undefined && rank <= req.rank) {
      await db.insert(userBadges).values({
        userId,
        badgeId: badge.id,
        unlockedAt: new Date(),
      });

      newBadges.push(badge);
    }
  }

  return newBadges;
}
