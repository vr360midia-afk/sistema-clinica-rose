/**
 * Utilitários Oficiais e Padronizados para Cálculos Financeiros
 * Garante consistência absoluta entre Dashboard, Financeiro, Relatórios e Gráficos.
 */

import { calcularSaldosOrcamentos } from './orcamentoSaldo';

/**
 * Extrai Ano e Mês (0-indexed) de forma infalível e imune a desvios de fuso horário (UTC vs Horário de Brasília).
 * Ex: "2026-10-01" ou "2026-10-01T00:00:00Z" sempre retorna { ano: 2026, mes: 9 } (Outubro).
 */
export function extrairAnoMes(dateVal: any): { ano: number; mes: number } | null {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const s = dateVal.trim();
    // Padrão ISO: YYYY-MM
    const iso = s.match(/^(\d{4})-(\d{2})/);
    if (iso) {
      return { ano: Number(iso[1]), mes: Number(iso[2]) - 1 };
    }
    // Padrão brasileiro: DD/MM/YYYY
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      return { ano: Number(br[3]), mes: Number(br[2]) - 1 };
    }
  }
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

/**
 * Verifica se a data da transação/orçamento pertence ao ano e mês especificados (mês 0-indexed: 0 = Jan, 9 = Out).
 */
export function isDataNoMesAno(data: any, ano: number, mes0Indexed: number): boolean {
  const am = extrairAnoMes(data);
  if (!am) return false;
  return am.ano === ano && am.mes === mes0Indexed;
}

/**
 * Verifica se a data pertence à string de mês selecionado no formato "YYYY-MM" (ex: "2026-10").
 */
export function isDataNoMesString(data: any, mesAnoStr: string): boolean {
  if (!data || !mesAnoStr) return false;
  const match = mesAnoStr.match(/^(\d{4})-(\d{2})/);
  if (!match) return false;
  const ano = Number(match[1]);
  const mes = Number(match[2]) - 1;
  return isDataNoMesAno(data, ano, mes);
}

/**
 * Normaliza e identifica se uma transação está efetivamente quitada/paga.
 */
export function ehTransacaoPaga(t: any): boolean {
  if (!t) return false;
  const s = String(t.status || '').toLowerCase().trim();
  return s === 'pago' || s === 'quitado' || s === 'paga' || s === 'quitada' || s === 'concluido';
}

/**
 * Normaliza e identifica se uma transação está pendente / a receber / a pagar.
 */
export function ehTransacaoPendente(t: any): boolean {
  if (!t) return false;
  const s = String(t.status || '').toLowerCase().trim();
  if (s === 'cancelado' || s === 'cancelada' || s === 'estornado' || s === 'estornada') return false;
  return s === 'pendente' || s === 'vencido' || s === 'aguardando' || s === '';
}

export interface ResumoFinanceiroMes {
  ano: number;
  mes: number;
  // 1. Vendas Comerciais (Fechado/Aprovado no Mês)
  vendasFechadas: number;
  orcamentosAprovadosQtd: number;
  // 2. Caixa Real (Efetivamente Recebido no Mês)
  receitaCaixa: number;
  receitasPagasQtd: number;
  receitaPix: number;
  receitaCartao: number;
  receitaDinheiro: number;
  receitaOutros: number;
  // 3. A Receber no Mês (Somente parcelas com vencimento dentro do mês selecionado)
  aReceberNoMes: number;
  parcelasVencendoNoMesQtd: number;
  parcelasPixNoMes: number;
  parcelasCartaoNoMes: number;
  parcelasOutrasNoMes: number;
  // 4. Carteira Total a Receber (Soma de todos os saldos de tratamentos ativos, incluindo meses futuros)
  carteiraTotalAReceber: number;
  totalOrcamentosAberto: number;
  // 5. Despesas do Mês
  despesasPagas: number;
  despesasPagasQtd: number;
  despesasPendentes: number;
  totalTaxasCartao: number;
  // 6. Resultado Final Líquido
  financeiroLiquido: number;
  // Compatibilidade legada
  totalAReceber: number;
  totalPendenteCartao: number;
  // Transações pertencentes ao mês
  transacoesMes: any[];
}

/**
 * Motor central de cálculo financeiro.
 * Garante que Dashboard, Financeiro e Relatórios cheguem EXATAMENTE ao mesmo resultado centavo a centavo.
 */
