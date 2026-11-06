import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';

validarAmbienteHomologacao(HOMOLOG_URL, 'Bateria de Testes de Homologação: Segurança Estrita de Token e Anti-duplicação');

interface TestResult {
  nome: string;
  sucesso: boolean;
  detalhes?: string;
  esperado?: any;
  obtido?: any;
}

const resultados: TestResult[] = [];

function assert(condicao: boolean, nome: string, esperado?: any, obtido?: any) {
  if (condicao) {
    resultados.push({ nome, sucesso: true });
    console.log(`  [PASS] ${nome}`);
  } else {
    resultados.push({ nome, sucesso: false, esperado, obtido });
    console.error(`  [FAIL] ${nome}`);
    console.error(`         Esperado:`, esperado);
    console.error(`         Obtido:  `, obtido);
  }
}

async function extrairErroInvoke(res: any, err: any): Promise<{ status: number; error: string }> {
  let status = 200;
  let erro = res?.error || '';
  if (err) {
    const ctx = (err as any)?.context;
    if (ctx) {
      status = ctx.status || 500;
      try {
        const body = await ctx.clone().json();
        if (body?.error) erro = body.error;
      } catch (_) {
        try {
          erro = await ctx.clone().text();
        } catch (_) {}
      }
    }
    if (!erro) erro = err.message || '';
  }
  return { status, error: erro };
}

