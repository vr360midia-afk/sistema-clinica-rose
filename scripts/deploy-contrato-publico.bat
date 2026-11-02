@echo off
setlocal
cd /d "%~dp0.."
echo =======================================================
echo Publicando Edge Function contrato-publico no Supabase
echo Projeto: skonxcdojbkbfnfemayz
echo Diretorio: %CD%
echo =======================================================
echo.

echo Verificando login no Supabase...
call npx supabase projects list >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Voce precisa autenticar no Supabase.
    echo O navegador sera aberto para autorizar a CLI...
    echo.
    call npx supabase login
)

echo.
echo Iniciando deploy da Edge Function contrato-publico...
echo.
call npx supabase functions deploy contrato-publico --project-ref skonxcdojbkbfnfemayz --no-verify-jwt

echo.
echo =======================================================
if %errorlevel% equ 0 (
    echo DEPLOY CONCLUIDO COM SUCESSO!
) else (
    echo OCORREU UM ERRO NO DEPLOY. Verifique a mensagem acima.
)
echo =======================================================
echo.
pause