export function calcularResumoFinanceiroMes({
  transacoes = [],
  orcamentos = [],
  ano,
  mes0Indexed,
}: {
  transacoes?: any[];
  orcamentos?: any[];
  ano: number;
  mes0Indexed: number;
}): ResumoFinanceiroMes {
  // 1. Transações que pertencem ao mês pelo fluxo de caixa (data do pagamento ou lançamento)
  const transacoesMes = (transacoes || []).filter((t) => {
    if (!t) return false;
    const dataRef = t.data || t.dataPagamento || t.vencimento;
    if (!dataRef) return false;
    return isDataNoMesAno(dataRef, ano, mes0Indexed);
  });

  // 2. Receitas Pagas (Caixa Real do Mês)
  // Considera pagamentos cuja data efetiva de pagamento/recebimento cai no mês selecionado
  const receitasPagas = (transacoes || []).filter((t) => {
    if (t?.tipo !== 'receita' || !ehTransacaoPaga(t)) return false;
    const dataPagamento = t.data || t.dataPagamento;
    return isDataNoMesAno(dataPagamento, ano, mes0Indexed);
  });
  const receitaCaixa = receitasPagas.reduce((sum, t) => sum + Number(t?.valor || 0), 0);

  // Breakdown por Método de Pagamento
  let receitaPix = 0;
  let receitaCartao = 0;
  let receitaDinheiro = 0;
  let receitaOutros = 0;

  receitasPagas.forEach((t) => {
    const val = Number(t?.valor || 0);
    const m = String(t?.metodoPagamento || t?.metodo_pagamento || '').toLowerCase();
    if (m === 'pix' || m === 'pix_parcelado') {
      receitaPix += val;
    } else if (m === 'cartao' || m.includes('cart')) {
      receitaCartao += val;
    } else if (m === 'dinheiro') {
      receitaDinheiro += val;
    } else {
      receitaOutros += val;
    }
  });

  // 3. Despesas do Mês (Pagas e Pendentes)
  const despesasMes = (transacoes || []).filter((t) => {
    if (t?.tipo !== 'despesa') return false;
    const dataRef = ehTransacaoPaga(t) ? (t.data || t.dataPagamento) : (t.vencimento || t.data);
    return isDataNoMesAno(dataRef, ano, mes0Indexed);
  });

  const despesasPagasLista = despesasMes.filter((t) => ehTransacaoPaga(t));
  const despesasPagasDiretas = despesasPagasLista.reduce((sum, t) => sum + Number(t?.valor || 0), 0);

  const despesasPendentesLista = despesasMes.filter((t) => ehTransacaoPendente(t));
  const despesasPendentes = despesasPendentesLista.reduce((sum, t) => sum + Number(t?.valor || 0), 0);

  // Taxas de Cartão
  const taxasLancadasComoDespesa = despesasPagasLista
    .filter((d) => d.categoria === 'Taxas de Cartão' || (d.descricao || '').toLowerCase().includes('taxa da máquina'))
    .reduce((sum, d) => sum + Number(d.valor || 0), 0);

  const taxasEmbutidasSemDespesa = receitasPagas
    .filter((r) => {
      const m = String(r.metodoPagamento || '').toLowerCase();
      const desc = String(r.descricao || '').toLowerCase();
      const isCartao = m === 'cartao' || desc.includes('cart');
      if (!isCartao) return false;

      const jaTemDespesa = despesasPagasLista.some(
        (d) =>
          (r.orcamentoId && d.orcamentoId === r.orcamentoId && (d.categoria === 'Taxas de Cartão' || (d.descricao || '').toLowerCase().includes('taxa'))) ||
          (d.descricao && r.descricao && d.descricao.includes(r.descricao))
      );
      return !jaTemDespesa;
    })
    .reduce((sum, r) => {
      const taxaVal = Number(r.taxaCartaoValor || 0);
      if (taxaVal > 0) return sum + taxaVal;
      if (r.valorLiquido && Number(r.valorLiquido) < Number(r.valor)) {
        return sum + (Number(r.valor) - Number(r.valorLiquido));
      }
      return sum;
    }, 0);

  const totalTaxasCartao = taxasLancadasComoDespesa + taxasEmbutidasSemDespesa;
  const despesasPagas = despesasPagasDiretas + taxasEmbutidasSemDespesa;

  // 4. Saldo / Financeiro Líquido (Receita Caixa Real - Despesas Pagas no Caixa)
  const financeiroLiquido = receitaCaixa - despesasPagas;

  // 5. Vendas Fechadas (Orçamentos Fechados/Aprovados no Mês)
  const orcamentosFechadosMes = (orcamentos || []).filter((o) => {
    if (!o || String(o.status || '').toLowerCase() !== 'aprovado') return false;
    const snap = (o as any).assinatura_paciente || (o as any).assinaturaPaciente || {};
    if (o.statusFinanceiro === 'cancelado' || o.statusFinanceiro === 'arquivado' || snap.statusFinanceiro === 'cancelado' || snap.statusFinanceiro === 'arquivado') return false;
    const dataRef =
      (o as any).dataAssinatura ||
      (o as any).data_assinatura ||
      o.aprovadoEm ||
      (o as any).aprovado_em ||
      snap.aprovadoEm ||
      o.atualizadoEm ||
      (o as any).atualizado_em ||
      o.criadoEm ||
      (o as any).criado_em ||
      (o as any).created_at;
    return isDataNoMesAno(dataRef, ano, mes0Indexed);
  });
  const vendasFechadas = orcamentosFechadosMes.reduce((sum, o) => sum + Number(o?.total || 0), 0);

  // 6. A RECEBER NO MÊS: Somente parcelas/receitas que vencem no mês selecionado e ainda não foram pagas
  const idsOrcamentosAprovados = new Set(
    (orcamentos || [])
      .filter((o) => {
        if (!o || String(o?.status || '').toLowerCase() !== 'aprovado') return false;
        const snap = (o as any).assinatura_paciente || (o as any).assinaturaPaciente || {};
        return (
          o.statusFinanceiro !== 'cancelado' &&
          o.statusFinanceiro !== 'arquivado' &&
          snap.statusFinanceiro !== 'cancelado' &&
          snap.statusFinanceiro !== 'arquivado'
        );
      })
      .map((o) => o.id)
  );

  const parcelasVencendoNoMes = (transacoes || []).filter((t) => {
    if (t?.tipo !== 'receita' || !ehTransacaoPendente(t) || t?.status === 'cancelado') return false;
    const orcId = t.orcamentoId || t.orcamento_id;
    if (orcId && !idsOrcamentosAprovados.has(orcId)) return false;
    const dataVenc = t.vencimento || t.data;
    return isDataNoMesAno(dataVenc, ano, mes0Indexed);
  });

  const aReceberNoMes = parcelasVencendoNoMes.reduce((sum, t) => sum + Number(t?.valor || 0), 0);
  let parcelasPixNoMes = 0;
  let parcelasCartaoNoMes = 0;
  let parcelasOutrasNoMes = 0;

  parcelasVencendoNoMes.forEach((t) => {
    const val = Number(t?.valor || 0);
    const m = String(t?.metodoPagamento || '').toLowerCase();
    if (m === 'pix' || m === 'pix_parcelado') {
      parcelasPixNoMes += val;
    } else if (m === 'cartao' || m.includes('cart')) {
      parcelasCartaoNoMes += val;
    } else {
      parcelasOutrasNoMes += val;
    }
  });

  // 7. CARTEIRA TOTAL A RECEBER (Todos os saldos futuros de orçamentos aprovados + pendências avulsas)
  const saldosOrcamentos = calcularSaldosOrcamentos(orcamentos, transacoes);
  const totalOrcamentosAberto = (orcamentos || [])
    .filter((o) => {
      if (!o || String(o?.status || '').toLowerCase() !== 'aprovado') return false;
      const snap = (o as any).assinatura_paciente || (o as any).assinaturaPaciente || {};
      return o.statusFinanceiro !== 'cancelado' && o.statusFinanceiro !== 'arquivado' && snap.statusFinanceiro !== 'cancelado' && snap.statusFinanceiro !== 'arquivado';
    })
    .reduce((sum, o) => sum + (saldosOrcamentos.get(o.id)?.saldo || 0), 0);


  const pendentesAvulsos = (transacoes || []).filter(
    (t) => {
      if (t?.tipo !== 'receita' || !ehTransacaoPendente(t) || t?.status === 'cancelado') return false;
      const orcId = t.orcamentoId || t.orcamento_id;
      return !orcId;
    }
  );
  const totalPendingAvulso = pendentesAvulsos.reduce((sum, t) => sum + Number(t?.valor || 0), 0);
  const carteiraTotalAReceber = totalOrcamentosAberto + totalPendingAvulso;

  // Receitas pendentes com cartão no mês
  const totalPendenteCartao = parcelasCartaoNoMes;

  return {
    ano,
    mes: mes0Indexed,
    vendasFechadas,
    orcamentosAprovadosQtd: orcamentosFechadosMes.length,
    receitaCaixa,
    receitasPagasQtd: receitasPagas.length,
    receitaPix,
    receitaCartao,
    receitaDinheiro,
    receitaOutros,
    aReceberNoMes,
    parcelasVencendoNoMesQtd: parcelasVencendoNoMes.length,
    parcelasPixNoMes,
    parcelasCartaoNoMes,
    parcelasOutrasNoMes,
    carteiraTotalAReceber,
    totalOrcamentosAberto,
    despesasPagas,
    despesasPagasQtd: despesasPagasLista.length,
    despesasPendentes,
    totalTaxasCartao,
    financeiroLiquido,
    totalAReceber: carteiraTotalAReceber,
    totalPendenteCartao,
    transacoesMes,
  };
}
