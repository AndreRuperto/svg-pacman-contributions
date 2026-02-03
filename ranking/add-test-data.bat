@echo off
echo ====================================
echo  Adicionando dados de teste...
echo ====================================
echo.

psql -U postgres -d pacman_ranking -f server\test-data.sql

if %errorlevel% equ 0 (
    echo.
    echo ====================================
    echo  Dados de teste adicionados!
    echo ====================================
    echo.
    echo Usuarios criados:
    echo - player123
    echo - speedrunner
    echo - ghost_hunter_99
    echo.
    echo Acesse: http://localhost:5173/player/player123
) else (
    echo.
    echo ERRO: Falha ao adicionar dados
    echo.
    echo Verifique se:
    echo 1. PostgreSQL esta rodando
    echo 2. O banco 'pacman_ranking' existe
    echo 3. Suas credenciais estao corretas
)
echo.
pause
