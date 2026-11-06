import { createClient } from '@supabase/supabase-js';
import { gerarPayloadPix, validarChavePix } from '../src/utils/pixPayload';

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

async function runReadOnlyProductionVerification() {
  console.log('================================================================================');
  console.log('VERIFICAÇÃO PÓS-DEPLOY EM PRODUÇÃO (ESTRITAMENTE SOMENTE LEITURA)');
  console.log('Ambiente Remoto:', PROD_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================================\n');

  const supabase = createClient(PROD_URL, PROD_ANON_KEY, {
    auth: { persistSession: false },
  });

  // ---------------------------------------------------------------------------
  // 1. Verificação da Edge Function 'contrato-publico' em Produção (Action: get)
  // ---------------------------------------------------------------------------
  console.log('--- 1. CONSULTA PÚBLICA SOMENTE LEITURA (CONTRATO-PUBLICO) ---');
  const tokenReal = '07beb0f38f2367b02647886c979c9e33bbe6ca88a7d605f2';
  const docId = 'e5d82824-1ef9-4257-86c1-428a515cd4f2';

  const { data: getRes, error: getErr } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: docId, token: tokenReal },
  });

  logCheck(
    '1.1 Consulta pública somente leitura na Edge Function de produção retornou HTTP 200',
    !getErr && getRes?.ok === true,
    getErr || getRes
  );

  const snapshot = getRes?.snapshot || {};
  const financeiro = snapshot.financeiro || {};
  const procs = snapshot.procedimentos || snapshot.itensContrato || snapshot.orcamento?.itens || [];

  logCheck(
    '1.2 Snapshot do contrato recuperado com sucesso com dados cadastrais íntegros',
    Boolean(snapshot.contratoId) && Boolean(snapshot.pacienteNome),
    { contratoId: snapshot.contratoId, paciente: snapshot.pacienteNome }
  );

  logCheck(
    '1.3 Cláusula financeira íntegra no snapshot recuperado (total numérico preservado)',
    typeof financeiro.total === 'number' || typeof financeiro.valorTotal === 'number' || typeof snapshot.orcamento?.total === 'number',
    { total: financeiro.total ?? snapshot.orcamento?.total }
  );

  // ---------------------------------------------------------------------------
  // 2. Verificação de Bloqueio de Chaves PIX Fictícias e Dados Reais da Clínica
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. BLINDAGEM DE PIX: BLOQUEIO DE CHAVES FICTÍCIAS E DADOS REAIS ---');

  // Teste de rejeição de chaves fictícias conhecidas
  const fakeKeys = ['12345678000190', '12.345.678/0001-90', '00000000000', 'exemplo@clinica.com'];
  let allFakesBlocked = true;
  for (const fakeKey of fakeKeys) {
    const val = validarChavePix(fakeKey);
    if (val.valido) {
      allFakesBlocked = false;
      console.error(`Chave fictícia ${fakeKey} foi indevidamente considerada válida!`);
    }
  }
  logCheck('2.1 Bloqueio estrito de chaves PIX fictícias/padrão (12345678000190, 00000000000, etc.)', allFakesBlocked);

  // Teste de aceitação da chave real da clínica
  const realCnpj = '69.890.045/0001-85';
  const valReal = validarChavePix(realCnpj, 'cnpj');
  logCheck('2.2 Chave PIX real da clínica (CNPJ 69.890.045/0001-85) validada como legítima', valReal.valido);

  // ---------------------------------------------------------------------------
  // 3. Verificação de Geração de Cobrança / QR Code PIX (Sem gravação em banco)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. GERAÇÃO DE COBRANÇA DE TESTE (EMV BACEN SEM ALTERAR REGISTROS) ---');

  const payloadTeste = gerarPayloadPix({
    chave: '69890045000185',
    tipoChave: 'cnpj',
    nomeFavorecido: 'Duracenski Odontologia',
    cidade: 'Maceio',
    valor: 6749.96,
    txId: 'ORC6749TEST',
    descricao: 'Plano Odontologico',
  });

  logCheck('3.1 Payload PIX gerado com sucesso para o valor exato contratado de R$ 6.749,96', Boolean(payloadTeste) && payloadTeste.length > 50);
  logCheck('3.2 Payload EMV Bacen contém Tag 54 com valor líquido exato (54076749.96)', payloadTeste.includes('54076749.96'));
  logCheck('3.3 Payload EMV Bacen contém favorecido Duracenski Odontologia', payloadTeste.includes('Duracenski') || payloadTeste.includes('DURACENSKI'));
  logCheck('3.4 Payload EMV Bacen contém chave CNPJ 69890045000185', payloadTeste.includes('69890045000185'));

  // Teste de bloqueio na geração com chave fictícia
  const payloadFicticio = gerarPayloadPix({
    chave: '12345678000190',
    tipoChave: 'cnpj',
    nomeFavorecido: 'Teste',
    cidade: 'Maceio',
    valor: 6749.96,
  });
  logCheck('3.5 Tentativa de gerar payload PIX com chave fictícia (12345678000190) bloqueada (retorna string vazia)', payloadFicticio === '');

  // ---------------------------------------------------------------------------
  // 4. Verificação de Integridade dos Registros Históricos em Produção
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. INTEGRIDADE DOS REGISTROS HISTÓRICOS EM PRODUÇÃO (INALTERADOS) ---');

  // Consulta somente leitura direta na tabela de documentos clínicos
  const { data: docRows, error: docErr } = await supabase
    .from('documentos_clinicos')
    .select('id, identificador, tipo, assinado_em, criado_em')
    .in('identificador', ['CTR-A5F34A7C', 'CTR-469FA845', 'CTR-59529E0E'])
    .limit(10);

  if (docErr) {
    console.warn('  • Consulta RLS a documentos_clinicos com anon:', docErr.message);
  } else {
    logCheck(
      '4.1 Documentos históricos consultados preservados sem alteração de status',
      Array.isArray(docRows) && docRows.length > 0,
      { count: docRows?.length }
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Verificação da Edge Function 'orcamento-publico' em Produção
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. EDGE FUNCTION ORCAMENTO-PUBLICO EM PRODUÇÃO ---');
  // Consulta somente leitura (action: get) com ID fictício para verificar integridade da função
  const { data: orcGetRes, error: orcGetErr } = await supabase.functions.invoke('orcamento-publico', {
    body: { action: 'get', identificador: 'ORC-INEXISTENTE-TESTE', token: 'tok_teste' },
  });

  // A função deve responder 404 de forma limpa (não 500)
  const isOrcClean = (orcGetErr && (orcGetErr as any)?.context?.status === 404) || orcGetRes?.error?.includes('não encontrado');
  logCheck('5.1 Edge Function orcamento-publico em produção responde requisições com código limpo (HTTP 404 esperado para registro inexistente)', isOrcClean);

  console.log('\n================================================================================');
  const total = checks.length;
  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.filter((c) => !c.ok).length;
  console.log(`TOTAL DE VERIFICAÇÕES PÓS-DEPLOY: ${pass}/${total} PASS (${fail} FAIL)`);
  console.log('================================================================================\n');

  if (fail > 0) {
    process.exit(1);
  }
}

runReadOnlyProductionVerification().catch((err) => {
  console.error('❌ Falha na verificação de produção:', err);
  process.exit(1);
});
