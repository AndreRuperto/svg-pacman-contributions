@echo off
echo ====================================
echo  Pac-Man Ranking - Setup
echo ====================================
echo.

REM 1. Criar banco de dados
echo [1/7] Criando banco de dados...
createdb pacman_ranking
if %errorlevel% neq 0 (
    echo AVISO: Nao foi possivel criar o banco. Talvez ja exista.
    echo Continuando...
)
echo.

REM 2. Instalar dependencias do servidor
echo [2/7] Instalando dependencias do servidor...
cd server
call npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias do servidor
    pause
    exit /b 1
)
echo.

REM 3. Copiar .env
echo [3/7] Configurando variaveis de ambiente...
if not exist .env (
    copy .env.example .env
    echo.
    echo IMPORTANTE: Edite o arquivo server\.env com suas credenciais do PostgreSQL
    echo DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/pacman_ranking
    echo.
    echo Pressione qualquer tecla apos editar o .env...
    pause
)
echo.

REM 4. Rodar migrations
echo [4/7] Criando tabelas no banco de dados...
call npx drizzle-kit push
if %errorlevel% neq 0 (
    echo ERRO: Falha ao criar tabelas
    cd ..
    pause
    exit /b 1
)
echo.

REM 5. Seed das badges
echo [5/7] Populando badges iniciais...
call npx tsx src/db/seed.ts
if %errorlevel% neq 0 (
    echo ERRO: Falha ao popular badges
    cd ..
    pause
    exit /b 1
)
echo.

REM 6. Instalar dependencias do cliente
echo [6/7] Instalando dependencias do cliente...
cd ..\client
call npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias do cliente
    cd ..
    pause
    exit /b 1
)
echo.

REM 7. Instalar concurrently na raiz
echo [7/7] Instalando ferramentas adicionais...
cd ..
call npm install
echo.

echo ====================================
echo  Setup concluido com sucesso!
echo ====================================
echo.
echo Proximos passos:
echo 1. Execute: npm run dev
echo 2. Acesse: http://localhost:5173
echo.
echo (Opcional) Para adicionar dados de teste:
echo   psql -U postgres -d pacman_ranking -f server\test-data.sql
echo.
pause
