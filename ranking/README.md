# 🏆 Pac-Man Ranking System

Sistema de ranking para o projeto SVG-Pacman-Contributions. Permite que jogadores submetam suas partidas, comparem estatísticas e desbloqueiem badges.

## 📋 Features Implementadas

### ✅ Fase 1: SVG Viewer & Compartilhamento
- [x] Componente `SVGViewer` com controles de play/pause/velocidade
- [x] Fullscreen support
- [x] Download de SVG
- [x] Compartilhamento via Web Share API
- [x] Página de perfil do jogador integrada

### 🏗️ Infraestrutura
- [x] Backend com tRPC + Express
- [x] Schema de banco de dados com Drizzle ORM
- [x] Sistema de badges automático
- [x] Routers para ranking, perfil e submissões
- [x] Frontend React + Vite + TailwindCSS

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- pnpm (ou npm)

### 1. Configurar Banco de Dados

```bash
# Criar database
createdb pacman_ranking

# Copiar variáveis de ambiente
cd server
cp .env.example .env

# Editar .env com suas credenciais
```

### 2. Instalar Dependências

```bash
# Server
cd server
pnpm install

# Client
cd ../client
pnpm install
```

### 3. Rodar Migrations

```bash
cd server
pnpm run migrate
```

### 4. Seed do Banco (Badges)

```bash
cd server
pnpm run seed
```

### 5. Iniciar Servidores

```bash
# Terminal 1 - Backend
cd server
pnpm dev

# Terminal 2 - Frontend
cd client
pnpm dev
```

O frontend estará disponível em `http://localhost:5173` e o backend em `http://localhost:3001`.

## 📁 Estrutura do Projeto

```
ranking/
├── client/               # Frontend React
│   ├── src/
│   │   ├── components/   # Componentes reutilizáveis
│   │   │   └── SVGViewer.tsx
│   │   ├── pages/        # Páginas
│   │   │   └── PlayerProfile.tsx
│   │   ├── lib/          # Configurações (tRPC, etc)
│   │   └── hooks/        # Custom hooks
│   └── package.json
│
├── server/               # Backend Node.js
│   ├── src/
│   │   ├── db/           # Database
│   │   │   ├── schema.ts
│   │   │   ├── index.ts
│   │   │   └── seed.ts
│   │   ├── routers/      # tRPC routers
│   │   │   ├── ranking.ts
│   │   │   ├── player.ts
│   │   │   ├── game.ts
│   │   │   └── index.ts
│   │   ├── services/     # Lógica de negócio
│   │   │   └── badge-checker.ts
│   │   ├── middleware/   # Middlewares Express
│   │   ├── trpc.ts       # Configuração tRPC
│   │   └── index.ts      # Entry point
│   └── package.json
│
└── shared/               # Tipos compartilhados
    └── types.ts
```

## 🎮 API Endpoints (tRPC)

### Ranking
- `ranking.global` - Top 100 jogadores
- `ranking.byStyle` - Ranking por estilo (aggressive/opportunistic/conservative)
- `ranking.userPosition` - Posição do usuário no ranking
- `ranking.stats` - Estatísticas gerais

### Player
- `player.profile` - Perfil completo do jogador
- `player.gameHistory` - Histórico de partidas
- `player.styleStats` - Estatísticas por estilo
- `player.linkGithub` - Vincular conta GitHub

### Game
- `game.submit` - Submeter nova partida
- `game.getById` - Buscar partida por ID
- `game.delete` - Deletar partida
- `game.webhookSubmit` - Submissão via GitHub webhook

## 🏅 Sistema de Badges

### Badges de Pontuação
- 🎮 **First Blood** (Bronze) - Complete sua primeira partida
- 💯 **Century Club** (Bronze) - Alcance 100 pontos
- 🏆 **Grand Master** (Gold) - Alcance 1000 pontos
- 👑 **Legend** (Platinum) - Alcance 5000 pontos

### Badges de Fantasmas
- 👻 **Ghost Hunter** (Bronze) - Coma 10 fantasmas
- 💀 **Ghost Slayer** (Silver) - Coma 50 fantasmas
- 😈 **Exorcist** (Gold) - Coma 100 fantasmas

### Badges de Combo
- 🔥 **Combo Starter** (Bronze) - Combo de 5x
- ⚡ **Combo Master** (Silver) - Combo de 10x
- 🌟 **Combo God** (Gold) - Combo de 20x

### Badges de Coleta
- 🎯 **Collector** (Silver) - Colete 80% das contribuições
- 💎 **Perfectionist** (Platinum) - Colete 100%

### Badges de Estilo
- ⚔️ **Aggressive Player** - 10 partidas agressivas
- 🛡️ **Strategic Mind** - 10 partidas conservadoras
- 🎲 **Opportunist** - 10 partidas oportunistas

### Badges de Ranking
- 🥇 **Top 10** (Gold) - Entre no top 10
- 🥈 **Top 3** (Platinum) - Entre no top 3
- 🏅 **Champion** (Platinum) - Alcance o 1º lugar

### Badges de Dedicação
- 🎖️ **Veteran** (Silver) - Jogue 50 partidas
- 🤖 **Addicted** (Gold) - Jogue 100 partidas
- 🧟 **No Life** (Platinum) - Jogue 500 partidas

## 🔮 Próximas Fases

### Fase 2: GitHub Webhook Integration
- [ ] Webhook handler completo com HMAC validation
- [ ] Auto-submit de partidas via GitHub Action
- [ ] Documentação de integração

### Fase 3: Real-time Updates
- [ ] WebSocket ou polling para rankings
- [ ] Notificações de badges desbloqueadas
- [ ] Animações de entrada no ranking

### Fase 4: Otimizações
- [ ] Cache de queries com staleTime
- [ ] Virtualization para listas grandes
- [ ] Testes unitários com Vitest

### Fase 5: Features Bônus
- [ ] Sistema de amigos
- [ ] Filtros avançados
- [ ] Badges temporárias/eventos
- [ ] Dashboard de estatísticas globais

## 🛠️ Scripts Disponíveis

### Server
```bash
pnpm dev          # Desenvolvimento com hot-reload
pnpm build        # Build para produção
pnpm start        # Rodar produção
pnpm migrate      # Rodar migrations
pnpm seed         # Popular banco com badges
pnpm test         # Rodar testes
```

### Client
```bash
pnpm dev          # Desenvolvimento com Vite
pnpm build        # Build para produção
pnpm preview      # Preview do build
pnpm lint         # Rodar ESLint
```

## 📊 Database Schema

### Tables
- `users` - Dados dos jogadores
- `game_sessions` - Histórico de partidas
- `badges` - Badges disponíveis
- `user_badges` - Badges conquistadas pelos usuários

### Relações
- User → GameSessions (1:N)
- User → UserBadges (1:N)
- Badge → UserBadges (1:N)
- GameSession → UserBadges (1:N)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a mesma licença do projeto principal SVG-Pacman-Contributions.

## 🙏 Créditos

Desenvolvido como extensão do projeto [SVG-Pacman-Contributions](../README.md).