async function executarBateriaCompleta() {
  console.log('================================================================================');
  console.log('BATERIA DE TESTES DE SEGURANÇA ESTRITA DE TOKEN E ANTI-DUPLICAÇÃO');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('================================================================================\n');

  const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const testSuffix = Date.now().toString().slice(-6);
  const pacienteId = crypto.randomUUID();
  const pacienteNome = `Paciente Homolog ${testSuffix}`;

  // Cria paciente de teste
  const { error: errP } = await supabase.from('pacientes').insert({
    id: pacienteId,
    nome: pacienteNome,
    cpf: `111.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-99`,
    telefone: '(82) 98888-7777',
    endereco: 'Rua de Homologação, 500, Maceió - AL',
  });
  assert(!errP, '1. Paciente de homologação criado com sucesso no banco');

  // Paciente B (para teste de isolamento cross-patient)
  const pacienteIdB = crypto.randomUUID();
  const pacienteNomeB = `Paciente B ${testSuffix}`;
  await supabase.from('pacientes').insert({
    id: pacienteIdB,
    nome: pacienteNomeB,
    cpf: `222.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-88`,
    telefone: '(82) 97777-6666',
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 1: O CASO REAL DO INCIDENTE (Documento 1 com token, Documento 2 sem token)
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 1: O CASO REAL DO INCIDENTE (RECUPERAÇÃO DE IRMÃO VÁLIDO) ---');
  const orcamentoId1 = crypto.randomUUID();
  const contratoId1 = `CTR-REAL${testSuffix}`;
  const validToken1 = crypto.randomBytes(32).toString('hex');

  await supabase.from('orcamentos').insert({
    id: orcamentoId1,
    paciente_id: pacienteId,
    status: 'aprovado',
    total: 3500,
    valor_total: 3500,
    contrato_id: contratoId1,
    contrato_token: validToken1,
    itens: [{ id: '1', nome: 'Procedimento 1', valor: 3500 }],
  });

  // Doc 1 (Original criado com token)
  const doc1Id = crypto.randomUUID();
  await supabase.from('documentos_clinicos').insert({
    id: doc1Id,
    paciente_id: pacienteId,
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    identificador: contratoId1,
    titulo: `Contrato Odontológico - ${pacienteNome} (${contratoId1})`,
    criado_em: new Date(Date.now() - 5000).toISOString(),
    itens: {
      contratoId: contratoId1,
      orcamentoId: orcamentoId1,
      token: validToken1,
      financeiro: { total: 3500 },
      paciente: { nome: pacienteNome },
    },
  });

  // Doc 2 (Irmão sem token no JSON, aberto no modal)
  const doc2Id = crypto.randomUUID();
  await supabase.from('documentos_clinicos').insert({
    id: doc2Id,
    paciente_id: pacienteId,
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    identificador: contratoId1,
    titulo: `Contrato Odontológico - Orçamento #REAL${testSuffix}`,
    criado_em: new Date().toISOString(),
    itens: {
      contratoId: contratoId1,
      orcamentoId: orcamentoId1,
      token: null, // SEM TOKEN!
      financeiro: { total: 3500 },
      paciente: { nome: pacienteNome },
    },
  });

  // Testa Edge Function consultando doc2Id com validToken1
  const { data: getRes1, error: getErr1 } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: doc2Id, token: validToken1 },
  });

  assert(!getErr1 && getRes1?.ok === true, '1.1 Consulta pública no documento sem token (doc2Id) resolveu irmão com sucesso via Edge Function');
  assert(getRes1?.snapshot?.contratoId === contratoId1, '1.2 Snapshot recuperado pertence ao contrato correto', contratoId1, getRes1?.snapshot?.contratoId);

  // Testa assinatura no doc2Id usando validToken1
  const sigData1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const { data: signRes1, error: signErr1 } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'sign',
      id: doc2Id,
      token: validToken1,
      signature: sigData1,
      signerName: pacienteNome,
      signerInfo: { cpf: '111.000.000-00', email: 'paciente@teste.com' },
    },
  });

  assert(!signErr1 && signRes1?.ok === true, '1.3 Assinatura do paciente no documento sem token (doc2Id) foi confirmada com sucesso');

  // Verifica que re-assinatura é estritamente bloqueada
  const { data: reSignRes, error: reSignErr } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'sign',
      id: doc2Id,
      token: validToken1,
      signature: sigData1,
      signerName: pacienteNome,
    },
  });
  assert(reSignRes?.jaAssinado === true, '1.4 Re-assinatura do paciente é bloqueada com status jaAssinado: true');

  // ---------------------------------------------------------------------------
  // CENÁRIO 2: ISOLAMENTO ENTRE CONTRATOS DO MESMO PACIENTE (CROSS-CONTRACT)
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 2: ISOLAMENTO ENTRE CONTRATOS DO MESMO PACIENTE ---');
  const contratoId2 = `CTR-OUTRO${testSuffix}`;
  const validToken2 = crypto.randomBytes(32).toString('hex');
  const docOutroId = crypto.randomUUID();

  await supabase.from('documentos_clinicos').insert({
    id: docOutroId,
    paciente_id: pacienteId, // Mesmo paciente!
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    identificador: contratoId2,
    titulo: `Contrato Odontológico Outro - ${pacienteNome} (${contratoId2})`,
    itens: {
      contratoId: contratoId2,
      token: validToken2,
      financeiro: { total: 5000 },
      paciente: { nome: pacienteNome },
    },
  });

  // Tenta assinar Contrato 2 usando o Token do Contrato 1
  const { data: crossContratoRes, error: crossContratoErr } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'sign',
      id: docOutroId,
      token: validToken1, // TOKEN DO CONTRATO 1 SENDO USADO NO CONTRATO 2!
      signature: sigData1,
      signerName: pacienteNome,
    },
  });

  const errCross = await extrairErroInvoke(crossContratoRes, crossContratoErr);
  assert(
    errCross.status === 403 && errCross.error.includes('Token'),
    '2.1 Assinatura cross-contract BLOQUEADA: token do Contrato 1 NÃO pode assinar Contrato 2 do mesmo paciente (HTTP 403 + Token inválido)',
    'HTTP 403 + Token inválido',
    `HTTP ${errCross.status} - ${errCross.error}`
  );

  // ---------------------------------------------------------------------------
  // CENÁRIO 3: ISOLAMENTO ENTRE PACIENTES DISTINTOS (CROSS-PATIENT)
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 3: ISOLAMENTO ENTRE PACIENTES DISTINTOS ---');
  const contratoIdB = `CTR-PACB${testSuffix}`;
  const validTokenB = crypto.randomBytes(32).toString('hex');
  const docBId = crypto.randomUUID();

  await supabase.from('documentos_clinicos').insert({
    id: docBId,
    paciente_id: pacienteIdB, // Paciente B!
    paciente_nome: pacienteNomeB,
    tipo: 'contrato',
    identificador: contratoIdB,
    itens: {
      contratoId: contratoIdB,
      token: validTokenB,
      financeiro: { total: 2000 },
      paciente: { nome: pacienteNomeB },
    },
  });

  // Tenta acessar docBId usando validToken1 do Paciente A
  const { data: crossPacRes, error: crossPacErr } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: docBId, token: validToken1 },
  });

  const errCrossPac = await extrairErroInvoke(crossPacRes, crossPacErr);
  assert(
    errCrossPac.status === 403 && errCrossPac.error.includes('Token'),
    '3.1 Acesso cross-patient BLOQUEADO: token do Paciente A NÃO acessa contrato do Paciente B (HTTP 403)',
    'HTTP 403',
    `HTTP ${errCrossPac.status} - ${errCrossPac.error}`
  );

  // ---------------------------------------------------------------------------
  // CENÁRIO 4: DETECÇÃO DE AMBIGUIDADE (TOKENS DIVERGENTES)
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 4: DETECÇÃO E BLOQUEIO DE AMBIGUIDADE ---');
  const contratoIdAmb = `CTR-AMB${testSuffix}`;
  const tokenAmbA = crypto.randomBytes(32).toString('hex');
  const tokenAmbB = crypto.randomBytes(32).toString('hex');

  const docAmb1 = crypto.randomUUID();
  const docAmb2 = crypto.randomUUID();

  await supabase.from('documentos_clinicos').insert([
    {
      id: docAmb1,
      paciente_id: pacienteId,
      paciente_nome: pacienteNome,
      tipo: 'contrato',
      identificador: contratoIdAmb,
      itens: { contratoId: contratoIdAmb, token: tokenAmbA, financeiro: { total: 1000 } },
    },
    {
      id: docAmb2,
      paciente_id: pacienteId,
      paciente_nome: pacienteNome,
      tipo: 'contrato',
      identificador: contratoIdAmb,
      itens: { contratoId: contratoIdAmb, token: tokenAmbB, financeiro: { total: 1000 } },
    },
  ]);

  // Consulta por um documento irmão que não tenha token, tendo dois irmãos com tokens diferentes
  const docAmbSemToken = crypto.randomUUID();
  await supabase.from('documentos_clinicos').insert({
    id: docAmbSemToken,
    paciente_id: pacienteId,
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    identificador: contratoIdAmb,
    itens: { contratoId: contratoIdAmb, token: null, financeiro: { total: 1000 } },
  });

  const { data: ambRes, error: ambErr } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: docAmbSemToken, token: tokenAmbA },
  });

  const errAmb = await extrairErroInvoke(ambRes, ambErr);
  assert(
    errAmb.status === 403 && errAmb.error.toLowerCase().includes('ambiguidade'),
    '4.1 Ambiguidade detectada e bloqueada com sucesso quando múltiplos tokens divergentes competem (HTTP 403 + Ambiguidade)',
    'HTTP 403 com mensagem de ambiguidade',
    `HTTP ${errAmb.status} - ${errAmb.error}`
  );

  // ---------------------------------------------------------------------------
  // CENÁRIO 5: PREVENÇÃO DE DUPLICAÇÃO DE CONTRATOS (ANTI-DUPLICAÇÃO)
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 5: PREVENÇÃO DEFINITIVA DE NOVAS DUPLICIDADES ---');
  const contratoIdAntiDup = `CTR-ANTIDUP${testSuffix}`;
  const tokenAntiDup = crypto.randomBytes(32).toString('hex');

  // Primeira chamada via Edge Function (action: save)
  const { data: saveRes1, error: saveErr1 } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'save',
      identificador: contratoIdAntiDup,
      token: tokenAntiDup,
      pacienteId: pacienteId,
      pacienteNome: pacienteNome,
      snapshot: {
        contratoId: contratoIdAntiDup,
        token: tokenAntiDup,
        financeiro: { total: 6000 },
        paciente: { nome: pacienteNome },
      },
    },
  });

  assert(!saveErr1 && saveRes1?.ok === true, '5.1 Primeira emissão de contrato salva com sucesso');
  const idCriado = saveRes1?.id;

  // Segunda chamada simulando clique repetido em "Copiar Link" ou "Enviar WhatsApp"
  const { data: saveRes2, error: saveErr2 } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'save',
      id: contratoIdAntiDup,
      identificador: contratoIdAntiDup,
      pacienteId: pacienteId,
      pacienteNome: pacienteNome,
      snapshot: {
        contratoId: contratoIdAntiDup,
        token: tokenAntiDup,
        financeiro: { total: 6000 },
        paciente: { nome: pacienteNome },
      },
    },
  });

  assert(!saveErr2 && saveRes2?.ok === true, '5.2 Segunda chamada de save concluída com sucesso');
  assert(saveRes2?.id === idCriado, '5.3 Segunda chamada atualizou o registro existente em vez de criar um novo (id idêntico)', idCriado, saveRes2?.id);

  // Terceira chamada simulando salvarDocumento sem passar doc.id prévio
  const { data: contagemDocs } = await supabase
    .from('documentos_clinicos')
    .select('id')
    .eq('tipo', 'contrato')
    .eq('paciente_id', pacienteId)
    .filter('itens->>contratoId', 'eq', contratoIdAntiDup);

  assert(contagemDocs?.length === 1, '5.4 Exatamente 1 documento existe no banco para esta emissão (zero duplicatas criadas)', 1, contagemDocs?.length);

  // ---------------------------------------------------------------------------
  // CENÁRIO 6: TOKEN INVÁLIDO OU REVOGADO É REJEITADO
  // ---------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 6: REJEIÇÃO DE TOKEN INVÁLIDO ---');
  const fakeToken = crypto.randomBytes(32).toString('hex');
  const { data: fakeGetRes, error: fakeGetErr } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: idCriado, token: fakeToken },
  });

  const errFake = await extrairErroInvoke(fakeGetRes, fakeGetErr);
  assert(
    errFake.status === 403 && errFake.error.includes('Token'),
    '6.1 Token forjado/inválido rejeitado imediatamente com HTTP 403',
    'HTTP 403 + Token inválido',
    `HTTP ${errFake.status} - ${errFake.error}`
  );

  // ---------------------------------------------------------------------------
  // RESUMO FINAL
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  const total = resultados.length;
  const pass = resultados.filter((r) => r.sucesso).length;
  const fail = resultados.filter((r) => !r.sucesso).length;
  console.log(`RESUMO DA HOMOLOGAÇÃO: ${pass}/${total} PASS (${fail} FAIL)`);
  console.log('================================================================================');

  if (fail > 0) {
    process.exit(1);
  }
}

executarBateriaCompleta().catch((err) => {
  console.error('Erro fatal durante os testes de homologação:', err);
  process.exit(1);
});
