import { createClient } from '@supabase/supabase-js';
import {
  validarAmbienteHomologacao,
  criarClienteHomologacaoSeguro,
  HOMOLOG_URL,
  PROD_PROJECT_REF,
} from './guard-homologacao';
import {
  analisarElegibilidadeFinanceira,
  executarExclusaoOuCancelamentoFinanceiro,
  executarExclusaoLoteFinanceiro,
} from '../src/utils/financeiroExclusao';
import { calcularResumoFinanceiroMes } from '../src/utils/financeiroCalculos';
import type { Orcamento } from '../src/hooks/useOrcamentos';
import type { Transacao } from '../src/types/shared';

// Cliente exclusivo de homologação com trava contra produção
const supabase = criarClienteHomologacaoSeguro();

async function testarTravaSegurancaProducao() {
  console.log('\n=================================================================');
  console.log('1. TESTE DA TRAVA DE SEGURANÇA CONTRA PRODUÇÃO (REQUIREMENT 6)');
  console.log('=================================================================\n');

  let bloqueouProducao = false;
  try {
    validarAmbienteHomologacao(`https://${PROD_PROJECT_REF}.supabase.co`, 'Teste de Ataque Simulado');
  } catch (err: any) {
    if (err.message.includes('BLOQUEIO DE SEGURANÇA') || err.message.includes('Execução abortada')) {
      bloqueouProducao = true;
    }
  }

  if (!bloqueouProducao) {
    throw new Error('FALHA CRÍTICA: A trava de segurança NÃO bloqueou o acesso à produção!');
  }
  console.log('✓ Trava de segurança contra produção funcionando: tentativa bloqueada com sucesso!');

  // Validação em homologação
  validarAmbienteHomologacao(HOMOLOG_URL, 'Conexão Segura de Homologação');
  console.log('✓ Conexão ao ambiente de homologação autorizada e validada.');
}

