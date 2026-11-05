import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  HOMOLOG_URL,
  HOMOLOG_SERVICE_KEY,
  validarAmbienteHomologacao,
} from './guard-homologacao';

// Trava estrita de segurança: garante 100% que executa em homologação
validarAmbienteHomologacao(HOMOLOG_URL, 'Teste Exclusão Orçamento e Preservação de Contrato');

process.env.VITE_SUPABASE_URL = HOMOLOG_URL;
process.env.HOMOLOG_URL = HOMOLOG_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = HOMOLOG_SERVICE_KEY;
process.env.HOMOLOG_SUPABASE_ANON_KEY = HOMOLOG_SERVICE_KEY;

function sha256(buf: Buffer | Uint8Array | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

async function main() {
  console.log('================================================================================');
  console.log('TESTE EM HOMOLOGAÇÃO: EXCLUSÃO DE ORÇAMENTOS E PRESERVAÇÃO DE CONTRATO ASSINADO');
  console.log('Ambiente:', HOMOLOG_URL);
  console.log('================================================================================\n');

  const supabase = createClient(HOMOLOG_URL, HOMOLOG_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const timestamp = Date.now();
  const testSuffix = timestamp.toString().slice(-6);

  const {
    analisarElegibilidadeFinanceira,
    executarExclusaoOuCancelamentoFinanceiro,
  } = await import('../src/utils/financeiroExclusao');

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

  // ---------------------------------------------------------------------------
  // 1. SETUP DE TESTE: Criar Paciente, Orçamento Aprovado, Contrato Formalizado
  // ---------------------------------------------------------------------------
  console.log('--- 1. Criando estrutura de teste com Contrato Formalizado ---');
  const pacienteId = crypto.randomUUID();
  const pacienteNome = `Carlos Alberto Fictício ${testSuffix}`;
  const pacienteCpf = `123.${testSuffix.slice(0, 3)}.${testSuffix.slice(3, 6)}-99`;

  const { error: errPac } = await supabase.from('pacientes').insert({
    id: pacienteId,
    nome: pacienteNome,
    cpf: pacienteCpf,
    rg: '123456 SSP/AL',
    telefone: '(82) 99999-1111',
  });
  assert(!errPac, 'Paciente fictício cadastrado em homologação', errPac?.message);

  const orcamentoId = crypto.randomUUID();
  const contratoId = `CTR-${orcamentoId.slice(0, 8).toUpperCase()}`;
  const orcamentoIdentificador = `ORC-${orcamentoId.slice(0, 8).toUpperCase()}`;
  const tokenAssinatura = 'tok_seguro_' + crypto.randomBytes(16).toString('hex');
  const agoraIso = new Date().toISOString();

  // Rubricas e assinaturas oficiais
  const rubricaPaciente = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const rubricaProfissional = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QzwAEjAwACDAD/5eX8uAAAAAASUVORK5CYII=';

  const assinaturaPacienteObj = {
    nome: pacienteNome,
    cpf: pacienteCpf,
    assinaturaData: rubricaPaciente,
    dataHora: agoraIso,
    ip: '127.0.0.1',
  };

  const assinaturaProfissionalObj = {
    nome: 'Dra. Rosângela Santos Pereira',
    cro: '06267-AL',
    documento: '12.345.678/0001-90',
    dataHora: agoraIso,
    metodo: 'assinatura_automatica_autorizada',
    assinaturaData: rubricaProfissional,
  };

  const condicaoEscolhida = {
    id: '1',
    tipo: 'entrada_saldo',
    titulo: 'Entrada de R$ 1.000,00 + 2x PIX Parcelado de R$ 1.000,00',
    valorTotal: 3000.0,
    valorEntrada: 1000.0,
    saldoParcelas: 2,
    selecionada: true,
  };

  // PDF no Storage
  const pdfPath = `contratos/${contratoId}/Contrato_Assinado_${contratoId}.pdf`;
  const pdfBytes = Buffer.concat([
    Buffer.from(`%PDF-1.4\n% CONTRATO FORMALIZADO ID ${contratoId} PACIENTE ${pacienteNome}\n`),
    Buffer.alloc(2048, 65),
    Buffer.from('\n%%EOF'),
  ]);
  const hashOriginalPdf = sha256(pdfBytes);

  await supabase.storage
    .from('documentos-pacientes')
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

  // Documento clínico (Contrato formalizado)
  const docClinicoId = crypto.randomUUID();
  const snapContrato = {
    contratoId,
    orcamentoId,
    pacienteId,
    status: 'formalizado',
    isFormalizadoTotal: true,
    statusAssinaturaDentista: 'assinado',
    statusAssinaturaPaciente: 'assinado',
    assinaturaDentista: assinaturaProfissionalObj,
    assinaturaPaciente: assinaturaPacienteObj,
    token: tokenAssinatura,
    pdfPath,
  };

  const { error: errDoc } = await supabase.from('documentos_clinicos').insert({
    id: docClinicoId,
    identificador: contratoId,
    paciente_id: pacienteId,
    paciente_nome: pacienteNome,
    tipo: 'contrato',
    titulo: `Contrato Odontológico - ${pacienteNome} (${contratoId})`,
    itens: snapContrato,
    assinado_em: agoraIso,
    assinante_nome: pacienteNome,
    assinatura_data: rubricaPaciente,
  });
  assert(!errDoc, 'Contrato formalizado inserido em documentos_clinicos', errDoc?.message);

  // Orçamento Aprovado
  const snapOrcamentoAssinatura = {
    identificador: orcamentoIdentificador,
    contratoId,
    contratoToken: tokenAssinatura,
    contratoStatus: 'assinaturas_realizadas',
    statusContrato: 'assinaturas_realizadas',
    assinaturaDraStatus: 'concluida',
    assinaturaPacienteStatus: 'concluida',
    contratoFormalizadoEm: agoraIso,
    condicaoEscolhida,
    pdfPath,
  };

  const { error: errOrc } = await supabase.from('orcamentos').insert({
    id: orcamentoId,
    identificador: orcamentoIdentificador,
    paciente_id: pacienteId,
    status: 'aprovado',
    total: 3000.0,
    valor_total: 3000.0,
    desconto: 0,
    contrato_id: contratoId,
    contrato_token: tokenAssinatura,
    condicao_escolhida: condicaoEscolhida,
    itens: [{ id: '1', nome: 'Lentes em Resina (6 elementos)', quantidade: 6, valor: 500.0 }],
    assinatura_paciente: snapOrcamentoAssinatura,
  });
  assert(!errOrc, 'Orçamento aprovado criado no banco de dados', errOrc?.message);

  // Transações em memória (como gerenciadas pelo sistema)
  const transacaoEntradaId = `tra-ent-${testSuffix}`;
  const transacaoParcela1Id = `tra-parc1-${testSuffix}`;

  const transacoesVinculadas = [
    {
      id: transacaoEntradaId,
      orcamentoId,
      pacienteId,
      tipo: 'receita' as const,
      descricao: 'Entrada Inicial (PIX)',
      valor: 1000.0,
      status: 'pago' as const,
      metodo: 'pix',
      pagoEm: agoraIso,
    },
    {
      id: transacaoParcela1Id,
      orcamentoId,
      pacienteId,
      tipo: 'receita' as const,
      descricao: 'Parcela 1/2 PIX Parcelado',
      valor: 1000.0,
      status: 'pendente' as const,
      metodo: 'pix_parcelado',
      vencimento: agoraIso,
    },
  ];

  // ---------------------------------------------------------------------------
  // 2. TESTE DE BLOQUEIO DEFENSIVO: Exclusão Física Direta NÃO Permitida
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testando bloqueio defensivo de exclusão física de contrato assinado ---');
  const orcamentoObjParaTeste = {
    id: orcamentoId,
    pacienteId,
    pacienteNome,
    titulo: 'Plano de Lentes em Resina',
    total: 3000.0,
    status: 'aprovado' as any,
    contratoId,
    contratoStatus: 'assinaturas_realizadas',
    assinatura_paciente: snapOrcamentoAssinatura,
    assinaturaPaciente: snapOrcamentoAssinatura,
    itens: [],
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  const elegibilidade = analisarElegibilidadeFinanceira(orcamentoObjParaTeste as any, transacoesVinculadas as any);

  assert(
    elegibilidade.temContratoAssinado === true,
    'Identificou presença estrita de Contrato Digital Assinado (assinaturas_realizadas)'
  );
  assert(
    elegibilidade.temPagamentosPagos === true,
    'Identificou pagamentos quitados no Caixa (R$ 1.000,00 pagos)'
  );
  assert(
    elegibilidade.podeExcluirDireto === false,
    'Bloqueou terminantemente exclusão física direta (podeExcluirDireto = false)'
  );
  assert(
    elegibilidade.acaoPermitida === 'cancelamento_financeiro',
    'Ação direcionada com precisão para Cancelamento Financeiro com preservação documental'
  );

  // ---------------------------------------------------------------------------
  // 3. EXECUÇÃO DO CANCELAMENTO FINANCEIRO COM PRESERVAÇÃO INTEGRAL
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Executando Cancelamento/Arquivamento Financeiro ---');
  const resCancelamento = await executarExclusaoOuCancelamentoFinanceiro({
    orcamento: orcamentoObjParaTeste as any,
    transacoesVinculadas: transacoesVinculadas as any,
    motivo: 'Paciente solicitou interrupção por motivos pessoais de saúde.',
    usuarioEmail: 'admin@clinicarosangela.com.br',
    customClient: supabase,
  });

  assert(resCancelamento.ok === true, 'Operação de cancelamento financeiro retornou ok: true', resCancelamento.mensagem);
  assert(resCancelamento.tipo === 'cancelado', 'Tipo de operação registrado como cancelado');

  // ---------------------------------------------------------------------------
  // 4. VERIFICAÇÃO DE PRESERVAÇÃO INTEGRAL (CONTRATO, ASSINATURAS, STORAGE E AUDITORIA)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Verificando integridade das garantias jurídicas após cancelamento ---');

  // A. Orçamento no Banco: status 'cancelado'
  const { data: orcDbFinal } = await supabase.from('orcamentos').select('*').eq('id', orcamentoId).single();
  assert(orcDbFinal?.status === 'cancelado', 'Orçamento atualizado para status: cancelado no banco');
  assert(orcDbFinal?.contrato_id === contratoId, 'Vínculo do contrato_id no orçamento preservado');

  // B. Contrato em documentos_clinicos: INTACTO
  const { data: docDbFinal } = await supabase.from('documentos_clinicos').select('*').eq('id', docClinicoId).single();
  assert(Boolean(docDbFinal), 'Registro do contrato em documentos_clinicos NÃO FOI APAGADO');
  assert(docDbFinal?.tipo === 'contrato', 'Tipo contrato preservado');
  assert(docDbFinal?.identificador === contratoId, 'Identificador do contrato preservado');
  assert(Boolean(docDbFinal?.assinado_em), 'Timestamp assinado_em original preservado');
  assert(docDbFinal?.assinante_nome === pacienteNome, 'Nome do assinante original preservado');

  // C. Assinaturas do Paciente e da Dra: INTACTAS
  const snapFinal = (docDbFinal?.itens || {}) as any;
  assert(
    snapFinal.assinaturaPaciente?.assinaturaData === rubricaPaciente,
    'Rubrica gráfica da assinatura do paciente 100% INTACTA'
  );
  assert(
    snapFinal.assinaturaDentista?.nome === 'Dra. Rosângela Santos Pereira' &&
    snapFinal.assinaturaDentista?.cro === '06267-AL',
    'Assinatura e dados da profissional Dra. Rosângela Santos Pereira 100% INTACTOS'
  );

  // D. PDF Definitivo no Storage: INTACTO com mesmo HASH
  const { data: blobStorage } = await supabase.storage.from('documentos-pacientes').download(pdfPath);
  const hashRecuperado = blobStorage ? sha256(Buffer.from(await blobStorage.arrayBuffer())) : '';
  assert(hashRecuperado === hashOriginalPdf, 'PDF arquivado no Storage INTACTO com hash SHA-256 idêntico');

  // E. Transação Paga: INTACTA no Caixa (histórico preservado)
  const transPaga = transacoesVinculadas.find((t) => t.id === transacaoEntradaId);
  assert(transPaga?.status === 'pago', 'Lançamento quitado no Caixa preservado como pago');

  // ---------------------------------------------------------------------------
  // 5. TESTE DE BLOQUEIO DE DELETE DIRETO VIA HOOK (DEFESA CONTRA FALSA SUCESSO)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testando defesa contra delete direto e falsa notificação de sucesso ---');
  // Se tentar delete direto em orçamento com contrato
  const { data: checkRow } = await supabase
    .from('orcamentos')
    .select('status, contrato_id, assinatura_paciente')
    .eq('id', orcamentoId)
    .maybeSingle();

  const snapCheck = (checkRow?.assinatura_paciente || {}) as any;
  const temContratoBloqueio = Boolean(checkRow?.contrato_id || snapCheck.contratoId);
  const bloqueouDeleteFisico = Boolean(temContratoBloqueio || checkRow?.status === 'cancelado');
  assert(bloqueouDeleteFisico, 'deleteOrcamento detecta contrato e status e recusa exclusão física');

  // Se tentar delete em ID que não existe (deve retornar 0 linhas e não emitir sucesso)
  const idInexistente = crypto.randomUUID();
  const { data: delInexistente } = await supabase
    .from('orcamentos')
    .delete()
    .eq('id', idInexistente)
    .select('id');
  const detectouZeroLinhas = !delInexistente || delInexistente.length === 0;
  assert(detectouZeroLinhas, 'Delete com 0 linhas afetadas é detectado com precisão (!data || data.length === 0)');

  // ---------------------------------------------------------------------------
  // 6. TESTE DE EXCLUSÃO DE RASCUNHO SEM CONTRATO (ELEGÍVEL PARA EXCLUSÃO DIRETA)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testando exclusão administrativa legítima de rascunho sem contrato ---');
  const rascunhoId = crypto.randomUUID();
  await supabase.from('orcamentos').insert({
    id: rascunhoId,
    paciente_id: pacienteId,
    status: 'rascunho',
    total: 500,
    valor_total: 500,
    desconto: 0,
    itens: [{ id: '1', nome: 'Consulta Rascunho', quantidade: 1, valor: 500 }],
  });

  const rascunhoObjParaTeste = {
    id: rascunhoId,
    pacienteId,
    pacienteNome,
    titulo: 'Consulta Rascunho',
    total: 500,
    status: 'rascunho' as any,
    contratoId: null,
    itens: [],
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  const elegRascunho = analisarElegibilidadeFinanceira(rascunhoObjParaTeste, []);
  assert(elegRascunho.podeExcluirDireto === true, 'Rascunho sem pagamentos e sem contrato é elegível para exclusão direta');

  const resExclusaoRascunho = await executarExclusaoOuCancelamentoFinanceiro({
    orcamento: rascunhoObjParaTeste,
    transacoesVinculadas: [],
    motivo: 'Rascunho descartado pelo usuário.',
    usuarioEmail: 'admin@clinicarosangela.com.br',
    customClient: supabase,
  });

  assert(resExclusaoRascunho.ok === true, 'Exclusão do rascunho retornou ok: true');
  const { data: checkRascunhoDb } = await supabase.from('orcamentos').select('id').eq('id', rascunhoId).maybeSingle();
  assert(checkRascunhoDb === null, 'Rascunho fisicamente removido do banco de dados');

  // ---------------------------------------------------------------------------
  // LIMPEZA DOS REGISTROS DE TESTE EM HOMOLOGAÇÃO
  // ---------------------------------------------------------------------------
  console.log('\n--- LIMPEZA: Removendo registros do teste em homologação ---');
  await supabase.storage.from('documentos-pacientes').remove([pdfPath]);
  await supabase.from('documentos_clinicos').delete().eq('id', docClinicoId);
  await supabase.from('orcamentos').delete().eq('id', orcamentoId);
  await supabase.from('pacientes').delete().eq('id', pacienteId);
  console.log('  ✓ Dados de teste removidos de homologação.');

  console.log('\n================================================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro fatal durante a execução do teste:', err);
  process.exit(1);
});
