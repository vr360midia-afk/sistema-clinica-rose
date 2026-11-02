@echo off
echo =======================================================
echo Publicando Edge Function orcamento-publico no Supabase
echo Projeto: skonxcdojbkbfnfemayz
echo =======================================================
echo.
echo Caso solicite login, sera aberto o navegador para autenticar.
echo.
npx supabase functions deploy orcamento-publico --project-ref skonxcdojbkbfnfemayz --no-verify-jwt
echo.
pause

