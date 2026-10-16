import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FileText, Plus, ChevronDown, ChevronUp, Receipt, QrCode, CheckCircle2, Clock, Eye } from 'lucide-react';
import ModalApresentarOrcamento from '@/components/orcamentos/ModalApresentarOrcamento';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { calcularSaldoOrcamento } from '@/utils/orcamentoSaldo';
import { formatMoney } from '@/utils/exportCsv';
import { ModalReceberPagamento } from './ModalReceberPagamento';
import { Transacao } from '@/types/shared';

interface Props {
  onLancarPagamento?: (prefill: any) => void;
}

const OrcamentosAbertos = ({ onLancarPagamento }: Props) => {
  const { orcamentos, loading } = useOrcamentos();
  const { transacoes } = useDentalSystem();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [apresentarOrcamento, setApresentarOrcamento] = useState<any | null>(null);

  // Estado para Modal de Recebimento
  const [modalReceberOpen, setModalReceberOpen] = useState(false);
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<Transacao | null>(null);
  const [dadosRecebimentoAvulso, setDadosRecebimentoAvulso] = useState<{
    orcamentoId?: string;
    pacienteId?: string;
    valor?: number;
    descricao?: string;
  } | null>(null);

  const aprovados = orcamentos
    .filter((o) => o.status?.toLowerCase() === 'aprovado')
    .map((o) => ({ orcamento: o, saldo: calcularSaldoOrcamento(o, transacoes as any[], orcamentos as any[]) }))
    .sort((a, b) => b.saldo.saldo - a.saldo.saldo);

  const emAberto = aprovados.filter((a) => a.saldo.saldo > 0.009);
  const totalAberto = emAberto.reduce((s, a) => s + a.saldo.saldo, 0);
  const totalRecebido = aprovados.reduce((s, a) => s + a.saldo.pago, 0);

  if (loading || aprovados.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2 font-bold text-foreground">
              <FileText className="h-5 w-5 text-primary" />
              Orçamentos Aprovados & Integração Financeira
            </span>
            <div className="flex items-center gap-3 text-xs sm:text-sm font-normal">
              <span className="text-muted-foreground">
                Recebido no Caixa: <strong className="text-emerald-600 font-bold">{formatMoney(totalRecebido)}</strong>
              </span>
              <span className="text-muted-foreground">
                Em aberto: <strong className="text-amber-600 font-bold">{formatMoney(totalAberto)}</strong>
              </span>
            </div>
          </CardTitle>
          <CardDescription className="text-xs">
            Acompanhe o saldo recebido no caixa e as parcelas em aberto de cada plano de tratamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {aprovados.map(({ orcamento, saldo }) => {
            const isQuitado = saldo.saldo <= 0.009;
            const isExpanded = expandedId === orcamento.id;
            const transacoesVinculadas = transacoes.filter((t) => t.orcamentoId === orcamento.id);

            return (
              <div
                key={orcamento.id}
                className={`rounded-xl border p-4 space-y-3 transition-all ${
                  isQuitado ? 'bg-card border-border/60' : 'bg-gradient-to-r from-amber-500/[0.03] to-transparent border-amber-500/30'
                }`}
              >
                <div
                  className="flex flex-wrap items-start justify-between gap-2 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : orcamento.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base truncate pr-2 flex items-center gap-2 text-foreground">
                      {orcamento.titulo}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Paciente: <strong className="text-foreground">{orcamento.pacienteNome || 'Sem paciente'}</strong>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isQuitado ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Quitado no Caixa
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 font-semibold gap-1 text-xs">
                        <Clock className="h-3 w-3" /> Falta {formatMoney(saldo.saldo)}
                      </Badge>
                    )}
                    <div className="text-xs text-muted-foreground mt-1 font-medium">
                      Pago: <span className="text-emerald-600 font-bold">{formatMoney(saldo.pago)}</span> de{' '}
                      {formatMoney(saldo.total)} ({saldo.percentual.toFixed(0)}%)
                    </div>
                  </div>
                </div>

                <Progress value={saldo.percentual} className="h-2.5 bg-muted" />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground">
                    {transacoesVinculadas.length} parcela(s)/lançamento(s) vinculados
                  </span>

                  {!isQuitado && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1.5 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setApresentarOrcamento(orcamento);
                        }}
                        title="Apresentar este orçamento na frente do paciente"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Apresentar ao Paciente
                      </Button>

                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransacaoSelecionada(null);
                          setDadosRecebimentoAvulso({
                            orcamentoId: orcamento.id,
                            pacienteId: orcamento.pacienteId || '',
                            valor: saldo.saldo,
                            descricao: `Pagamento: ${orcamento.titulo}`,
                          });
                          setModalReceberOpen(true);
                        }}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Receber Saldo c/ PIX
                      </Button>

                      {onLancarPagamento && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLancarPagamento({
                              orcamentoId: orcamento.id,
                              pacienteId: orcamento.pacienteId || '',
                              pacienteNome: orcamento.pacienteNome,
                              descricao: `Pagamento: ${orcamento.titulo}`,
                              valor: saldo.saldo,
                              tipo: 'receita',
                              status: 'pago',
                              metodoPagamento: 'pix',
                            });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Outra Forma
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expansão com histórico de pagamentos e parcelas */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t text-sm space-y-2">
                    <p className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <Receipt className="h-4 w-4" /> Detalhamento de Parcelas & Lançamentos
                    </p>
                    {transacoesVinculadas.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center bg-muted/20 rounded">
                        Nenhuma parcela lançada para este orçamento ainda.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {transacoesVinculadas.map((t) => {
                          const isPago = t.status === 'pago';
                          return (
                            <li
                              key={t.id}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs p-2.5 rounded-lg border ${
                                isPago ? 'bg-card' : 'bg-amber-500/10 border-amber-500/30'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-foreground block truncate">{t.descricao}</span>
                                <span className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                  <span>{new Date(t.data).toLocaleDateString('pt-BR')}</span>
                                  <span>•</span>
                                  <span className="uppercase font-semibold">{t.metodoPagamento || 'PIX'}</span>
                                  {t.vencimento && !isPago && (
                                    <span className="text-amber-600 font-medium">
                                      • Venc: {new Date(t.vencimento).toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <div className="text-right">
                                  <span
                                    className={`font-black block text-sm ${
                                      isPago ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
                                    }`}
                                  >
                                    {formatMoney(t.valor)}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                    {isPago ? 'No Caixa' : 'Pendente'}
                                  </span>
                                </div>

                                {!isPago && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setTransacaoSelecionada(t);
                                      setDadosRecebimentoAvulso(null);
                                      setModalReceberOpen(true);
                                    }}
                                    className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                                  >
                                    <QrCode className="h-3 w-3" />
                                    Dar Baixa PIX
                                  </Button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Modal de Recebimento de Orçamento */}
      <ModalReceberPagamento
        isOpen={modalReceberOpen}
        onClose={() => {
          setModalReceberOpen(false);
          setTransacaoSelecionada(null);
          setDadosRecebimentoAvulso(null);
        }}
        transacaoPendente={transacaoSelecionada}
        orcamentoIdPredefinido={dadosRecebimentoAvulso?.orcamentoId}
        pacientePredefinidoId={dadosRecebimentoAvulso?.pacienteId}
        valorSugerido={dadosRecebimentoAvulso?.valor}
        descricaoSugerida={dadosRecebimentoAvulso?.descricao}
      />

      {/* Modal de Apresentação Clínica ao Paciente */}
      {apresentarOrcamento && (
        <ModalApresentarOrcamento
          isOpen={!!apresentarOrcamento}
          onClose={() => setApresentarOrcamento(null)}
          orcamento={apresentarOrcamento}
          patient={{ id: apresentarOrcamento.pacienteId, nome: apresentarOrcamento.pacienteNome }}
        />
      )}
    </>
  );
};

export default OrcamentosAbertos;
