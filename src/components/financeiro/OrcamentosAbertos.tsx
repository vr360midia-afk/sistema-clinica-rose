import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FileText, Plus, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { calcularSaldoOrcamento } from '@/utils/orcamentoSaldo';
import { formatMoney } from '@/utils/exportCsv';

interface Props {
  onLancarPagamento?: (prefill: any) => void;
}

const OrcamentosAbertos = ({ onLancarPagamento }: Props) => {
  const { orcamentos, loading } = useOrcamentos();
  const { transacoes } = useDentalSystem();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const aprovados = orcamentos
    .filter((o) => o.status?.toLowerCase() === 'aprovado')
    .map((o) => ({ orcamento: o, saldo: calcularSaldoOrcamento(o, transacoes as any[], orcamentos as any[]) }))
    .sort((a, b) => b.saldo.saldo - a.saldo.saldo); // Ordena os em aberto primeiro

  const emAberto = aprovados.filter((a) => a.saldo.saldo > 0.009);
  const totalAberto = emAberto.reduce((s, a) => s + a.saldo.saldo, 0);
  const totalRecebido = aprovados.reduce((s, a) => s + a.saldo.pago, 0);

  if (loading || aprovados.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Orçamentos aprovados
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Em aberto: <strong className="text-yellow-600">{formatMoney(totalAberto)}</strong> · Recebido:{' '}
            <strong className="text-green-600">{formatMoney(totalRecebido)}</strong>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {aprovados.map(({ orcamento, saldo }) => {
          const isQuitado = saldo.saldo <= 0.009;
          const isExpanded = expandedId === orcamento.id;
          const transacoesVinculadas = transacoes.filter(t => t.orcamentoId === orcamento.id);

          return (
            <div key={orcamento.id} className="rounded-lg border p-3 space-y-2 transition-all">
              <div 
                className="flex flex-wrap items-start justify-between gap-2 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : orcamento.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate pr-2 flex items-center gap-2">
                    {orcamento.titulo}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {orcamento.pacienteNome || 'Sem paciente'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {isQuitado ? (
                    <Badge className="bg-green-100 text-green-800">Quitado</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800">Em aberto {formatMoney(saldo.saldo)}</Badge>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatMoney(saldo.pago)} de {formatMoney(saldo.total)}
                  </div>
                </div>
              </div>
              <Progress value={saldo.percentual} className="h-2" />
              
              {(isExpanded || !isQuitado) && (
                <div className="flex justify-end pt-1">
                  {!isQuitado && onLancarPagamento && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={(e) => {
                        e.stopPropagation();
                        onLancarPagamento({
                          orcamentoId: orcamento.id,
                          pacienteId: orcamento.pacienteId || '',
                          pacienteNome: orcamento.pacienteNome,
                          descricao: `Pagamento: ${orcamento.titulo}`,
                          valor: saldo.saldo,
                          tipo: 'receita',
                          status: 'pago',
                        })
                      }}>
                      <Plus className="h-3.5 w-3.5" />
                      Lançar pagamento
                    </Button>
                  )}
                </div>
              )}

              {/* Expansão com histórico de pagamentos */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t text-sm">
                  <p className="font-medium mb-2 text-muted-foreground flex items-center gap-1">
                    <Receipt className="h-4 w-4" /> Histórico de pagamentos
                  </p>
                  {transacoesVinculadas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum pagamento lançado para este orçamento ainda.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {transacoesVinculadas.map(t => (
                        <li key={t.id} className="flex justify-between items-center text-xs bg-muted/30 p-2 rounded">
                          <div>
                            <span className="font-medium block">{t.descricao}</span>
                            <span className="text-muted-foreground">{new Date(t.data).toLocaleDateString('pt-BR')} • {t.metodoPagamento}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium block text-green-600">{formatMoney(t.valor)}</span>
                            <span className="text-[10px] uppercase text-muted-foreground">{t.status}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default OrcamentosAbertos;
