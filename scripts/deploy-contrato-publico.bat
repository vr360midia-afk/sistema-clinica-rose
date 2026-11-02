@echo off
cd /d "%~dp0.."
echo =======================================================
echo Publicando Edge Function contrato-publico no Supabase
echo Projeto: skonxcdojbkbfnfemayz
echo Diretorio de trabalho: %CD%
echo =======================================================
echo.
echo Caso solicite login, sera aberto o navegador para autenticar.
echo.
npx supabase functions deploy contrato-publico --project-ref skonxcdojbkbfnfemayz --no-verify-jwt
echo.
pause

