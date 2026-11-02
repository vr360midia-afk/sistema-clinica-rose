import https from 'https';

const BASE_URL = 'https://skonxcdojbkbfnfemayz.supabase.co';

function requestPost(path: string, payload: any): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function requestGet(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(`${BASE_URL}${path}`, {
      method: 'GET'
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('VALIDAÇÃO DE PRODUÇÃO — ETAPA 2 (EDGE FUNCTION contrato-publico)');
  console.log('================================================================\n');

  console.log('1. Verificando conectividade básica da Edge Function:');
  const pingRes = await requestGet('/functions/v1/contrato-publico');
  console.log(`   - GET /functions/v1/contrato-publico: HTTP ${pingRes.status} (Esperado: 400 por falta de action)`);

  console.log('\n2. Verificando se a versão implantada inclui as novas ações (commit 659ae4e):');
  const actionCheck = await requestPost('/functions/v1/contrato-publico', { action: 'processar_fila_pdf' });
  const isNovaVersao = !actionCheck.body.includes('Ação não suportada');
  console.log(`   - POST action: 'processar_fila_pdf': HTTP ${actionCheck.status} | Resposta: ${actionCheck.body.trim()}`);
  console.log(`   - Status da versão: ${isNovaVersao ? '✓ NOVA VERSÃO DETECTADA NO AR' : '⏳ VERSÃO ANTIGA AINDA NO AR'}`);

  console.log('\n3. Verificando rota de consulta pública de contratos (ação get):');
  const getCheck = await requestPost('/functions/v1/contrato-publico', { action: 'get', contratoId: 'CTR-TESTE-VALIDACAO' });
  console.log(`   - POST action: 'get' (sem token): HTTP ${getCheck.status} | Resposta: ${getCheck.body.trim()}`);
  const rotasPreservadas = getCheck.status === 403;
  console.log(`   - Validação de segurança de tokens: ${rotasPreservadas ? '✓ ATIVA E SEGURA' : '✗ ANOMALIA'}`);

  console.log('\n================================================================');
  if (isNovaVersao && rotasPreservadas) {
    console.log('RESULTADO ETAPA 2: EDGE FUNCTION ATUALIZADA E OPERACIONAL (100%)');
  } else {
    console.log('RESULTADO ETAPA 2: AGUARDANDO DEPLOY DA EDGE FUNCTION');
  }
  console.log('================================================================');
}

run().catch(console.error);
