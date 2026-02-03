# 🪟 Guia para Windows

## 📋 Pré-requisitos

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/windows/)
3. **Git Bash** (opcional, para comandos Unix) - [Download](https://git-scm.com/download/win)

## 🚀 Instalação Rápida

### Método 1: Usando o Script .bat (Recomendado)

```cmd
cd D:\Projetos\pacman\ranking
setup.bat
```

O script irá:
1. ✅ Criar o banco de dados
2. ✅ Instalar dependências do servidor
3. ✅ Configurar variáveis de ambiente
4. ✅ Criar tabelas no banco
5. ✅ Popular badges iniciais
6. ✅ Instalar dependências do cliente
7. ✅ Preparar tudo para rodar

**IMPORTANTE**: Durante o setup, você será solicitado a editar o arquivo `server\.env` com suas credenciais do PostgreSQL.

### Método 2: Manual (PowerShell)

```powershell
# 1. Criar banco
createdb pacman_ranking

# 2. Servidor
cd server
npm install
copy .env.example .env
# Edite o .env com suas credenciais
npx drizzle-kit push
npx tsx src/db/seed.ts

# 3. Cliente
cd ..\client
npm install

# 4. Voltar
cd ..
npm install
```

## ▶️ Rodar o Projeto

### Opção 1: Script .bat

```cmd
start.bat
```

### Opção 2: Comando npm

```cmd
npm run dev
```

### Opção 3: Terminais Separados

**Terminal 1:**
```cmd
cd server
npm run dev
```

**Terminal 2:**
```cmd
cd client
npm run dev
```

## 📊 Adicionar Dados de Teste

```cmd
add-test-data.bat
```

Isso criará 3 usuários de exemplo:
- **player123** - http://localhost:5173/player/player123
- **speedrunner**
- **ghost_hunter_99**

## 🐛 Problemas Comuns no Windows

### Erro: "createdb não é reconhecido"

**Solução**: Adicione o PostgreSQL ao PATH

1. Encontre a pasta `bin` do PostgreSQL (geralmente `C:\Program Files\PostgreSQL\15\bin`)
2. Adicione ao PATH do Windows:
   - Pesquise "Variáveis de Ambiente" no menu Iniciar
   - Clique em "Variáveis de Ambiente"
   - Em "Variáveis do sistema", edite "Path"
   - Adicione: `C:\Program Files\PostgreSQL\15\bin`
   - Clique OK e reinicie o terminal

**Alternativa**: Use o `psql` diretamente:
```cmd
psql -U postgres
CREATE DATABASE pacman_ranking;
\q
```

### Erro: "npm não é reconhecido"

**Solução**: Reinstale o Node.js e marque a opção "Add to PATH"

### Erro: "psql: FATAL: password authentication failed"

**Solução**: Ajuste o arquivo `server\.env`:

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/pacman_ranking
```

Substitua `SUA_SENHA` pela senha do PostgreSQL que você configurou na instalação.

### Erro: "Port 3001 already in use"

**Solução 1**: Mate o processo que está usando a porta:
```cmd
netstat -ano | findstr :3001
taskkill /PID [numero_do_pid] /F
```

**Solução 2**: Mude a porta no `server\.env`:
```env
PORT=3002
```

E atualize o proxy no `client\vite.config.ts`.

### Erro ao rodar migrations: "connect ECONNREFUSED"

**Solução**: Verifique se o PostgreSQL está rodando:

1. Abra "Serviços" do Windows (Win + R → `services.msc`)
2. Procure por "postgresql-x64-15" (ou sua versão)
3. Clique com botão direito → Iniciar

Ou via linha de comando:
```cmd
net start postgresql-x64-15
```

### Script .bat não executa

**Solução**: Execute como Administrador:
- Clique com botão direito no arquivo `.bat`
- Selecione "Executar como administrador"

## 📝 Estrutura de Arquivos .bat

```
ranking/
├── setup.bat              ← Setup completo (primeira vez)
├── start.bat              ← Iniciar servidor + cliente
└── add-test-data.bat      ← Adicionar dados de exemplo
```

## 🔧 Comandos Úteis

### Verificar se PostgreSQL está rodando
```cmd
pg_isready
```

### Acessar o banco via psql
```cmd
psql -U postgres -d pacman_ranking
```

### Limpar tudo e recomeçar
```cmd
rmdir /s /q server\node_modules
rmdir /s /q client\node_modules
rmdir /s /q node_modules
setup.bat
```

## 🌐 URLs Importantes

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **tRPC Endpoint**: http://localhost:3001/trpc
- **Health Check**: http://localhost:3001/health
- **Perfil de Teste**: http://localhost:5173/player/player123

## 💡 Dicas

1. **Use PowerShell ou CMD como Administrador** para evitar problemas de permissão
2. **Adicione PostgreSQL ao PATH** para facilitar comandos
3. **Configure o antivírus** para não bloquear o Node.js
4. **Use Drizzle Studio** para visualizar o banco:
   ```cmd
   cd server
   npx drizzle-kit studio
   ```

## 📚 Próximos Passos

Após o setup:
1. ✅ Execute `start.bat`
2. ✅ Acesse http://localhost:5173
3. ✅ (Opcional) Execute `add-test-data.bat`
4. ✅ Acesse http://localhost:5173/player/player123

## 🆘 Ainda com Problemas?

1. Verifique os logs no terminal
2. Confira se todas as dependências estão instaladas
3. Certifique-se de que PostgreSQL está rodando
4. Verifique o arquivo `server\.env`

---

**Boa sorte! 🎮**
