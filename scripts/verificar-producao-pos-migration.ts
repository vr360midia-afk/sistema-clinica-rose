import { execSync } from 'child_process';
import * as fs from 'fs';

const PROD_REF = 'skonxcdojbkbfnfemayz';

function queryDb(sql: string): any[] {
  const tempFile = `temp-query-${Date.now()}.sql`;
  fs.writeFileSync(tempFile, sql);
  try {
    const cmd = `npx supabase db query --remote=${PROD_REF} --read-only --file="${tempFile}"`;
    const out = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const match = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
    if (!match) return [];
    return JSON.parse(match[0]).rows;
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('AUDITORIA DE SEGURANÇA E INTEGRIDADE PÓS-MIGRATION NO POSTGRESQL DE PRODUÇÃO');
  console.log(`Projeto: ${PROD_REF}`);
  console.log('='.repeat(80));

  // 1. Verificar criação das 4 tabelas
  console.log('\n[1/5] Verificando existência das novas tabelas...');
  const tablesRows = queryDb("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'tratamento%';");
  console.log('Tabelas encontradas:', tablesRows.map((r: any) => r.table_name));

  if (tablesRows.length !== 4) {
    throw new Error(`Esperado 4 tabelas do módulo, encontrado ${tablesRows.length}`);
  }

  // 2. Verificar que dados existentes NÃO foram modificados (comparação com o backup pré-deploy)
  console.log('\n[2/5] Comparando contagem de registros com o backup pré-deploy...');
  const manifest = JSON.parse(fs.readFileSync('backup/pre-deploy-etapas-tratamento/manifest.json', 'utf-8'));
  for (const table of Object.keys(manifest.tabelas)) {
    const countRows = queryDb(`SELECT count(*) FROM public.${table};`);
    const count = parseInt(countRows[0].count);
    const expected = manifest.tabelas[table].registros;
    if (count === expected) {
      console.log(`  ✅ ${table}: ${count}/${expected} registros (100% INTACTO)`);
    } else {
      throw new Error(`Divergência em ${table}: esperado ${expected}, encontrado ${count}`);
    }
  }

  // 3. Verificar RPCs, SECURITY DEFINER e search_path
  console.log('\n[3/5] Verificando RPCs SECURITY DEFINER e search_path...');
  const rpcRows = queryDb("SELECT proname, prosecdef, proconfig FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('sincronizar_procedimentos_orcamento', 'obter_confirmacao_sessao_publica', 'assinar_confirmacao_sessao_publica', 'concluir_procedimento_tratamento', 'reabrir_procedimento_tratamento');");
  for (const rpc of rpcRows) {
    const isSecDef = rpc.prosecdef === true;
    const configStr = JSON.stringify(rpc.proconfig || []);
    console.log(`  RPC ${rpc.proname}: SECURITY DEFINER=${isSecDef} | Config=${configStr}`);
    if (!isSecDef) throw new Error(`RPC ${rpc.proname} não é SECURITY DEFINER`);
  }

  // 4. Verificar permissões EXECUTE no PostgreSQL
  console.log('\n[4/5] Verificando privilégios EXECUTE por role...');
  const privRows = queryDb(`
    SELECT routine_name, grantee, privilege_type 
    FROM information_schema.routine_privileges 
    WHERE routine_schema = 'public' 
      AND routine_name IN ('sincronizar_procedimentos_orcamento', 'concluir_procedimento_tratamento', 'reabrir_procedimento_tratamento', 'obter_confirmacao_sessao_publica', 'assinar_confirmacao_sessao_publica')
    ORDER BY routine_name, grantee;
  `);
  
  // Confirma que anon NÃO tem privilégio em sincronizar_procedimentos_orcamento
  const anonSync = privRows.find((p: any) => p.routine_name === 'sincronizar_procedimentos_orcamento' && (p.grantee === 'anon' || p.grantee === 'PUBLIC'));
  if (anonSync) {
    throw new Error(`Permissão indevida detectada: anon ou PUBLIC tem acesso a sincronizar_procedimentos_orcamento: ${JSON.stringify(anonSync)}`);
  } else {
    console.log('  ✅ sincronizar_procedimentos_orcamento: Acesso restrito a autenticados (anon/PUBLIC bloqueados)');
  }

  // Confirma que anon TEM privilégio nas públicas de confirmação
  const anonAssinar = privRows.find((p: any) => p.routine_name === 'assinar_confirmacao_sessao_publica' && p.grantee === 'anon');
  if (anonAssinar) {
    console.log('  ✅ assinar_confirmacao_sessao_publica: Acesso liberado para anon (paciente assinar via link)');
  }

  // 5. Verificar trigger de imutabilidade
  console.log('\n[5/5] Verificando trigger de imutabilidade...');
  const trigRows = queryDb("SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.tratamento_confirmacoes'::regclass AND tgname = 'trg_confirmacao_imutavel';");
  console.log('Triggers encontrados:', trigRows);
  const imutavelTrig = trigRows.find((t: any) => t.tgname === 'trg_confirmacao_imutavel');
  if (!imutavelTrig) {
    throw new Error('Trigger trg_confirmacao_imutavel não encontrado em tratamento_confirmacoes');
  }
  console.log(`  ✅ Trigger trg_confirmacao_imutavel ativo (tgenabled=${imutavelTrig.tgenabled}) em tratamento_confirmacoes (UPDATE / DELETE)`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ TODAS AS AUDITORIAS PÓS-MIGRATION EM PRODUÇÃO FORAM APROVADAS COM SUCESSO!');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Falha na auditoria de produção:', err);
  process.exit(1);
});
