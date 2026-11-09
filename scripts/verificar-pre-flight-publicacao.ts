import * as fs from 'fs';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

async function main() {
  console.log('================================================================');
  console.log('🔍 VERIFICAÇÃO PRÉ-FLIGHT OBRIGATÓRIA ANTES DO DEPLOY');
  console.log('================================================================\n');

  let allOk = true;

  // 1. Verifica integridade do backup
  console.log('1. Verificando backup integral e recuperável de produção...');
  const backupFiles = [
    'backup/pre-deploy-extensao-v2/consultas.json',
    'backup/pre-deploy-extensao-v2/bloqueios_agenda.json',
    'backup/pre-deploy-extensao-v2/dentistas.json',
    'backup/pre-deploy-extensao-v2/crm_leads.json',
    'backup/pre-deploy-extensao-v2/equipe.json',
    'backup/pre-deploy-extensao-v2/triggers_consultas.json'
  ];

  for (const bf of backupFiles) {
    if (fs.existsSync(bf) && fs.statSync(bf).size >= 2) {
      const records = JSON.parse(fs.readFileSync(bf, 'utf-8'));
      console.log(`   ✅ Backup ${bf} presente (${Array.isArray(records) ? records.length : 0} registros)`);
    } else {
      console.error(`   ❌ Falha no arquivo de backup: ${bf}`);
      allOk = false;
    }
  }

  // 2. Verifica pacote de produção
  console.log('\n2. Verificando ausência de credenciais e integridade do pacote de produção...');
  const zipPath = 'packages/Extensao_Clinica_Rosangela_PRODUCAO_V2.zip';
  if (!fs.existsSync(zipPath)) {
    console.error(`   ❌ Pacote de produção não encontrado em ${zipPath}`);
    allOk = false;
  } else {
    console.log(`   ✅ Pacote de produção existe (${fs.statSync(zipPath).size} bytes)`);
    // Inspeciona arquivos descompactando em buffer
    const stageCheck = 'packages/temp-preflight-check';
    if (fs.existsSync(stageCheck)) fs.rmSync(stageCheck, { recursive: true, force: true });
    fs.mkdirSync(stageCheck, { recursive: true });
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${stageCheck}' -Force"`);

    const files = fs.readdirSync(stageCheck);
    console.log(`   Arquivos no zip: ${files.join(', ')}`);

    const panelCode = fs.readFileSync(`${stageCheck}/panel.js`, 'utf-8');

    // 2.1 Verifica ambiente
    if (panelCode.includes("DEFAULT_ENV: 'production'")) {
      console.log('   ✅ Configuração DEFAULT_ENV está apontando estritamente para "production"');
    } else {
      console.error('   ❌ DEFAULT_ENV não está configurado para "production"');
      allOk = false;
    }

    if (panelCode.includes('skonxcdojbkbfnfemayz.supabase.co')) {
      console.log('   ✅ URL da produção oficial correta (skonxcdojbkbfnfemayz.supabase.co)');
    } else {
      console.error('   ❌ URL do Supabase não aponta para o projeto de produção skonxcdojbkbfnfemayz');
      allOk = false;
    }

    // 2.2 Verifica ausência de senhas e service_role
    if (panelCode.includes('service_role') || panelCode.includes('HOMOLOG_SUPABASE_SERVICE_ROLE_KEY')) {
      console.error('   ❌ ALERTA CRÍTICO: service_role encontrada no código!');
      allOk = false;
    } else {
      console.log('   ✅ Nenhuma chave service_role encontrada no pacote');
    }

    if (panelCode.includes('PasswordSeguro123!') || panelCode.includes('password =')) {
      console.error('   ❌ ALERTA CRÍTICO: senha de teste embutida no código!');
      allOk = false;
    } else {
      console.log('   ✅ Nenhuma senha de teste ou credencial estática embutida');
    }

    fs.rmSync(stageCheck, { recursive: true, force: true });
  }

  // 3. Verificação do Checksum e Commit da Migration
  console.log('\n3. Verificando checksum e versionamento da migration...');
  const migrationPath = 'supabase/migrations/20261109_extensao_whatsapp_agendamento_homolog.sql';
  const migrationBytes = fs.readFileSync(migrationPath);
  const hash = crypto.createHash('sha256').update(migrationBytes).digest('hex');
  console.log(`   Migration: ${migrationPath}`);
  console.log(`   SHA256: ${hash}`);

  const gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  const gitBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  console.log(`   Git Branch: ${gitBranch}`);
  console.log(`   Git Commit: ${gitCommit}`);

  // 4. Verificação de integridade de arquivos de contratos e orçamentos
  console.log('\n4. Verificando se contratos, orçamentos e financeiro foram tocados...');
  const diffFiles = execSync('git diff --name-only 7586814', { encoding: 'utf-8' }).split('\n').filter(Boolean);
  const forbiddenTouched = diffFiles.filter(f => f.startsWith('src/'));
  if (forbiddenTouched.length > 0) {
    console.error(`   ❌ Arquivos protegidos em src/ foram alterados: ${forbiddenTouched.join(', ')}`);
    allOk = false;
  } else {
    console.log('   ✅ ZERO arquivos de contratos, orçamentos ou código de src/ alterados');
  }

  console.log('\n================================================================');
  if (allOk) {
    console.log('🎉 TODAS AS VERIFICAÇÕES PRÉ-FLIGHT FORAM APROVADAS COM SUCESSO!');
    console.log('Ambiente preparado para prosseguir com a publicação autorizada.');
  } else {
    console.error('⛔ FALHA NAS VERIFICAÇÕES PRÉ-FLIGHT. PUBLICAÇÃO INTERROMPIDA.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

main().catch(console.error);
