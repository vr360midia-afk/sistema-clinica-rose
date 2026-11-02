import https from 'https';

const SUPABASE_URL = 'https://skonxcdojbkbfnfemayz.supabase.co';
const ANON_KEY = 'sb_publishable_aldVR3R-4sj0Fs-l1-mFSA_9gPUF9YZ';

function checkEndpoint(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}${path}`;
    const req = https.request(url, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('VALIDAÇÃO DE PRODUÇÃO — ETAPA 1 (SUPABASE skonxcdojbkbfnfemayz)');
  console.log('================================================================\n');

  console.log('1. Verificando integridade e acessibilidade dos módulos existentes:');
  const docCheck = await checkEndpoint('/rest/v1/documentos_clinicos?select=id&limit=1');
  console.log(`   - documentos_clinicos: HTTP ${docCheck.status} ${docCheck.status === 200 ? '✓ DISPONÍVEL' : '✗ ERRO'}`);

  const pacCheck = await checkEndpoint('/rest/v1/pacientes?select=id&limit=1');
  console.log(`   - pacientes: HTTP ${pacCheck.status} ${pacCheck.status === 200 ? '✓ DISPONÍVEL' : '✗ ERRO'}`);

  const orcCheck = await checkEndpoint('/rest/v1/orcamentos?select=id&limit=1');
  console.log(`   - orcamentos: HTTP ${orcCheck.status} ${orcCheck.status === 200 ? '✓ DISPONÍVEL' : '✗ ERRO'}`);

  console.log('\n2. Verificando aplicação da Migration de Contratos (20261102_blindagem_seguranca_v3.sql):');
  const authTableCheck = await checkEndpoint('/rest/v1/autorizacoes_assinatura_profissional?select=id&limit=1');
  const filaTableCheck = await checkEndpoint('/rest/v1/fila_arquivamento_pdf?select=id&limit=1');
  const histTableCheck = await checkEndpoint('/rest/v1/historico_autorizacoes_assinatura?select=id&limit=1');

  const authAplicada = authTableCheck.status === 200;
  const filaAplicada = filaTableCheck.status === 200;
  const histAplicada = histTableCheck.status === 200;

  console.log(`   - autorizacoes_assinatura_profissional: HTTP ${authTableCheck.status} ${authAplicada ? '✓ APLICADA' : '⏳ PENDENTE DE EXECUÇÃO NO SUPABASE'}`);
  console.log(`   - fila_arquivamento_pdf: HTTP ${filaTableCheck.status} ${filaAplicada ? '✓ APLICADA' : '⏳ PENDENTE DE EXECUÇÃO NO SUPABASE'}`);
  console.log(`   - historico_autorizacoes_assinatura: HTTP ${histTableCheck.status} ${histAplicada ? '✓ APLICADA' : '⏳ PENDENTE DE EXECUÇÃO NO SUPABASE'}`);

  if (authAplicada && filaAplicada && histAplicada) {
    console.log('\n================================================================');
    console.log('STATUS ETAPA 1: CONCLUÍDA COM SUCESSO EM PRODUÇÃO!');
    console.log('================================================================');
  } else {
    console.log('\n================================================================');
    console.log('STATUS ETAPA 1: AGUARDANDO EXECUÇÃO DO SQL NO SUPABASE');
    console.log('================================================================');
  }
}

run().catch(console.error);

