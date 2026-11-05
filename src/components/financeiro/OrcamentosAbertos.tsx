import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  Receipt,
  QrCode,
  CheckCircle2,
  Clock,
  Eye,
  Trash2,
  CheckSquare,
  Square,
  AlertCircle,
  Handshake,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import ModalApresentarOrcamento from '@/components/orcamentos/ModalApresentarOrcamento';
import { useOrcamentos, Orcamento } from '@/hooks/useOrcamentos';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { calcularSaldoOrcamento } from '@/utils/orcamentoSaldo';
import { formatMoney } from '@/utils/exportCsv';
import { ModalReceberPagamento } from './ModalReceberPagamento';
import { ModalExcluirRegistroFinanceiro } from './ModalExcluirRegistroFinanceiro';
import { ModalExclusaoLoteFinanceiro } from './ModalExclusaoLoteFinanceiro';
import { ModalConciliarOrcamento } from './ModalConciliarOrcamento';
import { ModalEditarRegistroFinanceiro } from './ModalEditarRegistroFinanceiro';
import { isRegistroFicticioTeste } from '@/utils/financeiroExclusao';
import { Transacao } from '@/types/shared';

interface Props {
  onLancarPagamento?: (prefill: any) => void;
}

export const OrcamentosAbertos = ({ onLancarPagamento }: Props) => {
  const { orcamentos, loading, reload: reloadOrcamentos } = useOrcamentos();
  const { transacoes, pacientes } = useDentalSystem();
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

  // Estados para Exclusão e Gerenciamento Seguro
  const [orcamentoParaExcluir, setOrcamentoParaExcluir] = useState<Orcamento | null>(null);
  const [modalExcluirIndividualOpen, setModalExcluirIndividualOpen] = useState(false);
  const [selecionadosIds, setSelecionadosIds] = useState<Set<string>>(new Set());
  const [modalLoteOpen, setModalLoteOpen] = useState(false);

  // Estados para Conciliação e Edição
  const [orcamentoParaConciliar, setOrcamentoParaConciliar] = useState<Orcamento | null>(null);
  const [modalConciliarOpen, setModalConciliarOpen] = useState(false);
  const [orcamentoParaEditar, setOrcamentoParaEditar] = useState<Orcamento | null>(null);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);

  // Filtra orçamentos ativos, ignorando os que foram cancelados ou arquivados financeiramente
  const aprovados = (orcamentos || [])
    .filter((o) => {
      if (!o || o.status?.toLowerCase() !== 'aprovado') return false;
      const snap = (o as any).assinatura_paciente || (o as any).assinaturaPaciente || {};
      if (
        o.statusFinanceiro === 'cancelado' ||
        o.statusFinanceiro === 'arquivado' ||
        snap.statusFinanceiro === 'cancelado' ||
        snap.statusFinanceiro === 'arquivado'
      ) {
        return false;
      }
      return true;
    })
    .map((o) => ({ orcamento: o, saldo: calcularSaldoOrcamento(o, transacoes as any[], orcamentos as any[]) }))
    .sort((a, b) => b.saldo.saldo - a.saldo.saldo);

  const totalVendasAprovadas = aprovados.reduce((s, a) => s + Number(a.orcamento.total || 0), 0);
  const emAberto = aprovados.filter((a) => a.saldo.saldo > 0.009);
  const totalAberto = emAberto.reduce((s, a) => s + a.saldo.saldo, 0);
  const totalRecebido = aprovados.reduce((s, a) => s + a.saldo.pago, 0);

  // Itens selecionados para lote
  const itensSelecionados = aprovados
    .filter((a) => selecionadosIds.has(a.orcamento.id))
    .map((a) => a.orcamento);

  const totalValorSelecionados = itensSelecionados.reduce((s, o) => s + Number(o.total || 0), 0);

  const toggleSelecionado = (id: string) => {
    setSelecionadosIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelecionarTodos = () => {
    if (selecionadosIds.size === aprovados.length) {
      setSelecionadosIds(new Set());
    } else {
      setSelecionadosIds(new Set(aprovados.map((a) => a.orcamento.id)));
    }
  };

  const selecionarApenasFicticios = () => {
    const idsFicticios = aprovados
      .filter((a) => isRegistroFicticioTeste(a.orcamento))
      .map((a) => a.orcamento.id);
    setSelecionadosIds(new Set(idsFicticios));
  };

  if (loading && aprovados.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2 font-bold text-foreground">
              <FileText className="h-5 w-5 text-primary" />
              Orçamentos Aprovados & Integração Financeira
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-normal">
              <span className="text-muted-foreground">
                Vendas (Fechado): <strong className="text-amber-600 font-bold">{formatMoney(totalVendasAprovadas)}</strong>
              </span>
              <span className="text-muted-foreground">
                Recebido no Caixa: <strong className="text-emerald-600 font-bold">{formatMoney(totalRecebido)}</strong>
              </span>
              <span className="text-muted-foreground">
                A Receber / Cartão: <strong className="text-orange-600 font-bold">{formatMoney(totalAberto)}</strong>
              </span>
            </div>
          </CardTitle>
          <CardDescription className="text-xs">
            Acompanhe o saldo recebido no caixa e as parcelas em aberto de cada plano de tratamento.
          </CardDescription>

          {/* Barra de Ações em Lote e Filtros de Limpeza */}
          {aprovados.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 mt-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSelecionarTodos}
                  className="h-7 text-xs gap-1.5 font-medium"
                >
                  {selecionadosIds.size === aprovados.length ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5 text-primary" />
                      Desmarcar Todos
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5 text-muted-foreground" />
                      Selecionar Todos ({aprovados.length})
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selecionarApenasFicticios}
                  className="h-7 text-xs gap-1.5 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  Selecionar Testes de Homologação
                </Button>

                {selecionadosIds.size > 0 && (
                  <span className="text-xs text-muted-foreground font-medium pl-1">
                    {selecionadosIds.size} selecionado(s) · {formatMoney(totalValorSelecionados)}
                  </span>
                )}
              </div>

              {selecionadosIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setModalLoteOpen(true)}
                    className="h-7 text-xs gap-1.5 shadow-sm font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir / Cancelar em Lote ({selecionadosIds.size})
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {aprovados.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum orçamento aprovado encontrado para este período.
            </p>
          ) : (
            aprovados.map(({ orcamento, saldo }) => {
              const isQuitado = saldo.saldo <= 0.009;
              const isExpanded = expandedId === orcamento.id;
              const transacoesVinculadas = transacoes.filter((t) => t.orcamentoId === orcamento.id);
              const isSelected = selecionadosIds.has(orcamento.id);
              const isTeste = isRegistroFicticioTeste(orcamento);
              const isOrfao = !orcamento.pacienteId || !pacientes.some((p) => p.id === orcamento.pacienteId);

              return (
                <div
                  key={orcamento.id}
                  className={`rounded-xl border p-4 space-y-3 transition-all relative ${
                    isSelected
                      ? 'ring-2 ring-primary/60 bg-primary/[0.02] border-primary/40'
                      : isQuitado
                        ? 'bg-card border-border/60'
                        : 'bg-gradient-to-r from-amber-500/[0.03] to-transparent border-amber-500/30'
                  }`}
                >
                  <div
                    className="flex flex-wrap items-start justify-between gap-2 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : orcamento.id)}
                  >
                    {/* Checkbox de seleção individual */}
                    <div
                      className="pt-1 pr-1 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelecionado(orcamento.id);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelecionado(orcamento.id)}
                        aria-label={`Selecionar orçamento ${orcamento.titulo}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm sm:text-base truncate pr-2 flex items-center gap-2 text-foreground">
                        {orcamento.titulo}
                        {isTeste && (
                          <Badge variant="outline" className="text-[10px] h-4 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                            Homologação/Teste
                          </Badge>
                        )}
                        {isOrfao && (
                          <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-500/40 bg-amber-500/10 gap-1 font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Pendente de Conciliação
                          </Badge>
                        )}
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

                    <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                      {/* Botão de Conciliação se estiver Órfão */}
                      {isOrfao && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-amber-700 dark:text-amber-400 border-amber-400 dark:border-amber-700 bg-amber-500/10 hover:bg-amber-500/20 gap-1 font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrcamentoParaConciliar(orcamento);
                            setModalConciliarOpen(true);
                          }}
                          title="Vincular este orçamento órfão à ficha de um paciente cadastrado"
                        >
                          <Handshake className="h-3.5 w-3.5" />
                          Conciliar Paciente
                        </Button>
                      )}

                      {!isQuitado && (
                        <>
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
                            Apresentar
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
                            Receber Saldo
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
                        </>
                      )}

                      {/* Botão de Edição Permitida */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrcamentoParaEditar(orcamento);
                          setModalEditarOpen(true);
                        }}
                        title="Editar observações ou informações permitidas deste lançamento"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>

                      {/* Botão de Exclusão / Cancelamento Individual */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrcamentoParaExcluir(orcamento);
                          setModalExcluirIndividualOpen(true);
                        }}
                        title="Excluir ou cancelar lançamento financeiro deste orçamento"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        Excluir
                      </Button>
                    </div>
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
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                      {isPago ? '✓ Quitado' : '⏳ Em aberto'}
                                    </span>
                                  </div>

                                  {!isPago && (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setDadosRecebimentoAvulso(null);
                                        setTransacaoSelecionada(t);
                                        setModalReceberOpen(true);
                                      }}
                                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                    >
                                      Receber
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
            })
          )}
        </CardContent>
      </Card>

      {/* Modal de Apresentar Orçamento */}
      {apresentarOrcamento && (
        <ModalApresentarOrcamento
          open={!!apresentarOrcamento}
          onOpenChange={(open) => !open && setApresentarOrcamento(null)}
          orcamento={apresentarOrcamento}
        />
      )}

      {/* Modal de Recebimento de Parcela */}
      <ModalReceberPagamento
        open={modalReceberOpen}
        onOpenChange={(open) => {
          setModalReceberOpen(open);
          if (!open) {
            setTransacaoSelecionada(null);
            setDadosRecebimentoAvulso(null);
          }
        }}
        transacao={transacaoSelecionada}
        dadosAvulsos={dadosRecebimentoAvulso}
        onSuccess={() => {
          reloadOrcamentos();
        }}
      />

      {/* Modal de Exclusão / Cancelamento Individual */}
      <ModalExcluirRegistroFinanceiro
        open={modalExcluirIndividualOpen}
        isOpen={modalExcluirIndividualOpen}
        onOpenChange={setModalExcluirIndividualOpen}
        onClose={() => setModalExcluirIndividualOpen(false)}
        orcamento={orcamentoParaExcluir}
        transacoes={transacoes}
        onSuccess={() => {
          reloadOrcamentos();
          setExpandedId(null);
        }}
        onSucesso={() => {
          reloadOrcamentos();
          setExpandedId(null);
        }}
      />

      {/* Modal de Exclusão em Lote */}
      <ModalExclusaoLoteFinanceiro
        open={modalLoteOpen}
        isOpen={modalLoteOpen}
        onOpenChange={setModalLoteOpen}
        onClose={() => setModalLoteOpen(false)}
        itens={itensSelecionados}
        orcamentosSelecionados={itensSelecionados}
        transacoes={transacoes}
        onSuccess={() => {
          setSelecionadosIds(new Set());
          reloadOrcamentos();
          setExpandedId(null);
        }}
        onSucesso={() => {
          setSelecionadosIds(new Set());
          reloadOrcamentos();
          setExpandedId(null);
        }}
      />

      {/* Modal de Conciliação de Orçamento Órfão */}
      <ModalConciliarOrcamento
        open={modalConciliarOpen}
        onOpenChange={setModalConciliarOpen}
        orcamento={orcamentoParaConciliar}
        pacientes={pacientes}
        onSuccess={() => {
          reloadOrcamentos();
          setExpandedId(null);
        }}
      />

      {/* Modal de Edição de Registro Financeiro */}
      <ModalEditarRegistroFinanceiro
        open={modalEditarOpen}
        onOpenChange={setModalEditarOpen}
        orcamento={orcamentoParaEditar}
        onSuccess={() => {
          reloadOrcamentos();
        }}
      />
    </>
  );
};

export default OrcamentosAbertos;
