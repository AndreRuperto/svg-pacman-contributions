import { pgTable, serial, varchar, integer, timestamp, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Tabela de usuários do sistema
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  githubUsername: varchar('github_username', { length: 100 }).unique(),
  email: varchar('email', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  githubUsernameIdx: uniqueIndex('github_username_idx').on(table.githubUsername),
}));

/**
 * Tabela de sessões de jogo (cada run do Pac-Man)
 */
export const gameSessions = pgTable('game_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  score: integer('score').notNull(),
  ghostsEaten: integer('ghosts_eaten').default(0).notNull(),
  maxCombo: integer('max_combo').default(0).notNull(),
  contributionsCollected: integer('contributions_collected').default(0).notNull(),
  totalContributions: integer('total_contributions').default(0).notNull(),
  duration: integer('duration').notNull(), // em segundos
  style: varchar('style', { length: 50 }).notNull(), // 'aggressive', 'opportunistic', 'conservative'
  svgUrl: varchar('svg_url', { length: 1000 }),
  metadata: jsonb('metadata'), // dados extras: moves, power-ups, etc
  playedAt: timestamp('played_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex('game_sessions_user_id_idx').on(table.userId),
}));

/**
 * Tabela de badges conquistadas
 */
export const badges = pgTable('badges', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(), // 'first_blood', 'ghost_hunter', etc
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(), // emoji ou nome do ícone
  tier: varchar('tier', { length: 20 }).notNull(), // 'bronze', 'silver', 'gold', 'platinum'
  requirement: jsonb('requirement').notNull(), // condições para desbloquear
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Tabela de relacionamento: quais badges o usuário conquistou
 */
export const userBadges = pgTable('user_badges', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  badgeId: integer('badge_id').references(() => badges.id).notNull(),
  gameSessionId: integer('game_session_id').references(() => gameSessions.id), // sessão que desbloqueou
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
}, (table) => ({
  userBadgeIdx: uniqueIndex('user_badge_unique').on(table.userId, table.badgeId),
}));

/**
 * Relações do Drizzle ORM
 */
export const usersRelations = relations(users, ({ many }) => ({
  gameSessions: many(gameSessions),
  userBadges: many(userBadges),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
  user: one(users, {
    fields: [gameSessions.userId],
    references: [users.id],
  }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
  }),
  badge: one(badges, {
    fields: [userBadges.badgeId],
    references: [badges.id],
  }),
  gameSession: one(gameSessions, {
    fields: [userBadges.gameSessionId],
    references: [gameSessions.id],
  }),
}));

/**
 * Tipos TypeScript inferidos do schema
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type GameSession = typeof gameSessions.$inferSelect;
export type NewGameSession = typeof gameSessions.$inferInsert;

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;

export type UserBadge = typeof userBadges.$inferSelect;
export type NewUserBadge = typeof userBadges.$inferInsert;
