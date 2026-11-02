@echo off
chcp 65001 > nul
echo ==============================================================================
echo EXECUCAO DE BACKUP DO BANCO SUPABASE (CLI v3.0.0)
echo Projeto: sistema-clinica (skonxcdojbkbfnfemayz)
echo ==============================================================================

if not exist "backups\db" mkdir "backups\db"

echo.
echo [1/4] Exportando Schema Completo (tabelas, triggers, RLS, functions)...
call npx supabase db dump --remote=skonxcdojbkbfnfemayz --schema=public -f backups\db\backup_schema_public.sql
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao exportar schema public. Verifique se o login foi realizado com 'npx supabase login' ou se o token SUPABASE_ACCESS_TOKEN foi informado.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Exportando Dados Operacionais (schema public com use-copy)...
call npx supabase db dump --remote=skonxcdojbkbfnfemayz --schema=public --data-only --use-copy -f backups\db\backup_data_public.sql

echo.
echo [3/4] Exportando Dados de Autenticacao (schema auth)...
call npx supabase db dump --remote=skonxcdojbkbfnfemayz --schema=auth --data-only -f backups\db\backup_data_auth.sql

echo.
echo [4/4] Exportando Roles e Permissoes do Cluster...
call npx supabase db dump --remote=skonxcdojbkbfnfemayz --role-only -f backups\db\backup_roles.sql

echo.
echo ==============================================================================
echo BACKUP DO BANCO CONCLUIDO COM SUCESSO EM backups\db\
echo ==============================================================================
pause

