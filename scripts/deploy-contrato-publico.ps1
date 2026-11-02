Set-Location -Path "$PSScriptRoot\.."
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Publicando Edge Function contrato-publico no Supabase" -ForegroundColor Cyan
Write-Host "Projeto: skonxcdojbkbfnfemayz" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# Verifica se está autenticado
$check = npx supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nVoce precisa autenticar no Supabase. Abrindo login..." -ForegroundColor Yellow
    npx supabase login
}

Write-Host "`nIniciando deploy da Edge Function contrato-publico..." -ForegroundColor Green
npx supabase functions deploy contrato-publico --project-ref skonxcdojbkbfnfemayz --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCESSO] Deploy realizado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "`n[ERRO] Falha no deploy. Verifique as mensagens acima." -ForegroundColor Red
}

Read-Host -Prompt "Pressione ENTER para fechar"
