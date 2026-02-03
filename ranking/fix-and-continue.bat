@echo off
echo ====================================
echo  Corrigindo e continuando setup...
echo ====================================
echo.

REM Limpar node_modules do cliente
echo [1/3] Limpando instalacao anterior do cliente...
cd client
if exist node_modules (
    rmdir /s /q node_modules
)
if exist package-lock.json (
    del package-lock.json
)
echo.

REM Instalar dependencias do cliente
echo [2/3] Instalando dependencias do cliente (corrigidas)...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias do cliente
    cd ..
    pause
    exit /b 1
)
echo.

REM Instalar concurrently na raiz
echo [3/3] Instalando ferramentas adicionais...
cd ..
call npm install
echo.

echo ====================================
echo  Setup concluido com sucesso!
echo ====================================
echo.
echo Proximos passos:
echo 1. Execute: .\start.bat
echo 2. Acesse: http://localhost:5173
echo.
pause
