@echo off
echo ====================================
echo  Pac-Man Ranking - Setup (Railway)
echo ====================================
echo.

REM 1. Instalar dependencias do servidor
echo [1/5] Instalando dependencias do servidor...
cd server
call npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias do servidor
    pause
    exit /b 1
)
echo.

REM 2. Rodar migrations
echo [2/5] Criando tabelas no banco de dados Railway...
call npx drizzle-kit push
if %errorlevel% neq 0 (
    echo ERRO: Falha ao criar tabelas
    cd ..
    pause
    exit /b 1
)
echo.

REM 3. Seed das badges
echo [3/5] Populando badges iniciais...
call npx tsx src/db/seed.ts
if %errorlevel% neq 0 (
    echo ERRO: Falha ao popular badges
    cd ..
    pause
    exit /b 1
)
echo.

REM 4. Instalar dependencias do cliente
echo [4/5] Instalando dependencias do cliente...
cd ..\client
call npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias do cliente
    cd ..
    pause
    exit /b 1
)
echo.

REM 5. Instalar concurrently na raiz
echo [5/5] Instalando ferramentas adicionais...
cd ..
call npm install
echo.

echo ====================================
echo  Setup concluido com sucesso!
echo ====================================
echo.
echo Banco Railway: yamabiko.proxy.rlwy.net:19024
echo.
echo Proximos passos:
echo 1. Execute: .\start.bat
echo 2. Acesse: http://localhost:5173
echo.
echo (Opcional) Para adicionar dados de teste:
echo   .\add-test-data-railway.bat
echo.
pause
