import { execSync } from 'child_process';
import * as fs from 'fs';

const PROD_REF = 'skonxcdojbkbfnfemayz';

async function main() {
  console.log('================================================================');
  console.log('🔍 AUDITORIA SOMENTE-LEITURA PÓS-DEPLOY EM PRODUÇÃO');
  console.log(`Projeto: ${PROD_REF}`);
  console.log('================================================================\n');

  let allPassed = true;
  function assert(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`✅ [AUDITORIA-PROD-PASS] ${title}`);
    } else {
      console.error(`❌ [AUDITORIA-PROD-FAIL] ${title}`);
      if (details) console.error('   Detalhes:', details);
      allPassed = false;
    }
  }

  // 1. Confirma existência das funções e triggers criados
  console.log('--- 1. VERIFICAÇÃO DE FUNÇÕES E TRIGGERS NO POSTGRESQL ---');
  const funcsCmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('agendar_consulta_extensao', 'validar_conflito_consulta_trigger');"`;
  const funcsRaw = execSync(funcsCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const funcsMatch = funcsRaw.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  const funcs = funcsMatch ? JSON.parse(funcsMatch[0]).rows : [];

  const hasRpc = funcs.some((f: any) => f.proname === 'agendar_consulta_extensao' && f.prosecdef === true);
  const hasTrgFunc = funcs.some((f: any) => f.proname === 'validar_conflito_consulta_trigger' && f.prosecdef === true);

  assert(hasRpc, 'Função RPC agendar_consulta_extensao criada com SECURITY DEFINER');
  assert(hasTrgFunc, 'Função de trigger validar_conflito_consulta_trigger criada com SECURITY DEFINER');

  const trgCmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT tgname, tgenabled, relname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE tgname = 'trg_validar_conflito_consulta';"`;
  const trgRaw = execSync(trgCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const trgMatch = trgRaw.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  const triggers = trgMatch ? JSON.parse(trgMatch[0]).rows : [];

  assert(
    triggers.length > 0 && triggers[0].relname === 'consultas' && triggers[0].tgenabled === 'O',
    'Trigger trg_validar_conflito_consulta ativo e habilitado na tabela consultas'
  );

  // 2. Confirma preservação estrita das políticas RLS em produção
  console.log('\n--- 2. INTEGRIDADE DAS POLÍTICAS RLS ORIGINAIS ---');
  const polCmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('consultas', 'bloqueios_agenda', 'dentistas', 'crm_leads');"`;
  const polRaw = execSync(polCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const polMatch = polRaw.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  const policies = polMatch ? JSON.parse(polMatch[0]).rows : [];

  const hasConsultasRLS = policies.some((p: any) => p.tablename === 'consultas' && p.policyname === 'Consultas RLS');
  const hasBloqueiosRLS = policies.some((p: any) => p.tablename === 'bloqueios_agenda' && p.policyname === 'Bloqueios RLS');
  const hasDentistasRLS = policies.some((p: any) => p.tablename === 'dentistas' && p.policyname === 'Dentistas RLS');
  const hasLeadsRLS = policies.some((p: any) => p.tablename === 'crm_leads' && p.policyname === 'Acesso total aos leads');

  assert(hasConsultasRLS, 'Política original "Consultas RLS" intacta');
  assert(hasBloqueiosRLS, 'Política original "Bloqueios RLS" intacta');
  assert(hasDentistasRLS, 'Política original "Dentistas RLS" intacta');
  assert(hasLeadsRLS, 'Política original "Acesso total aos leads" intacta');

  // 3. Verificação de Integridade dos Dados Existentes comparados ao Backup Pré-Deploy
  console.log('\n--- 3. COMPARATIVO DE CONTAGEM DE DADOS PRÉ E PÓS DEPLOY ---');
  const tables = ['consultas', 'bloqueios_agenda', 'dentistas', 'crm_leads', 'equipe'];
  for (const t of tables) {
    const backupData = JSON.parse(fs.readFileSync(`backup/pre-deploy-extensao-v2/${t}.json`, 'utf-8'));
    const countCmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT count(*) as total FROM public.${t};"`;
    const countRaw = execSync(countCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const countMatch = countRaw.match(/\{[\s\S]*"rows"[\s\S]*\}/);
    const prodCount = countMatch ? Number(JSON.parse(countMatch[0]).rows[0].total) : -1;

    assert(
      prodCount === backupData.length,
      `Tabela ${t}: contagem idêntica ao backup (${prodCount} = ${backupData.length})`,
      { prodCount, backupCount: backupData.length }
    );
  }

  // 4. Verificação de integridade dos Contratos e Documentos Clínicos
  console.log('\n--- 4. INTEGRIDADE DOS CONTRATOS E ORÇAMENTOS ---');
  const contractCmd = `npx supabase db query --remote=${PROD_REF} --read-only "SELECT id, identificador, itens->>'versao' as versao, itens->'financeiro'->>'total' as total, jsonb_array_length(itens->'versoesAnteriores') as historico_count FROM public.documentos_clinicos WHERE identificador = 'CTR-CCCE6389';"`;
  const contractRaw = execSync(contractCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const contractMatch = contractRaw.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  const contractRows = contractMatch ? JSON.parse(contractMatch[0]).rows : [];

  if (contractRows.length > 0) {
    const c = contractRows[0];
    assert(
      c.identificador === 'CTR-CCCE6389' && c.versao === '2.0' && c.total === '6050' && c.historico_count === 1,
      'Contrato oficial CTR-CCCE6389 permanece 100% íntegro (v2.0, R$ 6.050,00, histórico v1.0 intacto)',
      c
    );
  } else {
    assert(false, 'Contrato CTR-CCCE6389 não localizado');
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('🎉 AUDITORIA PÓS-DEPLOY 100% APROVADA: PRODUÇÃO TOTALMENTE ÍNTEGRA!');
  } else {
    console.error('⛔ FALHAS IDENTIFICADAS NA AUDITORIA PÓS-DEPLOY.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

main().catch(console.error);

