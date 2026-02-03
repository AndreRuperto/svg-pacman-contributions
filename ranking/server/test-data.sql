-- Script SQL para criar dados de teste
-- Execute este arquivo após rodar as migrations e seed

-- Criar usuário de teste
INSERT INTO users (username, github_username, email, avatar_url, created_at, updated_at)
VALUES
  ('player123', 'johndoe', 'john@example.com', 'https://github.com/johndoe.png', NOW(), NOW()),
  ('speedrunner', 'janedoe', 'jane@example.com', 'https://github.com/janedoe.png', NOW(), NOW()),
  ('ghost_hunter_99', 'pacman_pro', 'pro@example.com', 'https://github.com/pacman_pro.png', NOW(), NOW())
ON CONFLICT (username) DO NOTHING;

-- Criar partidas de exemplo
INSERT INTO game_sessions (
  user_id,
  score,
  ghosts_eaten,
  max_combo,
  contributions_collected,
  total_contributions,
  duration,
  style,
  svg_url,
  played_at
)
VALUES
  -- Partidas do player123
  (
    (SELECT id FROM users WHERE username = 'player123'),
    2450, 45, 15, 280, 300, 180, 'aggressive',
    'https://raw.githubusercontent.com/example/pacman.svg',
    NOW() - INTERVAL '1 day'
  ),
  (
    (SELECT id FROM users WHERE username = 'player123'),
    1800, 32, 12, 200, 300, 150, 'opportunistic',
    'https://raw.githubusercontent.com/example/pacman2.svg',
    NOW() - INTERVAL '2 days'
  ),
  (
    (SELECT id FROM users WHERE username = 'player123'),
    3200, 58, 18, 290, 300, 200, 'aggressive',
    'https://raw.githubusercontent.com/example/pacman3.svg',
    NOW() - INTERVAL '3 days'
  ),

  -- Partidas do speedrunner
  (
    (SELECT id FROM users WHERE username = 'speedrunner'),
    5000, 80, 25, 300, 300, 120, 'aggressive',
    'https://raw.githubusercontent.com/example/speedrun.svg',
    NOW() - INTERVAL '1 hour'
  ),
  (
    (SELECT id FROM users WHERE username = 'speedrunner'),
    4200, 65, 20, 285, 300, 140, 'opportunistic',
    'https://raw.githubusercontent.com/example/speedrun2.svg',
    NOW() - INTERVAL '5 hours'
  ),

  -- Partidas do ghost_hunter_99
  (
    (SELECT id FROM users WHERE username = 'ghost_hunter_99'),
    1500, 100, 10, 150, 300, 250, 'conservative',
    'https://raw.githubusercontent.com/example/hunter.svg',
    NOW() - INTERVAL '12 hours'
  ),
  (
    (SELECT id FROM users WHERE username = 'ghost_hunter_99'),
    1200, 85, 8, 120, 300, 220, 'conservative',
    'https://raw.githubusercontent.com/example/hunter2.svg',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT DO NOTHING;

-- Verificar dados inseridos
SELECT
  u.username,
  COUNT(gs.id) as total_games,
  MAX(gs.score) as high_score,
  SUM(gs.ghosts_eaten) as total_ghosts
FROM users u
LEFT JOIN game_sessions gs ON u.id = gs.user_id
GROUP BY u.id, u.username
ORDER BY high_score DESC;

-- Ver ranking atual
WITH user_max_scores AS (
  SELECT
    user_id,
    MAX(score) as max_score,
    COUNT(*) as games,
    SUM(ghosts_eaten) as total_ghosts
  FROM game_sessions
  GROUP BY user_id
)
SELECT
  ROW_NUMBER() OVER (ORDER BY max_score DESC) as rank,
  u.username,
  ums.max_score as high_score,
  ums.games,
  ums.total_ghosts
FROM user_max_scores ums
JOIN users u ON ums.user_id = u.id
ORDER BY rank;
