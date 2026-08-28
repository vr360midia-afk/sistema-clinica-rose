import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';
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

  const aprovados = orcamentos
    .filter((o) => o.status === 'aprovado')
    .map((o) => ({ orcamento: o, saldo: calcularSaldoOrcamento(o, transacoes as any[]) }));

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
        {emAberto.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os orçamentos aprovados estão quitados.</p>
        ) : (
          emAberto.map(({ orcamento, saldo }) => (
            <div key={orcamento.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{orcamento.titulo}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {orcamento.pacienteNome || 'Sem paciente'}
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-yellow-100 text-yellow-800">Em aberto {formatMoney(saldo.saldo)}</Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatMoney(saldo.pago)} de {formatMoney(saldo.total)}
                  </div>
                </div>
              </div>
              <Progress value={saldo.percentual} className="h-2" />
              {onLancarPagamento && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() =>
                      onLancarPagamento({
                        orcamentoId: orcamento.id,
                        pacienteId: orcamento.pacienteId || '',
                        pacienteNome: orcamento.pacienteNome,
                        descricao: orcamento.titulo,
                        valor: saldo.saldo,
                        tipo: 'receita',
                        status: 'pago',
                      })
                    }>
                    <Plus className="h-3.5 w-3.5" />
                    Lançar pagamento
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default OrcamentosAbertos;
