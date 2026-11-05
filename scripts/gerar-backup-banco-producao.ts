import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const PROD_REF = 'skonxcdojbkbfnfemayz';
const BACKUP_DIR = path.resolve(process.cwd(), 'supabase/backups/prod-backup-20261105-5915a53');

function runDbQuery(sql: string): any[] {
  const sanitizedSql = sql.replace(/"/g, '\"');
  const cmd = `npx supabase db query --remote=${PROD_REF} --read-only --output=json "${sanitizedSql}"`;
  const raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  
  // Extract JSON payload from CLI output
  const jsonMatch = raw.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Falha ao parsear saída do comando para a query: ${sql}\nSaída: ${raw}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.rows || [];
}

function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function sha256File(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('=============================================================================');
  console.log('GERAÇÃO DE BACKUP RESTAURÁVEL DO BANCO DE PRODUÇÃO');
  console.log(`Projeto: ${PROD_REF} (sistema-clinica)`);
  console.log(`Destino: ${BACKUP_DIR}`);
  console.log('=============================================================================\n');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const tables = ['orcamentos', 'pacientes', 'documentos_clinicos', 'equipe', 'user_roles', 'configuracoes'];
  const tableData: Record<string, any[]> = {};

  for (const tbl of tables) {
    console.log(`[1/4] Extraindo dados da tabela public.${tbl}...`);
    const rows = runDbQuery(`SELECT * FROM public.${tbl};`);
    tableData[tbl] = rows;
    fs.writeFileSync(path.join(BACKUP_DIR, `${tbl}.json`), JSON.stringify(rows, null, 2), 'utf-8');
    console.log(`  ✓ ${rows.length} registros extraídos e salvos em ${tbl}.json`);
  }

  console.log('\n[2/4] Extraindo políticas RLS atuais de public.orcamentos...');
  const policies = runDbQuery(`SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'orcamentos';`);
  fs.writeFileSync(path.join(BACKUP_DIR, 'pg_policies_orcamentos.json'), JSON.stringify(policies, null, 2), 'utf-8');
  console.log(`  ✓ ${policies.length} políticas capturadas e salvas em pg_policies_orcamentos.json`);

  console.log('\n[3/4] Gerando script SQL unificado de restauração (restaurar_banco_producao.sql)...');
  let sqlScript = `-- =============================================================================\n`;
  sqlScript += `-- SCRIPT DE RESTAURAÇÃO COMPLETA DO BANCO DE PRODUÇÃO (CLÍNICA ROSÂNGELA)\n`;
  sqlScript += `-- Gerado em: ${new Date().toISOString()}\n`;
  sqlScript += `-- Base de commit: 5915a53\n`;
  sqlScript += `-- Projeto Supabase: ${PROD_REF}\n`;
  sqlScript += `-- =============================================================================\n\n`;

  sqlScript += `BEGIN;\n\n`;

  // Políticas prévias
  sqlScript += `-- 1. RESTAURAÇÃO DAS POLÍTICAS RLS ORIGINAIS DE ORCAMENTOS\n`;
  sqlScript += `DROP POLICY IF EXISTS "orcamentos_select_clinica" ON public.orcamentos;\n`;
  sqlScript += `DROP POLICY IF EXISTS "orcamentos_insert_clinica" ON public.orcamentos;\n`;
  sqlScript += `DROP POLICY IF EXISTS "orcamentos_update_admin" ON public.orcamentos;\n`;
  sqlScript += `DROP POLICY IF EXISTS "orcamentos_update_equipe_proposta" ON public.orcamentos;\n`;
  sqlScript += `DROP POLICY IF EXISTS "orcamentos_delete_admin" ON public.orcamentos;\n`;
  sqlScript += `DROP POLICY IF EXISTS "Orcamentos RLS" ON public.orcamentos;\n\n`;

  for (const pol of policies) {
    const rolesStr = typeof pol.roles === 'string' 
      ? pol.roles.replace(/[\{\}]/g, '') 
      : (Array.isArray(pol.roles) ? pol.roles.join(', ') : 'public');
    const qualStr = pol.qual ? `USING (${pol.qual})` : '';
    const checkStr = pol.with_check ? `WITH CHECK (${pol.with_check})` : '';
    sqlScript += `CREATE POLICY "${pol.policyname}" ON public.orcamentos FOR ${pol.cmd} TO ${rolesStr} ${qualStr} ${checkStr};\n`;
  }

  sqlScript += `\n-- 2. RESTAURAÇÃO DE DADOS DAS TABELAS\n`;

  for (const tbl of tables) {
    const rows = tableData[tbl];
    if (rows.length === 0) continue;

    sqlScript += `\n-- Tabela public.${tbl} (${rows.length} registros)\n`;
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map(c => escapeSqlValue(row[c]));
      const updateSets = cols.filter(c => c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

      sqlScript += `INSERT INTO public.${tbl} (${cols.map(c => `"${c}"`).join(', ')})\n`;
      sqlScript += `VALUES (${vals.join(', ')})\n`;
      if (row.id) {
        sqlScript += `ON CONFLICT (id) DO UPDATE SET ${updateSets};\n`;
      } else {
        sqlScript += `ON CONFLICT DO NOTHING;\n`;
      }
    }
  }

  sqlScript += `\nCOMMIT;\n`;
  sqlScript += `NOTIFY pgrst, 'reload schema';\n`;

  const sqlFilePath = path.join(BACKUP_DIR, 'restaurar_banco_producao.sql');
  fs.writeFileSync(sqlFilePath, sqlScript, 'utf-8');
  console.log(`  ✓ Script SQL de restauração gerado com sucesso (${(sqlScript.length / 1024).toFixed(2)} KB)`);

  console.log('\n[4/4] Calculando hashes criptográficos SHA-256 de integridade...');
  const manifest: Record<string, { bytes: number; sha256: string }> = {};
  const files = fs.readdirSync(BACKUP_DIR);

  for (const f of files) {
    const fp = path.join(BACKUP_DIR, f);
    const stat = fs.statSync(fp);
    const hash = sha256File(fp);
    manifest[f] = { bytes: stat.size, sha256: hash };
    console.log(`  ${f}: ${stat.size} bytes | SHA-256: ${hash}`);
  }

  fs.writeFileSync(path.join(BACKUP_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n=============================================================================');
  console.log('BACKUP DO BANCO DE PRODUÇÃO CONCLUÍDO COM SUCESSO ABSOLUTO!');
  console.log(`Diretório: ${BACKUP_DIR}`);
  console.log('=============================================================================');
}

main().catch(err => {
  console.error('\n✗ Erro ao gerar backup:', err);
  process.exit(1);
});
