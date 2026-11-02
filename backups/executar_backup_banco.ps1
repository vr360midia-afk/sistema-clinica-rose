# ==============================================================================
# EXECUÇÃO DE BACKUP DO BANCO SUPABASE (CLI v3.0.0)
# Projeto: sistema-clinica (skonxcdojbkbfnfemayz)
# ==============================================================================

$ProjectRef = "skonxcdojbkbfnfemayz"
$DbDir = "backups/db"

if (!(Test-Path $DbDir)) {
    New-Item -ItemType Directory -Force -Path $DbDir | Out-Null
}

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "BACKUP DO BANCO SUPABASE (CLI v3.0.0) - PROJETO: $ProjectRef" -ForegroundColor Cyan
Write-Host "==============================================================================`n"

# 1. Schema Public
Write-Host "[1/4] Exportando Schema Completo (tabelas, triggers, RLS, functions)..." -ForegroundColor Yellow
npx supabase db dump --remote=$ProjectRef --schema=public -f "$DbDir/backup_schema_public.sql"

# 2. Dados Public
Write-Host "`n[2/4] Exportando Dados Operacionais (schema public)..." -ForegroundColor Yellow
npx supabase db dump --remote=$ProjectRef --schema=public --data-only --use-copy -f "$DbDir/backup_data_public.sql"

# 3. Dados Auth
Write-Host "`n[3/4] Exportando Dados de Autenticação (schema auth)..." -ForegroundColor Yellow
npx supabase db dump --remote=$ProjectRef --schema=auth --data-only -f "$DbDir/backup_data_auth.sql"

# 4. Roles
Write-Host "`n[4/4] Exportando Roles e Permissões do Cluster..." -ForegroundColor Yellow
npx supabase db dump --remote=$ProjectRef --role-only -f "$DbDir/backup_roles.sql"

Write-Host "`n==============================================================================" -ForegroundColor Green
Write-Host "ARQUIVOS DE BACKUP GERADOS COM SUCESSO EM: $DbDir" -ForegroundColor Green
Write-Host "=============================================================================="
Get-ChildItem -Path $DbDir | Select-Object Name, Length, LastWriteTime
