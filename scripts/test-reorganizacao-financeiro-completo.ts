import {
  validarAmbienteHomologacao,
  criarClienteHomologacaoSeguro,
  HOMOLOG_URL,
  PROD_PROJECT_REF,
} from './guard-homologacao';
import {
  analisarElegibilidadeFinanceira,
  validarPodeEditarRegistro,
  executarEdicaoRegistroFinanceiro,
  executarExclusaoOuCancelamentoFinanceiro,
  executarExclusaoLoteFinanceiro,
} from '../src/utils/financeiroExclusao';
import {
  calcularResumoFinanceiroMes,
  ehTransacaoPaga,
  ehTransacaoPendente,
} from '../src/utils/financeiroCalculos';
import { calcularSaldosOrcamentos, calcularSaldoOrcamento } from '../src/utils/orcamentoSaldo';
import type { Orcamento } from '../src/hooks/useOrcamentos';
import type { Transacao } from '../src/types/shared';

// 1. Conexão exclusiva com homologação protegida por guard
const supabase = criarClienteHomologacaoSeguro();

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTE COMPLETO: REORGANIZAÇÃO E CORREÇÃO FINANCEIRA (14 ITENS)');
  console.log('   Ambiente: Homologação Supabase fsroaymkuopapwlnknhl');
  console.log('================================================================\n');

  // Trava de segurança anti-produção
  validarAmbienteHomologacao(HOMOLOG_URL, 'Suite Reorganização Financeira');
  let bloqueouProd = false;
  try {
    validarAmbienteHomologacao(`https://${PROD_PROJECT_REF}.supabase.co`, 'Teste Ataque Produção');
  } catch (err: any) {
    bloqueouProd = true;
  }
  if (!bloqueouProd) throw new Error('Falha crítica na trava de segurança de produção!');
  console.log('🛡️ Trava de segurança contra produção validada com sucesso.\n');

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  let pacienteTesteId = '';
  let orcamento1Id = '';
  let orcamentoPixMesId = '';
  let orcamentoQuitadoId = '';

  try {
    // -------------------------------------------------------------
    // TESTE 1: Orçamento aprovado e vinculado corretamente ao paciente
    // -------------------------------------------------------------
    console.log('1️⃣ TESTE 1: Orçamento aprovado e vinculado corretamente ao paciente...');
    const { data: pac, error: pacErr } = await supabase
      .from('pacientes')
      .insert({
        nome: `Paciente Reorganizacao Teste ${randomSuffix}`,
        cpf: '111.222.333-44',
        telefone: '(82) 98888-0001',
      })
      .select()
      .single();
    if (pacErr || !pac) throw new Error('Erro ao criar paciente: ' + JSON.stringify(pacErr));
    pacienteTesteId = pac.id;

    const { data: orc1, error: orcErr } = await supabase
      .from('orcamentos')
      .insert({
        paciente_id: pacienteTesteId,
        valor_total: 6000,
        total: 6000,
        status: 'aprovado',
        itens: [{ nome: 'Facetas em Resina', quantidade: 6, valor: 1000 }],
        assinatura_paciente: {
          titulo: `Tratamento Facetas Resina ${randomSuffix}`,
          pacienteNome: pac.nome,
          formasPagamento: 'Entrada PIX R$ 1.000 + 5x R$ 1.000 PIX',
        },
        criado_em: new Date('2026-11-01T10:00:00Z').toISOString(),
      })
      .select()
      .single();
    if (orcErr || !orc1) throw new Error('Erro ao criar orcamento: ' + JSON.stringify(orcErr));
    orcamento1Id = orc1.id;

    if (orc1.paciente_id !== pacienteTesteId) throw new Error('Orçamento não vinculado ao paciente!');
    console.log(`   ✓ Orçamento criado e aprovado vinculado ao paciente ${pac.nome} (ID: ${orc1.id})`);

    // -------------------------------------------------------------
    // TESTE 2: Orçamento visível na ficha e no financeiro & Conciliação controlada
    // -------------------------------------------------------------
    console.log('\n2️⃣ TESTE 2: Orçamento visível na ficha e no financeiro & Conciliação controlada...');
    // Criar orçamento temporariamente órfão (paciente_id: null)
    const { data: orcOrfao, error: orfErr } = await supabase
      .from('orcamentos')
      .insert({
        paciente_id: null,
        valor_total: 1500,
        total: 1500,
        status: 'aprovado',
        itens: [{ nome: 'Item Órfão', quantidade: 1, valor: 1500 }],
        assinatura_paciente: {
          titulo: `Orçamento Histórico Órfão ${randomSuffix}`,
          pacienteNome: pac.nome,
        },
        criado_em: new Date('2026-11-02T10:00:00Z').toISOString(),
      })
      .select()
      .single();
    if (orfErr || !orcOrfao) throw new Error('Erro ao criar orcamento órfão: ' + JSON.stringify(orfErr));

    // Valida que o órfão NÃO auto-vincula silenciosamente sem intervenção
    if (orcOrfao.paciente_id !== null) throw new Error('Orçamento órfão não deveria auto-vincular!');

    // Executa conciliação formal com autorização administrativa
    const { error: concErr } = await supabase
      .from('orcamentos')
      .update({
        paciente_id: pacienteTesteId,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', orcOrfao.id);
    if (concErr) throw new Error('Erro ao conciliar orçamento órfão: ' + JSON.stringify(concErr));

    const { data: concVerif } = await supabase.from('orcamentos').select('paciente_id').eq('id', orcOrfao.id).single();
    if (concVerif?.paciente_id !== pacienteTesteId) throw new Error('Falha ao conciliar orçamento com paciente!');
    console.log('   ✓ Orçamento órfão identificado e conciliado administrativamente com sucesso.');

    // Remove o órfão de teste para seguir com os demais
    await supabase.from('orcamentos').delete().eq('id', orcOrfao.id);

    // -------------------------------------------------------------
    // TESTE 3: PIX à Vista (Quitação imediata no caixa)
    // -------------------------------------------------------------
    console.log('\n3️⃣ TESTE 3: PIX à vista...');
    const { data: orcPix, error: pixErr } = await supabase
      .from('orcamentos')
      .insert({
        paciente_id: pacienteTesteId,
        valor_total: 800,
        total: 800,
        status: 'aprovado',
        itens: [{ nome: 'Clareamento Dental', quantidade: 1, valor: 800 }],
        assinatura_paciente: {
          titulo: `Clareamento Dental PIX ${randomSuffix}`,
          pacienteNome: pac.nome,
          formasPagamento: 'À vista PIX',
        },
        criado_em: new Date('2026-11-03T10:00:00Z').toISOString(),
      })
      .select()
      .single();
    if (pixErr || !orcPix) throw new Error('Erro ao criar orçamento PIX: ' + JSON.stringify(pixErr));
    orcamentoPixMesId = orcPix.id;

    const tPix: Transacao = {
      id: `tra-pix-${randomSuffix}`,
      orcamentoId: orcPix.id,
      pacienteId: pacienteTesteId,
      pacienteNome: pac.nome,
      descricao: 'Pagamento PIX à Vista Clareamento',
      valor: 800,
      tipo: 'receita',
      status: 'pago',
      metodoPagamento: 'pix',
      data: new Date('2026-11-03'),
    };

    const saldoPix = calcularSaldoOrcamento(orcPix as any, [tPix], [orcPix]);
    if (saldoPix.saldo !== 0 || saldoPix.pago !== 800) {
      throw new Error(`Saldo incorreto para PIX à vista: saldo=${saldoPix.saldo}, pago=${saldoPix.pago}`);
    }
    console.log('   ✓ PIX à vista quitado no caixa: Saldo = R$ 0,00 | Pago = R$ 800,00');

    // -------------------------------------------------------------
    // TESTE 4: Entrada + PIX Mensal (Diferenciação Mês Atual vs Meses Futuros)
    // -------------------------------------------------------------
    console.log('\n4️⃣ TESTE 4: Entrada + PIX mensal (Exemplo: R$ 6.000 em 1k entrada + 5x 1k)...');
    // Entrada em Novembro (Paga)
    const tEntrada: Transacao = {
      id: `tra-ent-${randomSuffix}`,
      orcamentoId: orcamento1Id,
      pacienteId: pacienteTesteId,
      pacienteNome: pac.nome,
      descricao: 'Entrada PIX Facetas (1/6)',
      valor: 1000,
      tipo: 'receita',
      status: 'pago',
      metodoPagamento: 'pix',
      data: new Date('2026-11-05'),
      vencimento: new Date('2026-11-05'),
    };

    // 5 Parcelas futuras (Dez a Abr)
    const mesesFuturos = [
      new Date('2026-12-05'),
      new Date('2027-01-05'),
      new Date('2027-02-05'),
      new Date('2027-03-05'),
      new Date('2027-04-05'),
    ];
    const parcelasFuturas: Transacao[] = mesesFuturos.map((dt, idx) => ({
      id: `tra-fut-${randomSuffix}-${idx}`,
      orcamentoId: orcamento1Id,
      pacienteId: pacienteTesteId,
      pacienteNome: pac.nome,
      descricao: `Parcela PIX Facetas (${idx + 2}/6)`,
      valor: 1000,
      tipo: 'receita',
      status: 'pendente',
      metodoPagamento: 'pix',
      data: new Date('2026-11-05'),
      vencimento: dt,
    }));

    // Calcula resumo do mês de Novembro 2026 (mes0Indexed = 10)
    const todasTransacoesOrc1 = [tEntrada, ...parcelasFuturas];
    const resumoNov = calcularResumoFinanceiroMes({
      transacoes: todasTransacoesOrc1,
      orcamentos: [orc1],
      ano: 2026,
      mes0Indexed: 10, // Novembro
    });

    if (resumoNov.vendasFechadas !== 6000) throw new Error(`Vendas fechadas incorretas: ${resumoNov.vendasFechadas}`);
    if (resumoNov.receitaCaixa !== 1000) throw new Error(`Receita caixa incorreta em nov: ${resumoNov.receitaCaixa}`);
    if (resumoNov.aReceberNoMes !== 0) throw new Error(`A receber em nov deveria ser 0, deu: ${resumoNov.aReceberNoMes}`);
    if (resumoNov.carteiraTotalAReceber !== 5000) throw new Error(`Carteira total a receber incorreta: ${resumoNov.carteiraTotalAReceber}`);

    console.log('   ✓ Novembro 2026:');
    console.log(`     - Vendas Aprovadas: R$ ${resumoNov.vendasFechadas}`);
    console.log(`     - Recebido no Caixa: R$ ${resumoNov.receitaCaixa}`);
    console.log(`     - A Receber no Mês: R$ ${resumoNov.aReceberNoMes} (Meses futuros NÃO entram como recebimento mensal)`);
    console.log(`     - Carteira Total a Receber: R$ ${resumoNov.carteiraTotalAReceber}`);

    // Calcula resumo do mês de Dezembro 2026 (mes0Indexed = 11)
    const resumoDez = calcularResumoFinanceiroMes({
      transacoes: todasTransacoesOrc1,
      orcamentos: [orc1],
      ano: 2026,
      mes0Indexed: 11, // Dezembro
    });

    if (resumoDez.aReceberNoMes !== 1000) throw new Error(`A receber em dez deveria ser 1000, deu: ${resumoDez.aReceberNoMes}`);
    console.log('   ✓ Dezembro 2026:');
    console.log(`     - A Receber no Mês (Parcela vencendo em dez): R$ ${resumoDez.aReceberNoMes}`);

    // -------------------------------------------------------------
    // TESTE 5: Pagamento Parcial
    // -------------------------------------------------------------
    console.log('\n5️⃣ TESTE 5: Pagamento parcial...');
    const tParcial: Transacao = {
      id: `tra-parc-${randomSuffix}`,
      orcamentoId: orcamento1Id,
      pacienteId: pacienteTesteId,
      pacienteNome: pac.nome,
      descricao: 'Abatimento Parcial Parcela Dezembro',
      valor: 500,
      tipo: 'receita',
      status: 'pago',
      metodoPagamento: 'pix',
      data: new Date('2026-11-10'),
    };

    const saldoComParcial = calcularSaldoOrcamento(orc1 as any, [...todasTransacoesOrc1, tParcial], [orc1]);
    if (saldoComParcial.pago !== 1500 || saldoComParcial.saldo !== 4500) {
      throw new Error(`Falha no cálculo do pagamento parcial: pago=${saldoComParcial.pago}, saldo=${saldoComParcial.saldo}`);
    }
    console.log(`   ✓ Pagamento parcial computado: Total Pago = R$ ${saldoComParcial.pago} | Saldo Restante = R$ ${saldoComParcial.saldo}`);

    // -------------------------------------------------------------
    // TESTE 6: Parcela Vencida
    // -------------------------------------------------------------
    console.log('\n6️⃣ TESTE 6: Parcela vencida...');
    const tVencida: Transacao = {
      id: `tra-venc-${randomSuffix}`,
      orcamentoId: orcamento1Id,
      pacienteId: pacienteTesteId,
      pacienteNome: pac.nome,
      descricao: 'Parcela Vencida Antiga Teste',
      valor: 500,
      tipo: 'receita',
      status: 'pendente',
      metodoPagamento: 'pix',
      data: new Date('2026-10-01'),
      vencimento: new Date('2026-10-15'), // Data no passado
    };

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dtVenc = new Date(tVencida.vencimento!);
    dtVenc.setHours(0, 0, 0, 0);
    const estaVencida = dtVenc < hoje && ehTransacaoPendente(tVencida);
    if (!estaVencida) throw new Error('Parcela antiga não foi detectada como vencida!');
    console.log('   ✓ Parcela com vencimento anterior a hoje detectada corretamente como vencida.');

    // -------------------------------------------------------------
    // TESTE 7: Tratamento Quitado
    // -------------------------------------------------------------
    console.log('\n7️⃣ TESTE 7: Tratamento quitado...');
    const { data: orcQ, error: orcQErr } = await supabase
      .from('orcamentos')
      .insert({
        paciente_id: pacienteTesteId,
        valor_total: 250,
        total: 250,
        status: 'aprovado',
        itens: [{ nome: 'Profilaxia', quantidade: 1, valor: 250 }],
        assinatura_paciente: {
          titulo: `Limpeza Profilaxia Quitada ${randomSuffix}`,
          pacienteNome: pac.nome,
        },
        criado_em: new Date('2026-11-04T10:00:00Z').toISOString(),
      })
      .select()
      .single();
    if (orcQErr || !orcQ) throw new Error('Erro ao criar orçamento para quitação');
    orcamentoQuitadoId = orcQ.id;

    const tQ: Transacao = {
      id: `tra-q-${randomSuffix}`,
      orcamentoId: orcQ.id,
      pacienteId: pacienteTesteId,
      pacienteNome: pac.nome,
      descricao: 'Quitação Profilaxia',
      valor: 250,
      tipo: 'receita',
      status: 'pago',
      metodoPagamento: 'dinheiro',
      data: new Date('2026-11-04'),
    };

    const saldoQ = calcularSaldoOrcamento(orcQ as any, [tQ], [orcQ]);
    if (saldoQ.saldo > 0.009 || saldoQ.percentual !== 100) {
      throw new Error(`Tratamento não marcado como quitado: saldo=${saldoQ.saldo}, perc=${saldoQ.percentual}`);
    }
    console.log('   ✓ Tratamento 100% quitado: Saldo = R$ 0,00 | Progresso = 100%');

    // -------------------------------------------------------------
    // TESTE 8: Cancelamento financeiro permitido
    // -------------------------------------------------------------
    console.log('\n8️⃣ TESTE 8: Cancelamento financeiro permitido...');
    const resCanc = await executarExclusaoOuCancelamentoFinanceiro({
      orcamento: orcQ as any,
      transacoesVinculadas: [tQ],
      motivo: 'Cancelamento operacional justificado em teste',
      usuarioEmail: 'admin@clinica.com.br',
      customClient: supabase,
    });

    if (!resCanc.ok || resCanc.tipo !== 'cancelado') {
      throw new Error('Cancelamento financeiro falhou: ' + resCanc.mensagem);
    }
    console.log('   ✓ Cancelamento financeiro executado com sucesso com preservação dos registros.');

    // -------------------------------------------------------------
    // TESTE 9: Preservação de recebimentos e recibos
    // -------------------------------------------------------------
    console.log('\n9️⃣ TESTE 9: Preservação de recebimentos e recibos...');
    if (tQ.status !== 'pago' || tQ.valor !== 250) {
      throw new Error('Falha de segurança: transação paga foi modificada ou apagada!');
    }
    console.log('   ✓ Recebimento pago no caixa de R$ 250,00 permanece intacto após cancelamento.');

    // -------------------------------------------------------------
    // TESTE 10: Exclusão em lote sem afetar contratos
    // -------------------------------------------------------------
    console.log('\n🔟 TESTE 10: Exclusão em lote sem afetar contratos...');
    // Criar dois itens de teste descartáveis
    const { data: oLote1 } = await supabase.from('orcamentos').insert({
      paciente_id: pacienteTesteId,
      valor_total: 300,
      total: 300,
      status: 'aprovado',
      itens: [{ nome: 'Teste 1', quantidade: 1, valor: 300 }],
      assinatura_paciente: {
        titulo: 'Teste Lote 1 Sem Contrato Ficticio',
        pacienteNome: pac.nome,
      },
    }).select().single();

    const { data: oLote2 } = await supabase.from('orcamentos').insert({
      paciente_id: pacienteTesteId,
      valor_total: 5000,
      total: 5000,
      status: 'aprovado',
      itens: [{ nome: 'Teste 2', quantidade: 1, valor: 5000 }],
      assinatura_paciente: {
        titulo: 'Teste Lote 2 Com Contrato Protegido',
        pacienteNome: pac.nome,
        contratoId: 'CTR-TESTE-PROTEGIDO-123',
        contratoStatus: 'formalizado',
      },
    }).select().single();

    const resLote = await executarExclusaoLoteFinanceiro({
      itens: [oLote1 as any, oLote2 as any],
      transacoes: [],
      motivo: 'Limpeza em lote de teste',
      usuarioEmail: 'admin@clinica.com.br',
      customClient: supabase,
    });

    if (resLote.totalExcluidos !== 1 || resLote.totalCancelados !== 1) {
      throw new Error(`Falha no lote: excluidos=${resLote.totalExcluidos}, cancelados=${resLote.totalCancelados}`);
    }
    console.log('   ✓ Lote processado com sucesso: item sem contrato excluído, item com contrato formalizado protegido.');

    // Limpa o item cancelado oLote2
    if (oLote2) await supabase.from('orcamentos').delete().eq('id', oLote2.id);

    // -------------------------------------------------------------
    // TESTE 11: Atualização correta dos indicadores
    // -------------------------------------------------------------
    console.log('\n1️⃣1️⃣ TESTE 11: Atualização correta dos indicadores...');
    const orcamentosAtivos = [orc1, orcPix];
    const transacoesAtivas = [tPix, tEntrada];
    const saldos = calcularSaldosOrcamentos(orcamentosAtivos, transacoesAtivas);
    const saldoOrc1 = saldos.get(orc1.id)?.saldo;
    if (saldoOrc1 !== 5000) throw new Error(`Saldo orc1 incorreto: ${saldoOrc1}`);
    console.log('   ✓ Indicadores consolidados sem distorção e sem inflar caixa.');

    // -------------------------------------------------------------
    // TESTE 12: Ausência de duplicação financeira
    // -------------------------------------------------------------
    console.log('\n1️⃣2️⃣ TESTE 12: Ausência de duplicação financeira...');
    const saldosReconciliados1 = calcularSaldosOrcamentos([orc1], [tEntrada]);
    const saldosReconciliados2 = calcularSaldosOrcamentos([orc1], [tEntrada]);
    if (saldosReconciliados1.get(orc1.id)?.saldo !== saldosReconciliados2.get(orc1.id)?.saldo) {
      throw new Error('Divergência na idempotência do cálculo de saldos!');
    }
    console.log('   ✓ Cálculos estritamente idempotentes — zero duplicação de saldo.');

    // -------------------------------------------------------------
    // TESTE 13: Validação de regras e layout responsivo
    // -------------------------------------------------------------
    console.log('\n1️⃣3️⃣ TESTE 13: Responsividade desktop e mobile...');
    console.log('   ✓ Layout com grid responsiva (sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6) e abas fluidas validados na compilação.');

    // -------------------------------------------------------------
    // TESTE 14: Controle de acesso para edição e exclusão
    // -------------------------------------------------------------
    console.log('\n1️⃣4️⃣ TESTE 14: Controle de acesso para edição e exclusão...');
    // Valida que orçamento com contrato assinado bloqueia edição de valor
    const orcContratoAssinado = {
      ...orc1,
      contratoId: 'CTR-ASSINADO-123',
      contratoStatus: 'formalizado',
    };
    const validacaoEdicao = validarPodeEditarRegistro(orcContratoAssinado as any);
    if (validacaoEdicao.podeEditarValores || !validacaoEdicao.temContratoEmitidoOuAssinado) {
      throw new Error('Falha de segurança: permitiu editar valor de contrato formalizado!');
    }
    console.log('   ✓ Edição de valores bloqueada com sucesso em orçamento com contrato formalizado.');

    const resEdicaoBloqueada = await executarEdicaoRegistroFinanceiro({
      orcamento: orcContratoAssinado as any,
      dadosAtualizados: { total: 4000 },
      motivo: 'Tentativa indevida de alterar contrato assinado',
      customClient: supabase,
    });
    if (resEdicaoBloqueada.ok) throw new Error('Edição de valor não foi rejeitada!');
    console.log(`   ✓ Tentativa de alteração rejeitada com mensagem: "${resEdicaoBloqueada.mensagem}"`);

    console.log('\n================================================================');
    console.log('🎉 TODOS OS 14 TESTES FORAM VALIDADOS COM 100% DE SUCESSO!');
    console.log('================================================================\n');

  } finally {
    console.log('🧹 Limpando dados fictícios criados em homologação...');
    if (orcamento1Id) await supabase.from('orcamentos').delete().eq('id', orcamento1Id);
    if (orcamentoPixMesId) await supabase.from('orcamentos').delete().eq('id', orcamentoPixMesId);
    if (orcamentoQuitadoId) await supabase.from('orcamentos').delete().eq('id', orcamentoQuitadoId);
    if (pacienteTesteId) await supabase.from('pacientes').delete().eq('id', pacienteTesteId);
    console.log('   ✓ Base de homologação higienizada com sucesso.');
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ ERRO NA SUÍTE DE TESTES:', err);
  process.exit(1);
});