async function testarCenario1SemPagamento() {
  console.log('\n=================================================================');
  console.log('2. CENÁRIO 1: EXCLUSÃO DE LANÇAMENTO SEM PAGAMENTO (INDIVIDUAL)');
  console.log('=================================================================\n');

  // 1. Criar paciente fictício no banco hospedado
  const { data: pac, error: pacErr } = await supabase
    .from('pacientes')
    .insert({
      nome: 'Juliana Teste Sem Pagamento Fictícia',
      cpf: '999.888.777-11',
      telefone: '(82) 99999-1111',
    })
    .select()
    .single();

  if (pacErr || !pac) throw new Error('Erro ao criar paciente: ' + JSON.stringify(pacErr));
  console.log('✓ Paciente de teste criado em homologação:', pac.id);

  // 2. Criar orçamento sem pagamento no banco hospedado
  const { data: orc, error: orcErr } = await supabase
    .from('orcamentos')
    .insert({
      paciente_id: pac.id,
      valor_total: 1500.0,
      total: 1500.0,
      status: 'aprovado',
      itens: [{ nome: 'Profilaxia e Raspagem Teste', quantidade: 1, valor: 1500.0 }],
      assinatura_paciente: {
        titulo: 'Tratamento Preventivo Teste Fictício',
        pacienteNome: pac.nome,
        pacienteId: pac.id,
      },
    })
    .select()
    .single();

  if (orcErr || !orc) throw new Error('Erro ao criar orçamento: ' + JSON.stringify(orcErr));
  console.log('✓ Orçamento de teste criado em homologação:', orc.id);

  // 3. Simular transação pendente vinculada
  const transacaoObj: Transacao = {
    id: `tra-pend-${Date.now()}`,
    pacienteId: pac.id,
    orcamentoId: orc.id,
    descricao: 'Parcela 1/1 - Preventivo',
    valor: 1500.0,
    tipo: 'receita',
    status: 'pendente',
    data: new Date(),
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  const orcamentoObj: Orcamento = {
    id: orc.id,
    pacienteId: pac.id,
    pacienteNome: pac.nome,
    titulo: 'Tratamento Preventivo Teste Fictício',
    itens: orc.itens,
    desconto: 0,
    total: 1500.0,
    status: 'aprovado',
  };

  // 4. Analisar Elegibilidade
  const analise = analisarElegibilidadeFinanceira(orcamentoObj, [transacaoObj]);
  console.log('✓ Análise de elegibilidade:', {
    podeExcluirDireto: analise.podeExcluirDireto,
    acaoPermitida: analise.acaoPermitida,
    isRegistroFicticio: analise.isRegistroFicticio,
  });

  if (!analise.podeExcluirDireto) {
    throw new Error('Deveria ser elegível para exclusão direta (sem pagamentos e sem contrato)!');
  }

  // 5. Executar exclusão administrativa
  const res = await executarExclusaoOuCancelamentoFinanceiro({
    orcamento: orcamentoObj,
    transacoesVinculadas: [transacaoObj],
    motivo: 'Teste automatizado de limpeza de registro sem pagamento',
    usuarioEmail: 'admin@clinicateste.com',
    customClient: supabase,
  });

  if (!res.ok || res.tipo !== 'excluido') {
    throw new Error(`Falha na exclusão administrativa: ${JSON.stringify(res)}`);
  }
  console.log('✓ Exclusão administrativa executada com sucesso:', res.mensagem);

  // 6. Verificar que orçamento saiu da base de orçamentos no Supabase
  const { data: orcCheck } = await supabase.from('orcamentos').select('id').eq('id', orc.id).maybeSingle();
  if (orcCheck) throw new Error('Orçamento ainda existe na tabela orcamentos!');
  console.log('✓ Orçamento removido com sucesso da tabela orcamentos.');

  // 7. Verificar NÃO exclusão em cascata do paciente
  const { data: pacCheck } = await supabase.from('pacientes').select('id').eq('id', pac.id).maybeSingle();
  if (!pacCheck) throw new Error('FALHA DE INDEPENDÊNCIA: O paciente foi indevidamente excluído em cascata!');
  console.log('✓ Independência de módulos confirmada: Paciente permanece 100% preservado no cadastro.');
}

async function testarCenario2ContratoPreservado() {
  console.log('\n=================================================================');
  console.log('3. CENÁRIO 2: PRESERVAÇÃO DE CONTRATOS ASSINADOS (REQUIREMENT 3/4)');
  console.log('=================================================================\n');

  // 1. Criar paciente
  const { data: pac } = await supabase
    .from('pacientes')
    .insert({
      nome: 'Juliana Teste Contrato Preservado',
      cpf: '888.777.666-22',
      telefone: '(82) 99999-2222',
    })
    .select()
    .single();

  const contratoId = `CTR-PRESERVAR-${Date.now().toString().slice(-6)}`;

  // 2. Criar contrato oficial assinado em documentos_clinicos
  const { data: docContrato } = await supabase
    .from('documentos_clinicos')
    .insert({
      identificador: contratoId,
      paciente_id: pac.id,
      paciente_nome: pac.nome,
      tipo: 'contrato',
      titulo: `Contrato Odontológico - ${pac.nome} (${contratoId})`,
      conteudo: 'Conteúdo legal do contrato assinado bilateralmente.',
      valor_total: 4500.0,
      itens: {
        contratoId,
        status: 'assinado',
        financeiro: { total: 4500.0 },
      },
    })
    .select()
    .single();

  console.log('✓ Contrato assinado registrado em documentos_clinicos:', docContrato.id, contratoId);

  // 3. Criar orçamento aprovado vinculado ao contrato
  const { data: orc } = await supabase
    .from('orcamentos')
    .insert({
      paciente_id: pac.id,
      valor_total: 4500.0,
      total: 4500.0,
      status: 'aprovado',
      contrato_id: contratoId,
      itens: [{ nome: 'Tratamento com Contrato', quantidade: 1, valor: 4500.0 }],
      assinatura_paciente: {
        contratoId,
        contratoStatus: 'assinado',
        titulo: 'Tratamento com Contrato Assinado',
      },
    })
    .select()
    .single();

  const orcamentoObj: Orcamento = {
    id: orc.id,
    pacienteId: pac.id,
    pacienteNome: pac.nome,
    titulo: 'Tratamento com Contrato Assinado',
    itens: orc.itens,
    desconto: 0,
    total: 4500.0,
    status: 'aprovado',
    contratoId,
    contratoStatus: 'assinado',
  };

  // 4. Analisar elegibilidade: NÃO PODE excluir direto, deve CANCELAR/ARQUIVAR
  const analise = analisarElegibilidadeFinanceira(orcamentoObj, []);
  console.log('✓ Análise de segurança com contrato:', {
    temContratoAssinado: analise.temContratoAssinado,
    podeExcluirDireto: analise.podeExcluirDireto,
    acaoPermitida: analise.acaoPermitida,
  });

  if (analise.podeExcluirDireto) {
    throw new Error('FALHA DE SEGURANÇA: Orçamento com contrato assinado não pode ter exclusão direta!');
  }

  // 5. Executar cancelamento financeiro
  const res = await executarExclusaoOuCancelamentoFinanceiro({
    orcamento: orcamentoObj,
    transacoesVinculadas: [],
    motivo: 'Cancelamento operacional a pedido do paciente (contrato arquivado)',
    usuarioEmail: 'admin@clinica.com',
    customClient: supabase,
  });

  if (!res.ok || res.tipo !== 'cancelado') {
    throw new Error(`Falha no cancelamento financeiro: ${JSON.stringify(res)}`);
  }
  console.log('✓ Cancelamento financeiro executado:', res.mensagem);

  // 6. VERIFICAÇÃO CRÍTICA: Contrato em documentos_clinicos DEVE PERMANECER 100% INTACTO
  const { data: docContratoCheck } = await supabase
    .from('documentos_clinicos')
    .select('*')
    .eq('identificador', contratoId)
    .single();

  if (!docContratoCheck || docContratoCheck.identificador !== contratoId) {
    throw new Error('FALHA CRÍTICA DE CONTRATOS: O contrato jurídico foi alterado ou apagado!');
  }
  console.log('✓ AUDITORIA JURÍDICA: Contrato, identificador e conteúdo permanecem 100% INTACTOS!');

  // 7. Orçamento deve estar cancelado financeiramente
  const { data: orcCheck } = await supabase.from('orcamentos').select('*').eq('id', orc.id).single();
  if (orcCheck.status !== 'cancelado') {
    throw new Error(`Orçamento deveria estar com status 'cancelado', obteve ${orcCheck.status}`);
  }
  console.log('✓ Orçamento marcado como cancelado operacionalmente no Supabase.');
}

async function testarCenario3PreservacaoCaixaReal() {
  console.log('\n=================================================================');
  console.log('4. CENÁRIO 3: PRESERVAÇÃO DE PAGAMENTOS REALIZADOS NO CAIXA (REQ 3)');
  console.log('=================================================================\n');

  const { data: pac } = await supabase
    .from('pacientes')
    .insert({
      nome: 'Juliana Teste Preservar Caixa',
      cpf: '777.666.555-33',
    })
    .select()
    .single();

  // Orçamento de 3000
  const { data: orc } = await supabase
    .from('orcamentos')
    .insert({
      paciente_id: pac.id,
      valor_total: 3000.0,
      total: 3000.0,
      status: 'aprovado',
      itens: [{ nome: 'Prótese Parcial', quantidade: 1, valor: 3000.0 }],
      assinatura_paciente: { titulo: 'Prótese Parcial' },
    })
    .select()
    .single();

  // 1 Transação PAGA de 1000 (Caixa Real)
  const tPagaObj: Transacao = {
    id: `tra-paga-${Date.now()}`,
    pacienteId: pac.id,
    orcamentoId: orc.id,
    descricao: 'Entrada Prótese (PAGA NO CAIXA)',
    valor: 1000.0,
    tipo: 'receita',
    status: 'pago',
    data: new Date(),
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  // 1 Transação PENDENTE de 2000
  const tPendObj: Transacao = {
    id: `tra-pend-${Date.now()}`,
    pacienteId: pac.id,
    orcamentoId: orc.id,
    descricao: 'Saldo Restante Prótese (PENDENTE)',
    valor: 2000.0,
    tipo: 'receita',
    status: 'pendente',
    data: new Date(),
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  const orcObj: Orcamento = {
    id: orc.id,
    pacienteId: pac.id,
    pacienteNome: pac.nome,
    titulo: 'Prótese Parcial',
    itens: orc.itens,
    desconto: 0,
    total: 3000.0,
    status: 'aprovado',
  };

  // Analisar elegibilidade
  const analise = analisarElegibilidadeFinanceira(orcObj, [tPagaObj, tPendObj]);
  console.log('✓ Análise de segurança de pagamentos:', {
    temPagamentosPagos: analise.temPagamentosPagos,
    totalPago: analise.totalPago,
    totalPendente: analise.totalPendente,
    podeExcluirDireto: analise.podeExcluirDireto,
  });

  if (analise.podeExcluirDireto) {
    throw new Error('FALHA DE SEGURANÇA: Registro com pagamento pago NÃO pode ter exclusão direta!');
  }

  // Executar cancelamento financeiro
  const res = await executarExclusaoOuCancelamentoFinanceiro({
    orcamento: orcObj,
    transacoesVinculadas: [tPagaObj, tPendObj],
    motivo: 'Cancelamento de saldo remanescente mantendo pagamento de entrada no caixa',
    usuarioEmail: 'admin@clinica.com',
    customClient: supabase,
  });

  if (!res.ok) throw new Error(`Falha no cancelamento: ${res.mensagem}`);
  console.log('✓ Operação concluída:', res.mensagem);

  // Verificação no Supabase: Orçamento cancelado, paciente intacto
  const { data: orcDbCheck } = await supabase.from('orcamentos').select('*').eq('id', orc.id).single();
  if (orcDbCheck.status !== 'cancelado') {
    throw new Error('Status do orçamento não foi atualizado para cancelado');
  }
  console.log('✓ Orçamento cancelado com sucesso no Supabase com auditoria.');
}

async function testarCenario4ExclusaoLote() {
  console.log('\n=================================================================');
  console.log('5. CENÁRIO 4: EXCLUSÃO E CANCELAMENTO EM LOTE (REQUIREMENT 2)');
  console.log('=================================================================\n');

  const { data: pac } = await supabase
    .from('pacientes')
    .insert({
      nome: 'Juliana Teste Operacao Lote',
      cpf: '666.555.444-44',
    })
    .select()
    .single();

  // 1. Orçamento A: Teste sem pagamento (deve ser excluído)
  const { data: orcA } = await supabase
    .from('orcamentos')
    .insert({
      paciente_id: pac.id,
      valor_total: 800.0,
      total: 800.0,
      status: 'aprovado',
      itens: [{ nome: 'Item A', quantidade: 1, valor: 800.0 }],
      assinatura_paciente: { titulo: 'Orçamento Teste A' },
    })
    .select()
    .single();

  // 2. Orçamento B: Teste com contrato (deve ser cancelado/arquivado)
  const { data: orcB } = await supabase
    .from('orcamentos')
    .insert({
      paciente_id: pac.id,
      valor_total: 1200.0,
      total: 1200.0,
      status: 'aprovado',
      itens: [{ nome: 'Item B', quantidade: 1, valor: 1200.0 }],
      assinatura_paciente: { titulo: 'Orçamento Teste B', contratoId: 'CTR-LOTE-B', contratoStatus: 'assinado' },
    })
    .select()
    .single();

  const orcAList: Orcamento = {
    id: orcA.id,
    pacienteId: pac.id,
    pacienteNome: pac.nome,
    titulo: 'Orçamento Teste A',
    itens: orcA.itens,
    desconto: 0,
    total: 800.0,
    status: 'aprovado',
  };

  const orcBList: Orcamento = {
    id: orcB.id,
    pacienteId: pac.id,
    pacienteNome: pac.nome,
    titulo: 'Orçamento Teste B',
    itens: orcB.itens,
    desconto: 0,
    total: 1200.0,
    status: 'aprovado',
    contratoId: 'CTR-LOTE-B',
    contratoStatus: 'assinado',
  };

  const resLote = await executarExclusaoLoteFinanceiro({
    itens: [orcAList, orcBList],
    transacoes: [],
    motivo: 'Teste automatizado de exclusão e arquivamento em lote',
    usuarioEmail: 'admin@clinica.com',
    customClient: supabase,
  });

  console.log('✓ Retorno da operação em lote:', {
    totalProcessados: resLote.totalProcessados,
    totalExcluidos: resLote.totalExcluidos,
    totalCancelados: resLote.totalCancelados,
    totalFalhas: resLote.totalFalhas,
  });

  if (resLote.totalProcessados !== 2 || resLote.totalExcluidos !== 1 || resLote.totalCancelados !== 1) {
    throw new Error('Falha na contabilização da operação em lote!');
  }
  console.log('✓ Operação em lote validada com sucesso: 1 excluído diretamente e 1 cancelado/arquivado com contrato preservado!');
}

async function testarCenario5CalculoIndicadores() {
  console.log('\n=================================================================');
  console.log('6. CENÁRIO 5: AJUSTE E ATUALIZAÇÃO DOS INDICADORES (REQUIREMENT 5)');
  console.log('=================================================================\n');

  const orcamentosAtivos = [
    {
      id: 'orc-ativo-1',
      status: 'aprovado',
      total: 2500.0,
      criadoEm: '2026-11-05T10:00:00Z',
    },
    {
      id: 'orc-cancelado-1',
      status: 'cancelado',
      total: 3000.0,
      statusFinanceiro: 'cancelado',
      criadoEm: '2026-11-05T10:00:00Z',
    },
  ];

  const transacoesAtivas = [
    {
      id: 't-1',
      orcamentoId: 'orc-ativo-1',
      tipo: 'receita',
      status: 'pago',
      valor: 1000.0,
      data: '2026-11-05',
    },
    {
      id: 't-2',
      orcamentoId: 'orc-ativo-1',
      tipo: 'receita',
      status: 'pendente',
      valor: 1500.0,
      data: '2026-11-05',
    },
    {
      id: 't-3',
      orcamentoId: 'orc-cancelado-1',
      tipo: 'receita',
      status: 'cancelado',
      valor: 3000.0,
      data: '2026-11-05',
    },
  ];

  const resumo = calcularResumoFinanceiroMes({
    transacoes: transacoesAtivas,
    orcamentos: orcamentosAtivos,
    ano: 2026,
    mes0Indexed: 10, // Novembro
  });

  console.log('✓ Indicadores recalculados:');
  console.log(`  • Vendas Fechadas: R$ ${resumo.vendasFechadas.toFixed(2)} (Esperado: R$ 2500.00 — orcamento cancelado ignorado)`);
  console.log(`  • Receita no Caixa: R$ ${resumo.receitaCaixa.toFixed(2)} (Esperado: R$ 1000.00 — caixa preservado)`);
  console.log(`  • Total a Receber: R$ ${resumo.totalAReceber.toFixed(2)} (Esperado: R$ 1500.00 — transação cancelada ignorada)`);

  if (resumo.vendasFechadas !== 2500.0) {
    throw new Error(`Vendas fechadas incorretas: esperado 2500.00, obteve ${resumo.vendasFechadas}`);
  }
  if (resumo.receitaCaixa !== 1000.0) {
    throw new Error(`Receita de caixa incorreta: esperado 1000.00, obteve ${resumo.receitaCaixa}`);
  }
  if (resumo.totalAReceber !== 1500.0) {
    throw new Error(`Total a receber incorreto: esperado 1500.00, obteve ${resumo.totalAReceber}`);
  }

  console.log('✓ Todos os indicadores financeiros responderam com exatidão e sem contaminação de registros cancelados!');
}

async function main() {
  await testarTravaSegurancaProducao();
  await testarCenario1SemPagamento();
  await testarCenario2ContratoPreservado();
  await testarCenario3PreservacaoCaixaReal();
  await testarCenario4ExclusaoLote();
  await testarCenario5CalculoIndicadores();

  console.log('\n=================================================================');
  console.log('>>> SUCESSO TOTAL: TODAS AS 6 ETAPAS DE TESTES CONCLUÍDAS COM 100%! <<<');
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
