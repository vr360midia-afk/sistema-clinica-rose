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
  return s === 'pendente' || s === 'vencido' || s === 'aguardando' || s === '';
}

export interface ResumoFinanceiroMes {
  ano: number;
  mes: number;
  // Vendas Comerciais
  vendasFechadas: number;
  orcamentosAprovadosQtd: number;
  // Caixa Real (Quitado)
  receitaCaixa: number;
  receitasPagasQtd: number;
  receitaPix: number;
  receitaCartao: number;
  receitaDinheiro: number;
  receitaOutros: number;
  // Despesas
  despesasPagas: number;
  despesasPagasQtd: number;
  despesasPendentes: number;
  totalTaxasCartao: number;
  // Resultado Final
  financeiroLiquido: number;
  // Contas a Receber
  totalAReceber: number;
  totalPendenteCartao: number;
  totalOrcamentosAberto: number;
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
  // 1. Filtrar transações que pertencem a este mês (imune a UTC)
  const transacoesMes = (transacoes || []).filter((t) => {
    if (!t?.data) return false;
    return isDataNoMesAno(t.data, ano, mes0Indexed);
  });

  // 2. Receitas Pagas (Caixa Real)
  const receitasPagas = transacoesMes.filter((t) => t?.tipo === 'receita' && ehTransacaoPaga(t));
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

  // 3. Despesas do Mês
  // Despesas Pagas no Caixa (apenas com status pago para não deduzir contas futuras antes do pagamento)
  const despesasPagasLista = transacoesMes.filter((t) => t?.tipo === 'despesa' && ehTransacaoPaga(t));
  const despesasPendentesLista = transacoesMes.filter((t) => t?.tipo === 'despesa' && ehTransacaoPendente(t));

  const despesasPagasDiretas = despesasPagasLista.reduce((sum, t) => sum + Number(t?.valor || 0), 0);
  const despesasPendentes = despesasPendentesLista.reduce((sum, t) => sum + Number(t?.valor || 0), 0);

  // Identifica taxas de cartão lançadas como despesas avulsas
  const taxasLancadasComoDespesa = despesasPagasLista
    .filter(
      (t) =>
        t?.categoria === 'Taxas de Cartão' ||
        (typeof t?.descricao === 'string' &&
          (t.descricao.toLowerCase().includes('taxa da máquina') ||
            t.descricao.toLowerCase().includes('taxa cartão') ||
            t.descricao.toLowerCase().includes('taxa cartao')))
    )
    .reduce((sum, t) => sum + Number(t?.valor || 0), 0);

  // Identifica taxas embutidas em receitas de cartão pagas que NÃO possuem transação de despesa correspondente (evita dupla dedução)
  const taxasEmbutidasSemDespesa = receitasPagas
    .filter((r) => {
      const m = String(r?.metodoPagamento || '').toLowerCase();
      const desc = String(r?.descricao || '').toLowerCase();
      const isCartao = m === 'cartao' || desc.includes('cart');
      if (!isCartao) return false;

      // Se já existe despesa associada a este orçamento ou com a taxa explícita correspondente, não conta embutida
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

  // 5. Vendas (Orçamentos Fechados/Aprovados no Mês)
  const orcamentosFechadosMes = (orcamentos || []).filter((o) => {
    if (!o || String(o.status || '').toLowerCase() !== 'aprovado') return false;
    const dataRef = (o as any).dataAssinatura || o.atualizadoEm || o.criadoEm;
    return isDataNoMesAno(dataRef, ano, mes0Indexed);
  });
  const vendasFechadas = orcamentosFechadosMes.reduce((sum, o) => sum + Number(o?.total || 0), 0);

  // 6. Contas a Receber (Saldos em aberto de orçamentos aprovados + pendentes avulsos)
  const saldosOrcamentos = calcularSaldosOrcamentos(orcamentos, transacoes);
  const totalOrcamentosAberto = (orcamentos || [])
    .filter((o) => String(o?.status || '').toLowerCase() === 'aprovado')
    .reduce((sum, o) => sum + (saldosOrcamentos.get(o.id)?.saldo || 0), 0);

  const idsOrcamentosAprovados = new Set(
    (orcamentos || []).filter((o) => String(o?.status || '').toLowerCase() === 'aprovado').map((o) => o.id)
  );

  const pendentesAvulsos = transacoesMes.filter(
    (t) => t?.tipo === 'receita' && ehTransacaoPendente(t) && (!t.orcamentoId || !idsOrcamentosAprovados.has(t.orcamentoId))
  );
  const totalPendingAvulso = pendentesAvulsos.reduce((sum, t) => sum + Number(t?.valor || 0), 0);
  const totalAReceber = totalOrcamentosAberto + totalPendingAvulso;

  // Receitas pendentes com cartão no mês (aguardando passar cartão no balcão)
  const receitasPendentesCartao = transacoesMes.filter((t) => {
    if (t?.tipo !== 'receita' || !ehTransacaoPendente(t)) return false;
    const m = String(t?.metodoPagamento || '').toLowerCase();
    const d = String(t?.descricao || '').toLowerCase();
    return m === 'cartao' || d.includes('cart');
  });
  const totalPendenteCartao = receitasPendentesCartao.reduce((sum, t) => sum + Number(t?.valor || 0), 0);

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
    despesasPagas,
    despesasPagasQtd: despesasPagasLista.length,
    despesasPendentes,
    totalTaxasCartao,
    financeiroLiquido,
    totalAReceber,
    totalPendenteCartao,
    totalOrcamentosAberto,
    transacoesMes,
  };
}
