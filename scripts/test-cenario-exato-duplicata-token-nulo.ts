import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';

validarAmbienteHomologacao(HOMOLOG_URL, 'Teste Cenário Exato Duplicata e Token Nulo');

async function testarCenarioExato() {
  console.log('================================================================================');
  console.log('TESTE DO CASO REAL DE PRODUÇÃO: RECUPERAÇÃO DE TOKEN EM DOCUMENTO IRMÃO');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('================================================================================\n');

  const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const testSuffix = Date.now().toString().slice(-6);
  const pacienteId = crypto.randomUUID();
  const pacienteNome = `Dieg Duracenski Teste ${testSuffix}`;

  await supabase.from('pacientes').insert({
    id: pacienteId,
    nome: pacienteNome,
    cpf: `123.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-00`,
    rg: '1234567 SSP/AL',
    telefone: '(82) 99999-8888',
    email: `dieg.${testSuffix}@teste.com.br`,
    endereco: 'Rua de Teste, 100, Maceió - AL, CEP 57000-000',
  });

  const orcamentoId = crypto.randomUUID();
  const contratoId = `CTR-TESTE${testSuffix}`;
  const validToken = crypto.randomBytes(24).toString('hex');

  // Cria orçamento com contrato_token
  await supabase.from('orcamentos').insert({
    id: orcamentoId,
    paciente_id: pacienteId,
    status: 'aprovado',
    total: 4050,
    valor_total: 4050,
    contrato_id: contratoId,
    contrato_token: validToken,
    itens: [{ id: '1', nome: 'Lentes Resina', quantidade: 1, valor: 4050 }],
  });

  // DOCUMENTO 1: Criado primeiro, com TOKEN VÁLIDO
  const doc1Id = crypto.randomUUID();
  await supabase.from('documentos_clinicos').insert({
    id: doc1Id,
    paciente_id: pacienteId,
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    identificador: contratoId,
    titulo: `Contrato Odontológico - ${pacienteNome} (${contratoId})`,
    criado_em: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    itens: {
      contratoId,
      orcamentoId,
      token: validToken,
      status: 'aguardando_assinatura_paciente',
      paciente: {
        nome: pacienteNome,
        cpf: `123.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-00`,
        telefone: '(82) 99999-8888',
        endereco: 'Rua de Teste, 100, Maceió - AL, CEP 57000-000',
      },
    },
  });

  // DOCUMENTO 2: Criado depois (ex: via salvarDocumento do modal), com TOKEN NULL!
  const doc2Id = crypto.randomUUID();
  await supabase.from('documentos_clinicos').insert({
    id: doc2Id,
    paciente_id: pacienteId,
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    identificador: null, // Na produção estava null!
    titulo: `Contrato Odontológico - Orçamento #${contratoId.replace('CTR-', '')}`,
    criado_em: new Date().toISOString(),
    itens: {
      contratoId,
      orcamentoId,
      token: null, // TOKEN NULL EXATAMENTE COMO NO CASO DE PRODUÇÃO!
      status: 'aguardando_assinatura_paciente',
      paciente: {
        nome: pacienteNome,
        cpf: `123.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-00`,
        telefone: '(82) 99999-8888',
        endereco: 'Rua de Teste, 100, Maceió - AL, CEP 57000-000',
      },
    },
  });

  console.log(`Documento 1 (com token): ${doc1Id}`);
  console.log(`Documento 2 (sem token - aberto no frontend): ${doc2Id}`);
  console.log(`Token válido compartilhado: ${validToken.slice(0, 6)}...`);

  let passed = 0;
  let failed = 0;
  function assert(cond: boolean, desc: string, detail?: string) {
    if (cond) {
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${desc}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // TESTE 1: Ação 'get' chamando diretamente pelo doc2Id (que tem token: null) mas com o token válido do link
  console.log('\n--- TESTE 1: Ação "get" buscando ID sem token usando o token do link ---');
  const { data: resGet, error: errGet } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: doc2Id, token: validToken },
  });
  assert(!errGet && resGet?.ok, 'Ação get autorizada com sucesso via resolução de irmão', errGet?.message || resGet?.error);

  // TESTE 2: Ação 'get' com token errado (deve ser estritamente bloqueado com 403)
  console.log('\n--- TESTE 2: Ação "get" com token corrompido/inválido ---');
  const { data: resGetWrong, error: errGetWrong } = await supabase.functions.invoke('contrato-publico', {
    body: { action: 'get', id: doc2Id, token: 'token_falso_123456789012345678' },
  });
  const blockedWrong = (errGetWrong as any)?.context?.status === 403 || (errGetWrong as any)?.status === 403 || resGetWrong?.error?.includes('Token');
  assert(blockedWrong, 'Acesso com token inválido categoricamente bloqueado (403)');

  // TESTE 3: Ação 'sign' enviando doc2Id e token válido (Cenário que falhava em produção!)
  console.log('\n--- TESTE 3: Ação "sign" com doc2Id e token válido (Caso que falhava em produção) ---');
  const mockSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const { data: resSign, error: errSign } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'sign',
      id: doc2Id,
      token: validToken,
      signature: mockSignature,
      signerName: pacienteNome,
      signerInfo: {
        cpf: `123.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-00`,
        email: `dieg.${testSuffix}@teste.com.br`,
      },
    },
  });

  assert(!errSign && resSign?.ok, 'Assinatura do paciente confirmada com sucesso pelo backend!', errSign?.message || resSign?.error);

  // TESTE 4: Verificar persistência no banco
  console.log('\n--- TESTE 4: Verificação no banco de dados ---');
  const { data: docAssinado } = await supabase.from('documentos_clinicos').select('*').eq('id', resSign?.documentoId || doc1Id).single();
  assert(Boolean(docAssinado?.assinado_em), 'Coluna assinado_em preenchida com timestamp oficial');
  assert(docAssinado?.itens?.token === validToken, 'Token preservado no documento assinado para validações futuras');

  // TESTE 5: Tentativa de reassinatura deve retornar jaAssinado: true sem fallbacks
  console.log('\n--- TESTE 5: Bloqueio de reassinatura ---');
  const { data: resReassinar } = await supabase.functions.invoke('contrato-publico', {
    body: {
      action: 'sign',
      id: doc2Id,
      token: validToken,
      signature: mockSignature,
      signerName: pacienteNome,
    },
  });
  assert(resReassinar?.jaAssinado === true, 'Bloqueio de reassinatura ativo com jaAssinado: true');

  // LIMPEZA
  console.log('\n--- LIMPEZA: Removendo registros do teste específico ---');
  await supabase.from('documentos_clinicos').delete().in('id', [doc1Id, doc2Id]);
  await supabase.from('orcamentos').delete().eq('id', orcamentoId);
  await supabase.from('pacientes').delete().eq('id', pacienteId);
  console.log('  ✓ Dados de teste limpos com sucesso.');

  console.log('\n================================================================================');
  console.log(`RESULTADO DO CENÁRIO EXATO: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('================================================================================');

  if (failed > 0) process.exit(1);
}

testarCenarioExato().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
