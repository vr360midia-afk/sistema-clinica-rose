@echo off
echo =======================================================
echo Publicando Edge Function agenda-sync no Supabase
echo Projeto: skonxcdojbkbfnfemayz
echo =======================================================
echo.
echo Caso solicite login, sera aberto o navegador para autenticar.
echo.
npx supabase functions deploy agenda-sync --project-ref skonxcdojbkbfnfemayz
echo.
pause
