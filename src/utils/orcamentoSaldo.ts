import type { Orcamento } from '@/hooks/useOrcamentos';

export interface SaldoOrcamento {
  total: number;
  pago: number;
  saldo: number;
  percentual: number;
}

const chavePaciente = (o: { pacienteId?: string | null; pacienteNome?: string | null }) =>
  (o.pacienteId || o.pacienteNome || '').toString().trim().toLowerCase();

const ehReceitaConsiderada = (t: any) =>
  t?.tipo === 'receita' && (t?.status === 'pago' || t?.status === 'pendente' || t?.status === 'vencido');

/**
 * Calcula o saldo de TODOS os orçamentos de uma vez, garantindo consistência:
 * - Pagamentos vinculados a um orçamento abatem esse orçamento.
 * - Pagamentos do mesmo paciente sem vínculo são distribuídos entre os
 *   orçamentos aprovados dele (do mais antigo para o mais novo), evitando
 *   que o mesmo tratamento seja contado duas vezes.
 */
export const calcularSaldosOrcamentos = (
  orcamentos: any[],
  transacoes: any[]
): Map<string, SaldoOrcamento> => {
  const resultado = new Map<string, SaldoOrcamento>();
  const lista = orcamentos || [];
  const trans = (transacoes || []).filter(ehReceitaConsiderada);

  const idsOrcamentos = new Set(lista.map((o) => o.id));

  // saldo inicial (só com pagamentos vinculados)
  const restante = new Map<string, number>();
  lista.forEach((o) => {
    const total = Number(o.total || 0);
    const vinculado = trans
      .filter((t) => t.orcamentoId === o.id)
      .reduce((s, t) => s + Number(t.valor || 0), 0);
    restante.set(o.id, Math.max(0, total - vinculado));
    resultado.set(o.id, {
      total,
      pago: Math.min(total, vinculado),
      saldo: Math.max(0, total - vinculado),
      percentual: total > 0 ? Math.min(100, (vinculado / total) * 100) : 0,
    });
  });

  // pool de pagamentos sem vínculo, por paciente
  const pool = new Map<string, number>();
  trans.forEach((t) => {
    if (t.orcamentoId && idsOrcamentos.has(t.orcamentoId)) return;
    const key = chavePaciente(t);
    if (!key) return;
    pool.set(key, (pool.get(key) || 0) + Number(t.valor || 0));
  });

  const aprovados = lista
    .filter((o) => o.status === 'aprovado')
    .sort((a, b) => new Date(a.criadoEm || 0).getTime() - new Date(b.criadoEm || 0).getTime());

  aprovados.forEach((o) => {
    const key = chavePaciente(o);
    if (!key) return;
    let disponivel = pool.get(key) || 0;
    if (disponivel <= 0) return;
    const rest = restante.get(o.id) || 0;
    if (rest <= 0) return;
    const usado = Math.min(rest, disponivel);
    disponivel -= usado;
    pool.set(key, disponivel);
    restante.set(o.id, rest - usado);
    const atual = resultado.get(o.id)!;
    const pago = Math.min(atual.total, atual.pago + usado);
    resultado.set(o.id, {
      total: atual.total,
      pago,
      saldo: Math.max(0, atual.total - pago),
      percentual: atual.total > 0 ? Math.min(100, (pago / atual.total) * 100) : 0,
    });
  });

  return resultado;
};

/**
 * Saldo de um único orçamento. Passe a lista completa de orçamentos
 * (`todosOrcamentos`) para que os pagamentos sem vínculo sejam distribuídos
 * corretamente entre os orçamentos do paciente.
 */
export const calcularSaldoOrcamento = (
  orcamento: Pick<Orcamento, 'id' | 'total'> & Record<string, any>,
  transacoes: any[],
  todosOrcamentos?: any[]
): SaldoOrcamento => {
  const lista = todosOrcamentos && todosOrcamentos.length ? todosOrcamentos : [orcamento];
  const mapa = calcularSaldosOrcamentos(lista, transacoes);
  return (
    mapa.get(orcamento.id) || {
      total: Number(orcamento.total || 0),
      pago: 0,
      saldo: Number(orcamento.total || 0),
      percentual: 0,
    }
  );
};
