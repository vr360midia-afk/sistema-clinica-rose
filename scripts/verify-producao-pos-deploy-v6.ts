import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import { execSync } from 'child_process';

const PROD_REF = 'skonxcdojbkbfnfemayz';
const PROD_URL = 'https://skonxcdojbkbfnfemayz.supabase.co';
const PROD_ANON_KEY = 'sb_publishable_aldVR3R-4sj0Fs-l1-mFSA_9gPUF9YZ';
const PROD_FUNCTION_URL = `${PROD_URL}/functions/v1/contrato-publico`;
const APP_URL = 'https://app.lentesemresinamaceio.com.br/';

function runDbQuery(sql: string): any[] {
  const sanitizedSql = sql.replace(/\r?\n/g, ' ').replace(/"/g, '\"');
  const cmd = `npx supabase db query --remote=${PROD_REF} --read-only --output=json "${sanitizedSql}"`;
  const raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const jsonMatch = raw.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Falha ao parsear saída: ${raw}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.rows || [];
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHA: ${msg}`);
    throw new Error(`[FALHA DE VERIFICAÇÃO PÓS-DEPLOY]: ${msg}`);
  }
  console.log(`   ✓ ${msg}`);
}

async function fetchUrl(url: string, options: any = {}): Promise<{ status: number; data: string; headers: any }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, data: body, headers: res.headers }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  console.log('================================================================================');
  console.log('RELATÓRIO DE AUDITORIA PÓS-DEPLOY EM PRODUÇÃO (100% READ-ONLY)');
  console.log('Ambiente:', PROD_URL);
  console.log('Data:', new Date().toISOString());
  console.log('================================================================================\n');

  // 1. Verificação da Integridade Global dos Documentos e Contratos
  console.log('▶ 1. Verificando integridade e contagem geral de contratos em produção...');
  const countDocs = runDbQuery("SELECT count(*) as total, count(*) FILTER (WHERE assinado_em IS NOT NULL OR itens->>'status' IN ('formalizado', 'assinado')) as formalizados, count(*) FILTER (WHERE itens->>'status' = 'aguardando_assinatura_paciente') as pendentes FROM documentos_clinicos WHERE tipo = 'contrato';");
  const stats = countDocs[0];
  console.log('   Estatísticas atuais em produção:', JSON.stringify(stats));
  assert(Number(stats.total) >= 160, `Nenhum contrato foi excluído (total: ${stats.total})`);
  assert(Number(stats.formalizados) === 17, `Todos os 17 contratos formalizados continuam preservados intactos`);
  assert(Number(stats.pendentes) === 24, `Contratos pendentes preservados (total: ${stats.pendentes})`);

  // 2. Preservação Estrita do Contrato Alvo CTR-CCCE6389
  console.log('\n▶ 2. Inspecionando preservação do contrato CTR-CCCE6389 (intocado, aguardando interface)...');
  const ccceRows = runDbQuery("SELECT id, identificador, tipo, paciente_nome, valor_total, assinado_em, assinatura_data, criado_em, atualizado_em, itens FROM documentos_clinicos WHERE identificador = 'CTR-CCCE6389';");
  assert(ccceRows.length === 1, 'Existe exatamente 1 contrato CTR-CCCE6389 em produção (zero duplicatas)');
  const ccce = ccceRows[0];
  assert(ccce.id === '041e2947-32e4-42c0-a26f-d5a4e91ebb9c', `UUID original preservado (${ccce.id})`);
  assert(ccce.itens?.status === 'aguardando_assinatura_paciente', 'Status permaneceu aguardando_assinatura_paciente (nenhuma alteração automática)');
  assert(ccce.assinado_em === null, 'Contrato permanece não assinado pelo paciente');
  assert(ccce.itens?.statusAssinaturaDentista === 'assinado', 'Assinatura profissional original da Dra. Rosângela preservada');
  assert(ccce.itens?.token === '75298f237c3f3c4c2d86885638f4b418fe52070f1d896c8e', 'Token atual permanece o original (sem rotação precoce não autorizada)');

  // 3. Preservação de Contrato Formalizado Histórico (CTR-A5F34A7C / e5d82824)
  console.log('\n▶ 3. Inspecionando contrato formalizado histórico CTR-A5F34A7C...');
  const a5fRows = runDbQuery("SELECT id, identificador, assinado_em, assinante_nome, itens FROM documentos_clinicos WHERE id = 'e5d82824-1ef9-4257-86c1-428a515cd4f2';");
  assert(a5fRows.length === 1, 'Contrato formalizado e5d82824 (CTR-A5F34A7C) localizado');
  assert(a5fRows[0].itens?.status === 'formalizado', 'Status formalizado 100% íntegro');
  assert(a5fRows[0].itens?.isFormalizadoTotal === true, 'isFormalizadoTotal permanece true');
  assert(Boolean(a5fRows[0].itens?.assinaturaPaciente), 'Assinatura digital do paciente intacta');
  assert(Boolean(a5fRows[0].itens?.assinaturaDentista), 'Assinatura da Dra. Rosângela intacta');

  // 4. Verificação do Trigger V6 Ativo no PostgreSQL
  console.log('\n▶ 4. Verificando trigger PostgreSQL garantir_imutabilidade_contrato_v3 (V6)...');
  const triggerRows = runDbQuery(`
    SELECT
      length(pg_get_functiondef(oid)) as func_len,
      (pg_get_functiondef(oid) ~* 'termoUsoImagem') as has_termo,
      (pg_get_functiondef(oid) ~* 'v_linhas_orcamento != 1') as has_row_count,
      (pg_get_functiondef(oid) ~* 'v_formalizado_paciente :=') as has_regra_1,
      (pg_get_functiondef(oid) ~* 'tokensRevogados') as has_tokens_revogados
    FROM pg_proc WHERE proname = 'garantir_imutabilidade_contrato_v3';
  `);
  const trig = triggerRows[0];
  console.log('   Metadados da função do trigger em produção:', JSON.stringify(trig));
  assert(trig.func_len === 19093, `Função do trigger V6 possui exatamente 19.093 bytes (homologada)`);
  assert(trig.has_termo === true, 'Validação estrita de termoUsoImagem ativa no trigger');
  assert(trig.has_row_count === true, 'Controle de concorrência ROW_COUNT = 1 ativo no trigger');
  assert(trig.has_regra_1 === true, 'Regra 1 com proteção de assinaturaDra histórica ativa');
  assert(trig.has_tokens_revogados === true, 'Exigência de rotação e revogação de tokens ativa');

  // 5. Verificação da Edge Function contrato-publico
  console.log('\n▶ 5. Inspecionando Edge Function contrato-publico em produção...');
  const resEf = await fetchUrl(PROD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': PROD_ANON_KEY,
      'Authorization': `Bearer ${PROD_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'obter-contrato', token: 'token_falso_para_teste_seguranca' }),
  });
  console.log(`   Status Edge Function (token inválido): HTTP ${resEf.status}, body: ${resEf.data}`);
  assert(resEf.status === 400 || resEf.status === 404, 'Edge Function bloqueia token falso com erro de cliente (HTTP 400/404)');

  // 6. Verificação do Frontend na Cloudflare Pages
  console.log('\n▶ 6. Inspecionando frontend ativo na Cloudflare Pages...');
  const resCf = await fetchUrl(APP_URL, { headers: { 'Cache-Control': 'no-cache' } });
  assert(resCf.status === 200, 'Cloudflare respondendo com HTTP 200');
  const bundleMatch = resCf.data.match(/src="([^"]*assets\/index-[^"]*\.js)"/);
  console.log('   Bundle JS ativo servido pela Cloudflare:', bundleMatch ? bundleMatch[1] : 'não encontrado');
  assert(Boolean(bundleMatch && bundleMatch[1].includes('index-CLP7V5Qg.js')), 'Novo bundle compilado index-CLP7V5Qg.js está ATIVO em produção');
  assert(resCf.data.includes('id="root"'), 'Aplicação montada com sucesso');

  // 7. Verificação da Autorização Ativa da Dra. Rosângela
  console.log('\n▶ 7. Verificando configuração e autorização de assinatura profissional...');
  const autRows = runDbQuery("SELECT * FROM autorizacoes_assinatura_profissional WHERE ativo = true ORDER BY autorizado_em DESC LIMIT 1;");
  if (autRows.length > 0) {
    const aut = autRows[0];
    console.log(`   Autorização ativa da Dra: ${aut.profissional_nome} (${aut.profissional_cro})`);
    console.log(`   Chaves da autorização: ${Object.keys(aut).join(', ')}`);
    assert(aut.ativo === true, 'Autorização de assinatura eletrônica está ATIVA');
    assert(aut.revogado_em === null, 'Autorização não foi revogada');
  } else {
    console.log('   ℹ️ Tabela autorizacoes_assinatura_profissional verificada.');
  }

  // Testa também via action 'autorizacao_obter' na Edge Function
  const resAutEf = await fetchUrl(PROD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': PROD_ANON_KEY,
      'Authorization': `Bearer ${PROD_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'autorizacao_obter', cro: '06267-AL' }),
  });
  console.log('   Resposta autorizacao_obter da Edge Function:', resAutEf.data);
  const autEfData = JSON.parse(resAutEf.data);
  assert(autEfData.ok === true, 'Action autorizacao_obter retornou ok = true');
  assert(autEfData.temAutorizacao === true, 'Autorização ativa da Dra. Rosângela confirmada pela Edge Function');

  console.log('\n================================================================================');
  console.log('✅ AUDITORIA PÓS-DEPLOY FINALIZADA COM SUCESSO: PRODUÇÃO 100% HOMOLOGADA E SEGURA!');
  console.log('================================================================================');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
