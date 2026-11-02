const https = require('https');

const anonKey = 'sb_publishable_aldVR3R-4sj0Fs-l1-mFSA_9gPUF9YZ';

function postEdge(endpoint, body, headers = {}) {
  const postData = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://skonxcdojbkbfnfemayz.supabase.co/functions/v1/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...headers,
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (c) => (resBody += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resBody), raw: resBody });
          } catch (e) {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ PASS: ${msg}`);
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exit(1);
  }
}

async function runTest() {
  console.log('================================================================');
  console.log('TESTE OBRIGATÓRIO: SESSÃO ANÔNIMA / INCOGNITO SEM LOGIN');
  console.log('Simulação de paciente sem JWT administrativo, sem cookies, sem localStorage');
  console.log('================================================================\n');

  const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
  const testCtr = `CTR-ANON${randomHex}`;
  const testToken = `tok_anon_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
  const pacienteNome = `Paciente Anonimo Teste ${randomHex}`;
  const valorTotal = 4500.00;

  console.log(`[ETAPA 1 & 2] Criação e persistência do contrato de teste no Supabase (${testCtr})...`);
  const saveRes = await postEdge('contrato-publico', {
    action: 'save',
    identificador: testCtr,
    token: testToken,
    pacienteNome,
    titulo: `Contrato Odontológico - ${pacienteNome} (${testCtr})`,
    html: `<h1>Contrato Odontológico</h1><p>Paciente: ${pacienteNome}</p><p>Valor: R$ 4.500,00</p>`,
    snapshot: {
      contratoId: testCtr,
      token: testToken,
      tokenValidoAte: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      status: 'aguardando_assinatura_paciente',
      pacienteNome,
      paciente: {
        nome: pacienteNome,
        cpf: '123.456.789-99',
        telefone: '82999998888',
      },
      clinica: {
        nome: 'Dra. Rosângela Santos Pereira Odontologia',
        dentistaResponsavel: 'Dra. Rosângela Santos Pereira',
        cro: '06267-AL',
      },
      financeiro: {
        valorTotal,
        formaPagamento: 'À Vista no PIX (com 10% de desconto)',
      },
      assinaturaDentista: {
        nome: 'Dra. Rosângela Santos Pereira',
        cro: '06267-AL',
        assinaturaData: 'RUBRICA_DIGITAL_AUTORIZADA',
        dataHora: new Date().toISOString(),
        metodo: 'assinatura_automatica_autorizada',
      },
    },
  }, { apikey: anonKey });

  assert(saveRes.status === 200, `Contrato persistido com sucesso via backend (HTTP ${saveRes.status})`);
  assert(saveRes.data?.ok === true, 'Confirmação ok: true da gravação no Supabase');
  assert(saveRes.data?.identificador === testCtr, `Identificador CTR persistido confere (${saveRes.data?.identificador})`);
  assert(saveRes.data?.token === testToken, 'Token criptográfico persistido confere');

  console.log('\n[ETAPA 3 & 4] Link do contrato gerado:');
  const linkPublico = `https://app.lentesemresinamaceio.com.br/contrato/${testCtr}?token=${testToken}`;
  console.log(`  Link: ${linkPublico}`);

  console.log('\n[ETAPA 5 & 6] Abertura do link em sessão 100% anônima (sem Authorization, sem cookies, sem localStorage)...');
  // Simula requisição pura de navegador anônimo apenas com apikey pública (ou sem nenhuma credencial de sessão)
  const getAnonRes = await postEdge('contrato-publico', {
    action: 'get',
    id: testCtr,
    token: testToken,
  }, { apikey: anonKey });

  assert(getAnonRes.status === 200, `Contrato recuperado com sucesso em sessão anônima (HTTP ${getAnonRes.status})`);
  assert(getAnonRes.data?.ok === true, 'Edge function validou o token e retornou ok: true');
  assert(getAnonRes.data?.snapshot?.contratoId === testCtr, 'Contrato recuperado tem o CTR correto');
  assert(getAnonRes.data?.snapshot?.paciente?.nome === pacienteNome, 'Contrato contém dados do paciente');
  assert(getAnonRes.data?.snapshot?.assinaturaDentista?.cro === '06267-AL', 'Assinatura autorizada da Dra. Rosângela Santos Pereira (CRO 06267-AL) presente');
  assert(getAnonRes.data?.jaAssinadoPaciente === false, 'Paciente com status inicial "Pendente de assinatura"');

  console.log('\n[ETAPA 7 & 8] Assinatura do paciente em sessão anônima...');
  const dataHoraIso = new Date().toISOString();

  // Formaliza a assinatura digital no backend (action: 'sign' registra assinado_em e formaliza)
  const signRes = await postEdge('contrato-publico', {
    action: 'sign',
    id: testCtr,
    token: testToken,
    signature: dataHoraIso,
    signerName: pacienteNome,
    signerInfo: {
      cpf: '123.456.789-99',
      ip: '189.40.120.35',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Anonymous/Incognito',
    },
    termoUsoImagem: {
      autorizado: true,
      usoDidaticoCientifico: true,
      usoPublicitarioRedesSociais: true,
    },
  }, { apikey: anonKey });

  assert(signRes.status === 200, `Assinatura salva com sucesso em sessão anônima (HTTP ${signRes.status})`);
  assert(signRes.data?.ok === true, 'Assinatura confirmada pelo Supabase');
  assert(signRes.data?.status === 'assinado' || signRes.data?.isFormalizadoTotal === true, 'Status atualizado para "formalizado" / "assinado"');

  console.log('\n[ETAPA 9 & 10] Reabertura do mesmo link em nova sessão anônima para testar bloqueio de reassinatura...');
  const reopenRes = await postEdge('contrato-publico', {
    action: 'get',
    id: testCtr,
    token: testToken,
  }, { apikey: anonKey });

  assert(reopenRes.status === 200, `Reabertura bem-sucedida (HTTP ${reopenRes.status})`);
  assert(reopenRes.data?.jaAssinadoPaciente === true, 'Reabertura detecta que o paciente já assinou anteriormente');
  assert(reopenRes.data?.assinadoEm !== null, 'Data e hora da assinatura registradas e preservadas');

  console.log('\n[TESTE DE SEGURANÇA] Tentativa de reassinatura após formalização...');
  const resignRes = await postEdge('contrato-publico', {
    action: 'sign',
    id: testCtr,
    token: testToken,
    signature: 'data:image/png;base64,TENTATIVA_REASSINATURA',
    signerName: 'Hacker / Terceiro',
  }, { apikey: anonKey });

  assert(
    resignRes.data?.jaAssinado === true || resignRes.data?.error?.includes('já assinado'),
    'Bloqueio estrito de reassinatura confirmado: Supabase rejeitou nova assinatura'
  );

  console.log('\n================================================================');
  console.log('RESULTADO FINAL: TODOS OS 10 PASSOS DO TESTE ANÔNIMO APROVADOS!');
  console.log('O contrato foi criado, persistido, aberto em aba anônima, assinado e protegido contra reassinatura.');
  console.log('================================================================');
}

runTest().catch((err) => {
  console.error('Erro na execução do teste:', err);
  process.exit(1);
});
