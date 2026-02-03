import { useParams } from 'react-router-dom';
import { SVGViewer } from '../components/SVGViewer';
import { Trophy, Target, Zap, Ghost, Calendar, Award } from 'lucide-react';

// Mock data - será substituído por tRPC query
const mockPlayerData = {
  id: 1,
  username: 'player123',
  githubUsername: 'johndoe',
  avatarUrl: 'https://github.com/johndoe.png',
  stats: {
    totalGames: 42,
    highScore: 2450,
    totalGhostsEaten: 320,
    maxCombo: 15,
    averageScore: 1250,
    totalPlayTime: 7200, // segundos
  },
  recentGame: {
    score: 2450,
    ghostsEaten: 45,
    maxCombo: 15,
    contributionsCollected: 280,
    totalContributions: 300,
    duration: 180,
    style: 'aggressive',
    svgUrl: 'https://example.com/pacman.svg', // URL do SVG
    playedAt: new Date('2025-01-28'),
  },
  badges: [
    { code: 'first_blood', name: 'First Blood', icon: '🎮', tier: 'bronze' },
    { code: 'ghost_hunter', name: 'Ghost Hunter', icon: '👻', tier: 'bronze' },
    { code: 'combo_master', name: 'Combo Master', icon: '⚡', tier: 'silver' },
    { code: 'grand_master', name: 'Grand Master', icon: '🏆', tier: 'gold' },
  ],
  ranking: {
    global: 12,
    style: 5, // posição no ranking do estilo específico
  },
};

export function PlayerProfile() {
  const { username } = useParams<{ username: string }>();

  // TODO: Substituir por trpc.player.profile.useQuery({ username })
  const player = mockPlayerData;

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Jogador não encontrado</h1>
          <p className="text-gray-400">O jogador "{username}" não existe.</p>
        </div>
      </div>
    );
  }

  const collectionRate =
    (player.recentGame.contributionsCollected / player.recentGame.totalContributions) * 100;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-900/20 to-transparent border-b border-amber-900/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <img
              src={player.avatarUrl}
              alt={player.username}
              className="w-24 h-24 rounded-full border-4 border-amber-500"
            />

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{player.username}</h1>
              <div className="flex items-center gap-4 text-gray-400">
                <a
                  href={`https://github.com/${player.githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-500 transition-colors"
                >
                  @{player.githubUsername}
                </a>
                <span className="flex items-center gap-1">
                  <Trophy size={16} />#{player.ranking.global} Global
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-amber-500">{player.stats.highScore}</div>
                <div className="text-sm text-gray-400">High Score</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-500">{player.stats.totalGames}</div>
                <div className="text-sm text-gray-400">Partidas</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* SVG Animation */}
            <section className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span>🎮</span> Última Partida
              </h2>
              <SVGViewer url={player.recentGame.svgUrl} className="w-full h-[500px]" />

              {/* Game Stats */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-500">
                    {player.recentGame.score}
                  </div>
                  <div className="text-sm text-gray-400">Pontos</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-500">
                    {player.recentGame.ghostsEaten}
                  </div>
                  <div className="text-sm text-gray-400">Fantasmas</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {player.recentGame.maxCombo}x
                  </div>
                  <div className="text-sm text-gray-400">Max Combo</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {collectionRate.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-400">Coletado</div>
                </div>
              </div>

              {/* Game Details */}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                <span className="flex items-center gap-2">
                  <Calendar size={16} />
                  {player.recentGame.playedAt.toLocaleDateString('pt-BR')}
                </span>
                <span className="capitalize bg-gray-800 px-3 py-1 rounded-full">
                  {player.recentGame.style}
                </span>
                <span>{Math.floor(player.recentGame.duration / 60)}min</span>
              </div>
            </section>

            {/* All-Time Stats */}
            <section className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Target />
                Estatísticas Gerais
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard
                  icon={<Trophy className="text-amber-500" />}
                  label="High Score"
                  value={player.stats.highScore.toLocaleString()}
                />
                <StatCard
                  icon={<Ghost className="text-purple-500" />}
                  label="Total de Fantasmas"
                  value={player.stats.totalGhostsEaten.toLocaleString()}
                />
                <StatCard
                  icon={<Zap className="text-blue-500" />}
                  label="Melhor Combo"
                  value={`${player.stats.maxCombo}x`}
                />
                <StatCard
                  icon={<Target className="text-green-500" />}
                  label="Média de Pontos"
                  value={player.stats.averageScore.toLocaleString()}
                />
                <StatCard
                  icon={<Calendar className="text-orange-500" />}
                  label="Total de Partidas"
                  value={player.stats.totalGames.toString()}
                />
                <StatCard
                  icon={<Award className="text-pink-500" />}
                  label="Tempo Jogado"
                  value={`${Math.floor(player.stats.totalPlayTime / 3600)}h`}
                />
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Badges */}
            <section className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Award />
                Badges ({player.badges.length})
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {player.badges.map((badge) => (
                  <div
                    key={badge.code}
                    className={`p-4 rounded-lg text-center border-2 ${getBadgeBorderColor(
                      badge.tier
                    )}`}
                  >
                    <div className="text-3xl mb-2">{badge.icon}</div>
                    <div className="text-xs font-semibold">{badge.name}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ranking Position */}
            <section className="bg-gradient-to-br from-amber-900/30 to-gray-900 rounded-lg p-6 border border-amber-900/30">
              <h2 className="text-xl font-bold mb-4">🏆 Ranking</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Global</span>
                  <span className="text-2xl font-bold text-amber-500">
                    #{player.ranking.global}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 capitalize">{player.recentGame.style}</span>
                  <span className="text-2xl font-bold text-amber-500">
                    #{player.ranking.style}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

function getBadgeBorderColor(tier: string): string {
  const colors = {
    bronze: 'border-orange-700 bg-orange-950/20',
    silver: 'border-gray-400 bg-gray-800/20',
    gold: 'border-yellow-500 bg-yellow-950/20',
    platinum: 'border-cyan-400 bg-cyan-950/20',
  };
  return colors[tier as keyof typeof colors] || colors.bronze;
}
