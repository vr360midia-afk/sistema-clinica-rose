import type { Orcamento } from '@/hooks/useOrcamentos';

export interface SaldoOrcamento {
  total: number;
  pago: number;
  saldo: number;
  percentual: number;
}

/**
 * Calcula quanto já foi pago de um orçamento com base nas transações
 * de receita vinculadas a ele (status "pago").
 */
export const calcularSaldoOrcamento = (
  orcamento: Pick<Orcamento, 'id' | 'total'>,
  transacoes: any[]
): SaldoOrcamento => {
  const total = Number(orcamento.total || 0);
  const pago = (transacoes || [])
    .filter((t) => t.orcamentoId === orcamento.id && t.tipo === 'receita' && t.status === 'pago')
    .reduce((s, t) => s + Number(t.valor || 0), 0);
  const saldo = Math.max(0, total - pago);
  const percentual = total > 0 ? Math.min(100, (pago / total) * 100) : 0;
  return { total, pago, saldo, percentual };
};
