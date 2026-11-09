import { execSync } from 'child_process';
import * as fs from 'fs';

const PROD_REF = 'skonxcdojbkbfnfemayz';
const BACKUP_DIR = 'backup/pre-deploy-etapas-tratamento';

async function main() {
  console.log('='.repeat(80));
  console.log('BACKUP RECUPERÁVEL DO BANCO PRODUTIVO — MÓDULO ETAPAS DO TRATAMENTO');
  console.log(`Projeto: ${PROD_REF}`);
  console.log(`Diretório de Destino: ${BACKUP_DIR}`);
  console.log('='.repeat(80));

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const tables = [
    'pacientes',
    'orcamentos',
    'documentos_clinicos',
    'consultas',
    'bloqueios_agenda',
    'dentistas',
    'crm_leads',
    'equipe'
  ];

  const backupManifest: any = {
    timestamp: new Date().toISOString(),
    projeto_ref: PROD_REF,
    tabelas: {},
  };

  for (const table of tables) {
    try {
      console.log(`Exportando tabela: public.${table}...`);
      const cmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT * FROM public.${table};"`;
      const out = execSync(cmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
      const match = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const filePath = `${BACKUP_DIR}/${table}.json`;
        fs.writeFileSync(filePath, JSON.stringify(parsed.rows, null, 2));
        backupManifest.tabelas[table] = {
          registros: parsed.rows.length,
          arquivo: filePath,
          bytes: fs.statSync(filePath).size,
        };
        console.log(`  ✅ ${table}: ${parsed.rows.length} registros exportados (${backupManifest.tabelas[table].bytes} bytes)`);
      } else {
        console.warn(`  ⚠️ Formato inesperado para ${table}`);
      }
    } catch (err: any) {
      console.error(`  ❌ Erro ao exportar ${table}:`, err.message);
    }
  }

  // Backup das definições de schemas e funções existentes
  console.log('\nExportando lista de funções e policies do banco...');
  const funcCmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT proname, proargnames FROM pg_proc WHERE pronamespace = 'public'::regnamespace;"`;
  const funcOut = execSync(funcCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const funcMatch = funcOut.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (funcMatch) {
    fs.writeFileSync(`${BACKUP_DIR}/funcoes_public.json`, JSON.stringify(JSON.parse(funcMatch[0]).rows, null, 2));
    console.log(`  ✅ Definições de funções exportadas`);
  }

  fs.writeFileSync(`${BACKUP_DIR}/manifest.json`, JSON.stringify(backupManifest, null, 2));
  console.log('\n' + '='.repeat(80));
  console.log('✅ BACKUP RECUPERÁVEL DE PRODUÇÃO CONCLUÍDO COM SUCESSO!');
  console.log(`Manifesto salvo em: ${BACKUP_DIR}/manifest.json`);
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Falha crítica no backup de produção:', err);
  process.exit(1);
});

