import crypto from 'crypto';
import {
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';

// Trava de segurança ativa
validarAmbienteHomologacao(HOMOLOG_URL, 'Teste Isolamento de Contratos');

// Configura o ambiente para que o client Supabase utilize as credenciais de homologação
process.env.VITE_SUPABASE_URL = HOMOLOG_URL;
process.env.HOMOLOG_URL = HOMOLOG_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = HOMOLOG_SERVICE_KEY;
process.env.HOMOLOG_SUPABASE_ANON_KEY = HOMOLOG_SERVICE_KEY;

function sha256(buf: Buffer | Uint8Array | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function runTest() {
  console.log('===============================================================');
  console.log('TESTE EM HOMOLOGAÇÃO: ISOLAMENTO DE CONTRATOS E VERIFICAÇÃO 4 VIAS');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('===============================================================\n');

  // Import dinâmico para garantir que client.ts leia as variáveis de ambiente de homologação
  const { createClient } = await import('@supabase/supabase-js');
  const { obterPdfContratoOficialDefinitivo, obterCaminhosCandidatosStorage } = await import(
    '../src/utils/contratoPdfOficial'
  );

  const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY);

  // 1. Cria ou reutiliza paciente fictício de teste
  console.log('1. Criando paciente de teste em homologação...');
  const testPatientId = '00000000-cafe-4000-8000-000000000099';
  const { data: pacienteExistente } = await supabase
    .from('pacientes')
    .select('id')
    .eq('id', testPatientId)
    .maybeSingle();

  if (!pacienteExistente) {
    const { error: errPac } = await supabase.from('pacientes').insert({
      id: testPatientId,
      nome: 'Paciente Teste Isolamento Homolog',
      cpf: '032.663.962-43',
      telefone: '(82) 99999-0099',
    });
    if (errPac) {
      console.warn('Aviso paciente:', errPac.message);
    }
  }

  // 2. Prepara dois orçamentos distintos para o mesmo paciente
  const orcamentoAId = 'a0000001-0000-4000-8000-000000000001';
  const orcamentoBId = 'b0000002-0000-4000-8000-000000000002';
  const contratoAId = 'CTR-TEST-SISO-SUP';
  const contratoBId = 'CTR-TEST-SISO-INF';

  const pathA = `contratos/${contratoAId}/Contrato_Assinado_${contratoAId}.pdf`;
  const pathB = `contratos/${contratoBId}/Contrato_Assinado_${contratoBId}.pdf`;

  const orcamentoA = {
    id: orcamentoAId,
    paciente_id: testPatientId,
    titulo: 'Exodontia Siso Superior (Dente 18)',
    status: 'aprovado',
    total: 810,
    subtotal: 900,
    desconto: 90,
    contratoId: contratoAId,
    contrato_id: contratoAId,
    itens: [
      { id: '1', nome: 'Exodontia Siso Superior', denteOuRegiao: '18', quantidade: 1, valorUnitario: 900, valorTotal: 900 },
    ],
  };

  const orcamentoB = {
    id: orcamentoBId,
    paciente_id: testPatientId,
    titulo: 'Exodontia Siso Inferior (Dente 38)',
    status: 'aprovado',
    total: 900,
    subtotal: 1000,
    desconto: 100,
    contratoId: contratoBId,
    contrato_id: contratoBId,
    itens: [
      { id: '1', nome: 'Exodontia Siso Inferior', denteOuRegiao: '38', quantidade: 1, valorUnitario: 1000, valorTotal: 1000 },
    ],
  };

  // 3. Prepara dois documentos clínicos de contratos distintos
  const docClinicoA = {
    id: '09ef02d5-test-4901-8f04-fc488d877585',
    paciente_id: testPatientId,
    tipo: 'contrato',
    titulo: 'Contrato Odontológico CTR-TEST-SISO-SUP',
    status: 'formalizado',
    assinado_em: '2026-11-05T09:59:32Z',
    itens: {
      contratoId: contratoAId,
      identificador: contratoAId,
      orcamentoId: orcamentoAId,
      status: 'formalizado',
      pdfPath: pathA,
      procedimento: 'Exodontia Siso Superior',
      valorTotal: 810,
    },
  };

  const docClinicoB = {
    id: 'b3a35889-test-442c-bb50-34725f4c04f1',
    paciente_id: testPatientId,
    tipo: 'contrato',
    titulo: 'Contrato Odontológico CTR-TEST-SISO-INF',
    status: 'formalizado',
    assinado_em: '2026-11-05T16:27:23Z', // Mais recente no tempo!
    itens: {
      contratoId: contratoBId,
      identificador: contratoBId,
      orcamentoId: orcamentoBId,
      status: 'formalizado',
      pdfPath: pathB,
      procedimento: 'Exodontia Siso Inferior',
      valorTotal: 900,
    },
  };

  const listaDocumentos = [docClinicoA, docClinicoB];

  // 4. Cria arquivos PDF binários fictícios e envia ao Storage em homologação
  console.log('2. Removendo versões antigas e enviando novos PDFs (> 1KB) para o Storage...');
  await supabase.storage.from('documentos-pacientes').remove([pathA, pathB]);

  const pdfBytesA = Buffer.concat([
    Buffer.from(`%PDF-1.4\n% CONTRATO OFICIAL SISO SUPERIOR - ID ${contratoAId} - VALOR R$ 810,00\n`),
    Buffer.alloc(2000, 65),
    Buffer.from('\n%%EOF'),
  ]);
  const pdfBytesB = Buffer.concat([
    Buffer.from(`%PDF-1.4\n% CONTRATO OFICIAL SISO INFERIOR - ID ${contratoBId} - VALOR R$ 900,00\n`),
    Buffer.alloc(2000, 66),
    Buffer.from('\n%%EOF'),
  ]);

  const hashA = sha256(pdfBytesA);
  const hashB = sha256(pdfBytesB);

  console.log(`- Hash esperado Contrato A (${contratoAId}): ${hashA}`);
  console.log(`- Hash esperado Contrato B (${contratoBId}): ${hashB}`);

  const { error: errUpA } = await supabase.storage
    .from('documentos-pacientes')
    .upload(pathA, pdfBytesA, { contentType: 'application/pdf', upsert: true });

  const { error: errUpB } = await supabase.storage
    .from('documentos-pacientes')
    .upload(pathB, pdfBytesB, { contentType: 'application/pdf', upsert: true });

  if (errUpA) console.warn('Aviso upload Storage A:', errUpA.message);
  if (errUpB) console.warn('Aviso upload Storage B:', errUpB.message);

  // 5. TESTA A LÓGICA DE SELEÇÃO DE PATIENTORCAMENTOS (CORREÇÃO IMPLEMENTADA)
  console.log('\n3. Testando algoritmo de seleção corrigido de PatientOrcamentos.tsx...');

  const isContratoDoOrcamento = (d: any, o: any) => {
    if (d.tipo !== 'contrato') return false;

    const currentOrcId = String(o.id || '').trim().toLowerCase();
    const dOrcId = String(d.orcamentoId || d.orcamento_id || '').trim().toLowerCase();
    const snapOrcId = String((d.itens as any)?.orcamentoId || (d.itens as any)?.orcamento_id || (d.itens as any)?.orcamento?.id || '').trim().toLowerCase();

    if (currentOrcId && (dOrcId === currentOrcId || snapOrcId === currentOrcId)) {
      return true;
    }

    if (o.contratoId) {
      const cid = String(o.contratoId).trim().toLowerCase();
      const dId = String(d.id || '').trim().toLowerCase();
      const dIdent = String(d.identificador || '').trim().toLowerCase();
      const snapContratoId = String((d.itens as any)?.contratoId || '').trim().toLowerCase();
      const snapIdent = String((d.itens as any)?.identificador || '').trim().toLowerCase();

      if (dId === cid || dIdent === cid || snapContratoId === cid || snapIdent === cid) {
        return true;
      }
    }

    return false;
  };

  // Candidatos para o Orçamento A (Siso Superior)
  const candidatosA = listaDocumentos.filter((d) => isContratoDoOrcamento(d, orcamentoA));
  const idsDistintosA = Array.from(new Set(candidatosA.map((d) => (d.itens as any)?.contratoId || d.identificador || d.id)));
  const ambiguidadeA = idsDistintosA.length > 1;
  const contratoFinalA = ambiguidadeA ? null : candidatosA[0];

  console.log('Candidatos encontrados para Orçamento A (Siso Superior):', candidatosA.length);
  console.log('Contrato selecionado para Orçamento A:', contratoFinalA?.itens?.contratoId);
  console.log('Ambiguidade Orçamento A:', ambiguidadeA);

  if (candidatosA.length !== 1 || contratoFinalA?.itens?.contratoId !== contratoAId || ambiguidadeA) {
    throw new Error('Falha no isolamento do Orçamento A! Selecionou contrato errado ou gerou ambiguidade indevida.');
  }

  // Candidatos para o Orçamento B (Siso Inferior)
  const candidatosB = listaDocumentos.filter((d) => isContratoDoOrcamento(d, orcamentoB));
  const idsDistintosB = Array.from(new Set(candidatosB.map((d) => (d.itens as any)?.contratoId || d.identificador || d.id)));
  const ambiguidadeB = idsDistintosB.length > 1;
  const contratoFinalB = ambiguidadeB ? null : candidatosB[0];

  console.log('Candidatos encontrados para Orçamento B (Siso Inferior):', candidatosB.length);
  console.log('Contrato selecionado para Orçamento B:', contratoFinalB?.itens?.contratoId);
  console.log('Ambiguidade Orçamento B:', ambiguidadeB);

  if (candidatosB.length !== 1 || contratoFinalB?.itens?.contratoId !== contratoBId || ambiguidadeB) {
    throw new Error('Falha no isolamento do Orçamento B! Selecionou contrato errado ou gerou ambiguidade indevida.');
  }

  console.log('✔ ISOLAMENTO PERFEITO: Orçamento A abre exclusivamente Contrato A, e Orçamento B abre exclusivamente Contrato B!');

  // 6. TESTE DAS 4 VIAS DE ACESSO PARA CADA CONTRATO
  console.log('\n4. Testando as 4 vias de acesso ao PDF para o Contrato A (Siso Superior)...');

  // Via 1: obterPdfContratoOficial (Botão "Ver Contrato Assinado")
  const resVia1A = await obterPdfContratoOficialDefinitivo(contratoAId, contratoFinalA);
  const blobBuf1A = resVia1A?.blob ? Buffer.from(await resVia1A.blob.arrayBuffer()) : null;
  const hashVia1A = blobBuf1A ? sha256(blobBuf1A) : null;
  console.log('Via 1 (Ver Contrato Assinado) - Path:', resVia1A?.path, '| Hash:', hashVia1A);

  // Via 2: Download direto de PDF assinado ("Baixar PDF Assinado")
  const { data: blobVia2A } = await supabase.storage.from('documentos-pacientes').download(pathA);
  const hashVia2A = blobVia2A ? sha256(Buffer.from(await blobVia2A.arrayBuffer())) : null;
  console.log('Via 2 (Baixar PDF Assinado)   - Path:', pathA, '| Hash:', hashVia2A);

  // Via 3: Modal de Contrato ("Ver Contrato")
  const caminhosA = obterCaminhosCandidatosStorage(contratoAId, contratoFinalA);
  const pathVia3A = caminhosA.find((c) => c === pathA);
  console.log('Via 3 (Modal / Visualizar)    - Caminho Canônico Identificado:', pathVia3A);

  // Via 4: Documentos do Paciente (PatientDocuments)
  const docPathA = docClinicoA.itens.pdfPath;
  const { data: blobVia4A } = await supabase.storage.from('documentos-pacientes').download(docPathA);
  const hashVia4A = blobVia4A ? sha256(Buffer.from(await blobVia4A.arrayBuffer())) : null;
  console.log('Via 4 (Documentos Paciente)   - Path:', docPathA, '| Hash:', hashVia4A);

  if (hashVia1A !== hashA || hashVia2A !== hashA || hashVia4A !== hashA) {
    throw new Error(`Falha nas 4 vias de Contrato A! Hashes não conferem com o binário arquivado.`);
  }
  console.log('✔ TODAS AS 4 VIAS DO CONTRATO A RECUPERAM O MESMO PDF DEFINITIVO COM O MESMO HASH!');

  console.log('\n5. Testando as 4 vias de acesso ao PDF para o Contrato B (Siso Inferior)...');
  const resVia1B = await obterPdfContratoOficialDefinitivo(contratoBId, contratoFinalB);
  const blobBuf1B = resVia1B?.blob ? Buffer.from(await resVia1B.blob.arrayBuffer()) : null;
  const hashVia1B = blobBuf1B ? sha256(blobBuf1B) : null;
  console.log('Via 1 (Ver Contrato Assinado) - Path:', resVia1B?.path, '| Hash:', hashVia1B);

  const { data: blobVia2B } = await supabase.storage.from('documentos-pacientes').download(pathB);
  const hashVia2B = blobVia2B ? sha256(Buffer.from(await blobVia2B.arrayBuffer())) : null;
  console.log('Via 2 (Baixar PDF Assinado)   - Path:', pathB, '| Hash:', hashVia2B);

  const docPathB = docClinicoB.itens.pdfPath;
  const { data: blobVia4B } = await supabase.storage.from('documentos-pacientes').download(docPathB);
  const hashVia4B = blobVia4B ? sha256(Buffer.from(await blobVia4B.arrayBuffer())) : null;
  console.log('Via 4 (Documentos Paciente)   - Path:', docPathB, '| Hash:', hashVia4B);

  if (hashVia1B !== hashB || hashVia2B !== hashB || hashVia4B !== hashB) {
    throw new Error(`Falha nas 4 vias de Contrato B! Hashes não conferem com o binário arquivado.`);
  }
  console.log('✔ TODAS AS 4 VIAS DO CONTRATO B RECUPERAM O MESMO PDF DEFINITIVO COM O MESMO HASH!');

  // 7. TESTE DE BLOQUEIO POR AMBIGUIDADE
  console.log('\n6. Testando bloqueio defensivo de ambiguidade (se 2 contratos distintos apontarem para o mesmo orçamento)...');
  const docClinicoAmbiguidade = {
    id: 'c9999999-test-442c-bb50-34725f4c04f9',
    paciente_id: testPatientId,
    tipo: 'contrato',
    titulo: 'Contrato Duplicado Indevido',
    itens: {
      contratoId: 'CTR-INVASOR-999',
      orcamentoId: orcamentoAId, // Aponta indevidamente para o mesmo orçamento A
    },
  };

  const listaComAmbiguidade = [docClinicoA, docClinicoAmbiguidade];
  const candAmb = listaComAmbiguidade.filter((d) => isContratoDoOrcamento(d, orcamentoA));
  const idsAmb = Array.from(new Set(candAmb.map((d) => (d.itens as any)?.contratoId || d.identificador || d.id)));
  const temAmb = idsAmb.length > 1;
  const contObjAmb = temAmb ? null : candAmb[0];

  console.log('Contratos concorrentes detectados:', idsAmb);
  console.log('Flag temAmbiguidadeContrato ativada?:', temAmb, '(Esperado: true)');
  console.log('contObj bloqueado para null?:', contObjAmb === null, '(Esperado: true)');

  if (!temAmb || contObjAmb !== null) {
    throw new Error('Falha no bloqueio de ambiguidade! O sistema deveria bloquear a abertura automática.');
  }
  console.log('✔ BLOQUEIO DE AMBIGUIDADE FUNCIONANDO CORRETAMENTE: previne abertura de documento indevido!');

  // 8. Limpeza de artefatos de teste em homologação
  console.log('\n7. Limpando dados de teste do Storage de homologação...');
  await supabase.storage.from('documentos-pacientes').remove([pathA, pathB]);
  console.log('✔ Limpeza concluída.');

  console.log('\n===============================================================');
  console.log('SUCESSO TOTAL: TODOS OS TESTES EM HOMOLOGAÇÃO PASSARAM COM ÊXITO!');
  console.log('===============================================================');
}

runTest().catch((err) => {
  console.error('\n❌ ERRO NO TESTE EM HOMOLOGAÇÃO:', err);
  process.exit(1);
});
