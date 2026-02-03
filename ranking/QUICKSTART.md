# 🚀 Quick Start - Pac-Man Ranking

Este guia vai te ajudar a colocar o sistema de ranking funcionando em **menos de 5 minutos**.

## ✅ Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **pnpm** (ou npm): `npm install -g pnpm`

## 📦 Instalação Rápida

### 1. Setup do Banco de Dados

```bash
# Criar database PostgreSQL
createdb pacman_ranking

# Se não tiver o comando createdb, use o psql:
psql -U postgres
CREATE DATABASE pacman_ranking;
\q
```

### 2. Configurar Servidor

```bash
cd ranking/server

# Copiar variáveis de ambiente
cp .env.example .env

# Editar o .env com suas credenciais do PostgreSQL
# DATABASE_URL=postgresql://seu_usuario:sua_senha@localhost:5432/pacman_ranking

# Instalar dependências
pnpm install

# Rodar migrations (criar tabelas)
pnpm exec drizzle-kit push:pg

# Popular banco com badges iniciais
pnpm exec tsx src/db/seed.ts
```

### 3. Configurar Cliente

```bash
cd ../client

# Instalar dependências
pnpm install
```

### 4. Iniciar Aplicação

Abra **2 terminais**:

**Terminal 1 - Backend:**
```bash
cd ranking/server
pnpm dev
```

Você verá:
```
🚀 Servidor rodando em http://localhost:3001
📡 tRPC endpoint: http://localhost:3001/trpc
```

**Terminal 2 - Frontend:**
```bash
cd ranking/client
pnpm dev
```

Você verá:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

## 🎉 Pronto!

Acesse **http://localhost:5173** no seu navegador.

## 📝 Próximos Passos

### Testar a Página de Perfil

A página de perfil está em `/player/:username`. Para testar com dados mockados:

1. Acesse: **http://localhost:5173/player/player123**
2. Você verá a página de perfil com dados de exemplo

### Criar seu Primeiro Usuário

Para criar usuários reais e submeter partidas, você precisará:

1. **Criar um usuário** via SQL ou criar um endpoint de registro
2. **Submeter uma partida** usando a mutation `game.submit`

Exemplo com curl:

```bash
curl -X POST http://localhost:3001/trpc/game.submit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "score": 2450,
    "ghostsEaten": 45,
    "maxCombo": 15,
    "contributionsCollected": 280,
    "totalContributions": 300,
    "duration": 180,
    "style": "aggressive",
    "svgUrl": "https://example.com/pacman.svg"
  }'
```

### Integrar com GitHub Action

Para fazer o sistema receber partidas automaticamente da sua GitHub Action:

1. Vincule seu GitHub username a um usuário:
   ```sql
   UPDATE users SET github_username = 'seu-username' WHERE id = 1;
   ```

2. Configure a GitHub Action para chamar o endpoint `game.webhookSubmit`

3. Veja [WEBHOOK_INTEGRATION.md](./WEBHOOK_INTEGRATION.md) para detalhes (será criado na Fase 2)

## 🐛 Problemas Comuns

### Erro: "Cannot connect to database"

**Solução:** Verifique se o PostgreSQL está rodando e se a `DATABASE_URL` no `.env` está correta.

```bash
# Verificar se PostgreSQL está ativo
# Windows:
pg_ctl status

# Linux/Mac:
pg_isready
```

### Erro: "Port 3001 already in use"

**Solução:** Mude a porta no `.env` do servidor:
```env
PORT=3002
```

E no `vite.config.ts` do cliente, atualize o proxy:
```ts
proxy: {
  '/trpc': {
    target: 'http://localhost:3002',
  },
}
```

### Erro: "relation does not exist"

**Solução:** Você esqueceu de rodar as migrations:
```bash
cd ranking/server
pnpm exec drizzle-kit push:pg
```

### SVG não carrega no SVGViewer

**Solução:** Certifique-se de que a URL do SVG:
1. É uma URL válida e acessível
2. Permite CORS (Cross-Origin Resource Sharing)
3. É um arquivo SVG válido

Para testar localmente, use um SVG público como:
```
https://raw.githubusercontent.com/seu-username/seu-repo/main/pacman.svg
```

## 📚 Documentação Completa

- [README.md](./README.md) - Documentação completa
- [TODO2.TXT](../TODO2.TXT) - Melhorias planejadas
- Schema do banco: [server/src/db/schema.ts](./server/src/db/schema.ts)
- Routers tRPC: [server/src/routers/](./server/src/routers/)

## 💡 Dicas

1. **Use o Drizzle Studio** para visualizar o banco:
   ```bash
   cd server
   pnpm exec drizzle-kit studio
   ```

2. **Monitore os logs** do servidor para debug

3. **Use React DevTools** para inspecionar queries do tRPC

4. **Habilite hot-reload** está ativo em ambos servidor e cliente

## 🆘 Precisa de Ajuda?

- Abra uma issue no GitHub
- Veja os exemplos em [server/src/routers/](./server/src/routers/)
- Leia a documentação do [tRPC](https://trpc.io)
- Consulte a doc do [Drizzle ORM](https://orm.drizzle.team)

## ✨ Funcionalidades Implementadas

- ✅ Sistema de ranking global
- ✅ Perfil de jogador com estatísticas
- ✅ SVG Viewer com controles
- ✅ Sistema de badges automático (21 badges)
- ✅ Histórico de partidas
- ✅ Estatísticas por estilo de jogo
- ✅ Submissão de partidas via API

## 🔮 Próximas Features (Fase 2+)

- [ ] GitHub webhook integration
- [ ] Real-time rankings (WebSocket)
- [ ] Página de leaderboard
- [ ] Página de comparação de jogadores
- [ ] Sistema de amigos
- [ ] Filtros avançados

---

**Divirta-se! 🎮👾**
