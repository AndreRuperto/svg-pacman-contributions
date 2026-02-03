import { db } from './index.js';
import { badges } from './schema.js';

/**
 * Badges predefinidas do sistema
 */
const initialBadges = [
  // Badges de pontuação
  {
    code: 'first_blood',
    name: 'First Blood',
    description: 'Complete sua primeira partida',
    icon: '🎮',
    tier: 'bronze',
    requirement: { games: 1 },
  },
  {
    code: 'century_club',
    name: 'Century Club',
    description: 'Alcance 100 pontos em uma partida',
    icon: '💯',
    tier: 'bronze',
    requirement: { score: 100 },
  },
  {
    code: 'grand_master',
    name: 'Grand Master',
    description: 'Alcance 1000 pontos em uma partida',
    icon: '🏆',
    tier: 'gold',
    requirement: { score: 1000 },
  },
  {
    code: 'legend',
    name: 'Legend',
    description: 'Alcance 5000 pontos em uma partida',
    icon: '👑',
    tier: 'platinum',
    requirement: { score: 5000 },
  },

  // Badges de fantasmas
  {
    code: 'ghost_hunter',
    name: 'Ghost Hunter',
    description: 'Coma 10 fantasmas em uma partida',
    icon: '👻',
    tier: 'bronze',
    requirement: { ghostsEaten: 10 },
  },
  {
    code: 'ghost_slayer',
    name: 'Ghost Slayer',
    description: 'Coma 50 fantasmas em uma partida',
    icon: '💀',
    tier: 'silver',
    requirement: { ghostsEaten: 50 },
  },
  {
    code: 'exorcist',
    name: 'Exorcist',
    description: 'Coma 100 fantasmas em uma partida',
    icon: '😈',
    tier: 'gold',
    requirement: { ghostsEaten: 100 },
  },

  // Badges de combo
  {
    code: 'combo_starter',
    name: 'Combo Starter',
    description: 'Alcance um combo de 5x',
    icon: '🔥',
    tier: 'bronze',
    requirement: { maxCombo: 5 },
  },
  {
    code: 'combo_master',
    name: 'Combo Master',
    description: 'Alcance um combo de 10x',
    icon: '⚡',
    tier: 'silver',
    requirement: { maxCombo: 10 },
  },
  {
    code: 'combo_god',
    name: 'Combo God',
    description: 'Alcance um combo de 20x',
    icon: '🌟',
    tier: 'gold',
    requirement: { maxCombo: 20 },
  },

  // Badges de coleta
  {
    code: 'collector',
    name: 'Collector',
    description: 'Colete 80% das contribuições',
    icon: '🎯',
    tier: 'silver',
    requirement: { collectionRate: 80 },
  },
  {
    code: 'perfectionist',
    name: 'Perfectionist',
    description: 'Colete 100% das contribuições',
    icon: '💎',
    tier: 'platinum',
    requirement: { collectionRate: 100 },
  },

  // Badges de estilo
  {
    code: 'aggressive_player',
    name: 'Aggressive Player',
    description: 'Complete 10 partidas no estilo agressivo',
    icon: '⚔️',
    tier: 'bronze',
    requirement: { style: 'aggressive', games: 10 },
  },
  {
    code: 'strategic_mind',
    name: 'Strategic Mind',
    description: 'Complete 10 partidas no estilo conservador',
    icon: '🛡️',
    tier: 'bronze',
    requirement: { style: 'conservative', games: 10 },
  },
  {
    code: 'opportunist',
    name: 'Opportunist',
    description: 'Complete 10 partidas no estilo oportunista',
    icon: '🎲',
    tier: 'bronze',
    requirement: { style: 'opportunistic', games: 10 },
  },

  // Badges de ranking
  {
    code: 'top_10',
    name: 'Top 10',
    description: 'Entre no top 10 do ranking global',
    icon: '🥇',
    tier: 'gold',
    requirement: { rank: 10 },
  },
  {
    code: 'top_3',
    name: 'Top 3',
    description: 'Entre no top 3 do ranking global',
    icon: '🥈',
    tier: 'platinum',
    requirement: { rank: 3 },
  },
  {
    code: 'champion',
    name: 'Champion',
    description: 'Alcance o 1º lugar no ranking global',
    icon: '🏅',
    tier: 'platinum',
    requirement: { rank: 1 },
  },

  // Badges de dedicação
  {
    code: 'veteran',
    name: 'Veteran',
    description: 'Jogue 50 partidas',
    icon: '🎖️',
    tier: 'silver',
    requirement: { totalGames: 50 },
  },
  {
    code: 'addicted',
    name: 'Addicted',
    description: 'Jogue 100 partidas',
    icon: '🤖',
    tier: 'gold',
    requirement: { totalGames: 100 },
  },
  {
    code: 'no_life',
    name: 'No Life',
    description: 'Jogue 500 partidas',
    icon: '🧟',
    tier: 'platinum',
    requirement: { totalGames: 500 },
  },
];

/**
 * Função para popular o banco com badges iniciais
 */
export async function seedBadges() {
  console.log('🌱 Seeding badges...');

  try {
    for (const badge of initialBadges) {
      await db.insert(badges).values(badge).onConflictDoNothing();
    }

    console.log(`✅ ${initialBadges.length} badges inseridas com sucesso!`);
  } catch (error) {
    console.error('❌ Erro ao fazer seed das badges:', error);
    throw error;
  }
}

// Executar seed se rodado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedBadges()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
