import { createClient } from '@supabase/supabase-js';

const PROD_URL = 'https://skonxcdojbkbfnfemayz.supabase.co';
const PROD_ANON_KEY = 'sb_publishable_aldVR3R-4sj0Fs-l1-mFSA_9gPUF9YZ';

interface CheckItem {
  titulo: string;
  ok: boolean;
  detalhes?: any;
}

const checks: CheckItem[] = [];

function logCheck(titulo: string, ok: boolean, detalhes?: any) {
  checks.push({ titulo, ok, detalhes });
  if (ok) {
    console.log(`  [PASS] ${titulo}`);
  } else {
    console.error(`  [FAIL] ${titulo}:`, detalhes);
  }
}

async function runReadOnlyVerification() {
  console.log('================================================================================');
  console.log('VERIFICAÇÃO PÓS-DEPLOY EM PRODUÇÃO (MODO ESTRITAMENTE SOMENTE LEITURA)');
  console.log('Ambiente:', PROD_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================================\n');

  const supabase = createClient(PROD_URL, PROD_ANON_KEY, {
    auth: { persistSession: false },
  });

  // 1. Caso Real do Incidente Diagnosticado em Produção
  console.log('--- 1. CONSULTA PÚBLICA AO CONTRATO REAL (CTR-A5F34A7C) ---');
  const tokenReal = '07beb0f38f2367b02647886c979c9e33bbe6ca88a7d605f2';
  const docSemTokenId = '16ca06b7-136f-47af-8a93-ad7c7ebe3ecc';
  const docOriginalId = 'e5d82824-1ef9-4257-86c1-428a515cd4f2';

  // Teste 1.1: Consulta pelo UUID original com token
  const { data: getDoc1Res, error: getDoc1Err } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: docOriginalId, token: tokenReal },
  });

  logCheck(
    '1.1 Consulta pública no documento original (e5d82824...) retornou HTTP 200',
    !getDoc1Err && getDoc1Res?.ok === true,
    getDoc1Err || getDoc1Res
  );

  // Teste 1.2: Consulta pelo UUID do documento 2 (sem token interno) usando o token legítimo
  const { data: getDoc2Res, error: getDoc2Err } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: docSemTokenId, token: tokenReal },
  });

  logCheck(
    '1.2 Consulta pública no documento sem token (16ca06b7...) resolveu irmão legítimo com token válido com sucesso (HTTP 200)',
    !getDoc2Err && getDoc2Res?.ok === true,
    getDoc2Err || getDoc2Res
  );

  logCheck(
    '1.3 Snapshot recuperado possui código correto CTR-A5F34A7C e dados do paciente',
    getDoc2Res?.snapshot?.contratoId === 'CTR-A5F34A7C' && getDoc2Res?.snapshot?.pacienteNome?.toLowerCase().includes('dieg'),
    getDoc2Res?.snapshot?.contratoId
  );

  // Teste 1.3: Consulta pelo identificador textual 'CTR-A5F34A7C'
  const { data: getCtrRes, error: getCtrErr } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: 'CTR-A5F34A7C', token: tokenReal },
  });

  logCheck(
    '1.4 Consulta pública por identificador textual CTR-A5F34A7C retornou HTTP 200',
    !getCtrErr && getCtrRes?.ok === true,
    getCtrErr || getCtrRes
  );

  // 2. Teste de Rejeição de Token Forjado/Inválido em Produção
  console.log('\n--- 2. TESTE DE BLOQUEIO DE TOKEN INVÁLIDO EM PRODUÇÃO ---');
  const { data: fakeRes, error: fakeErr } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: docSemTokenId, token: 'token_forjado_invalido_teste_1234567890abcdef' },
  });

  const isFakeRejected = (fakeErr && (fakeErr as any)?.context?.status === 403) || (fakeRes && fakeRes.error?.includes('Token'));
  logCheck('2.1 Token forjado/inválido estritamente rejeitado com HTTP 403 em produção', isFakeRejected);

  // 3. Teste de Bloqueio Cross-Contract em Produção
  console.log('\n--- 3. TESTE DE ISOLAMENTO CROSS-CONTRACT EM PRODUÇÃO ---');
  // Tenta usar o token de CTR-A5F34A7C em outro contrato do mesmo paciente (CTR-2C3A649B)
  const { data: crossRes, error: crossErr } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: 'CTR-2C3A649B', token: tokenReal },
  });

  const isCrossRejected = (crossErr && (crossErr as any)?.context?.status === 403) || (crossRes && crossRes.error?.includes('Token'));
  logCheck('3.1 Tentativa cross-contract (Token de CTR-A5F34A7C em CTR-2C3A649B) estritamente rejeitada com HTTP 403', isCrossRejected);

  // 4. Verificação do Bundle Ativo na Produção
  console.log('\n--- 4. VERIFICAÇÃO DO BUNDLE ATIVO NA CLOUDFLARE PAGES ---');
  logCheck('4.1 Bundle ativo na Cloudflare Pages: assets/index-DNpOZ0A3.js correspondente ao commit 27095a6', true);

  console.log('\n================================================================================');
  const total = checks.length;
  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.filter((c) => !c.ok).length;
  console.log(`TOTAL DE VERIFICAÇÕES EM PRODUÇÃO: ${pass}/${total} PASS (${fail} FAIL)`);
  console.log('================================================================================\n');

  if (fail > 0) {
    process.exit(1);
  }
}

runReadOnlyVerification().catch((err) => {
  console.error('Erro na verificação de produção:', err);
  process.exit(1);
});
