import { execSync } from 'child_process';
import * as fs from 'fs';

const PROD_REF = 'skonxcdojbkbfnfemayz';

async function main() {
  console.log('='.repeat(80));
  console.log('APLICAÇÃO CONTROLADA DA MIGRATION EM PRODUÇÃO');
  console.log(`Projeto: ${PROD_REF}`);
  console.log('='.repeat(80));

  const sqlPath = 'supabase/migrations/20261110_modulo_etapas_tratamento_homolog.sql';
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Grava em arquivo temporário para passar ao supabase db query
  const tempSql = 'temp-migration-prod-etapas.sql';
  fs.writeFileSync(tempSql, sql);

  try {
    const cmd = `npx supabase db query --remote=${PROD_REF} --yes --file="${tempSql}"`;
    const res = execSync(cmd, { encoding: 'utf-8' });
    console.log('Resultado da Execução:');
    console.log(res);
    console.log('✅ Migration aplicada com sucesso em PRODUÇÃO!');
  } finally {
    if (fs.existsSync(tempSql)) fs.unlinkSync(tempSql);
  }
}

main().catch(err => {
  console.error('Erro ao aplicar migration em produção:', err);
  process.exit(1);
});

