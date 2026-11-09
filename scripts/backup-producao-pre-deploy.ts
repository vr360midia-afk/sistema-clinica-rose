import { execSync } from 'child_process';
import * as fs from 'fs';

const PROD_REF = 'skonxcdojbkbfnfemayz';
const BACKUP_DIR = 'backup/pre-deploy-extensao-v2';

async function main() {
  console.log('=== REALIZANDO BACKUP RECUPERÁVEL DO BANCO PRODUTIVO ===');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const tables = ['consultas', 'bloqueios_agenda', 'dentistas', 'crm_leads', 'equipe'];
  for (const table of tables) {
    const cmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT * FROM public.${table};"`;
    const out = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const match = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const filePath = `${BACKUP_DIR}/${table}.json`;
      fs.writeFileSync(filePath, JSON.stringify(parsed.rows, null, 2));
      console.log(`✅ [BACKUP] Tabela ${table}: ${parsed.rows.length} registros exportados para ${filePath}`);
    } else {
      console.warn(`⚠️ Aviso ao extrair ${table}`);
    }
  }

  // Backup das definições de schemas e triggers existentes em consultas
  const triggersCmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_table = 'consultas';"`;
  const triggersOut = execSync(triggersCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const triggersMatch = triggersOut.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (triggersMatch) {
    fs.writeFileSync(`${BACKUP_DIR}/triggers_consultas.json`, JSON.stringify(JSON.parse(triggersMatch[0]).rows, null, 2));
    console.log(`✅ [BACKUP] Triggers de consultas exportados`);
  }

  console.log('\n✅ Backup concluído com sucesso em:', BACKUP_DIR);
}

main().catch(console.error);
