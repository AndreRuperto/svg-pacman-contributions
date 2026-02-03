@echo off
echo ====================================
echo  Adicionando dados de teste...
echo  (Banco Railway)
echo ====================================
echo.

psql "postgresql://postgres:MZKLSNQhkCCJMMUOdiIjhvkflyEPyeLF@yamabiko.proxy.rlwy.net:19024/railway" -f server\test-data.sql

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
    echo 1. PostgreSQL client esta instalado
    echo 2. A conexao com Railway esta funcionando
    echo 3. O banco esta acessivel
)
echo.
pause
