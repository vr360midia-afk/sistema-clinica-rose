import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  QrCode,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Calendar,
  Layers,
  Filter,
  Handshake,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';
import { useOrcamentos, Orcamento } from '@/hooks/useOrcamentos';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { calcularSaldoOrcamento } from '@/utils/orcamentoSaldo';
import { ehTransacaoPaga, ehTransacaoPendente, isDataNoMesString } from '@/utils/financeiroCalculos';
import { formatMoney } from '@/utils/exportCsv';
import { ModalReceberPagamento } from './ModalReceberPagamento';
import { ModalConciliarOrcamento } from './ModalConciliarOrcamento';
import { ModalEditarRegistroFinanceiro } from './ModalEditarRegistroFinanceiro';
import { ModalExcluirRegistroFinanceiro } from './ModalExcluirRegistroFinanceiro';
import ModalApresentarOrcamento from '@/components/orcamentos/ModalApresentarOrcamento';
import { useNavigate } from 'react-router-dom';
import { Transacao } from '@/types/shared';

interface Props {
  selectedMonth?: string;
  onLancarPagamento?: (prefill: any) => void;
}

export const TratamentosEmPagamento = ({ selectedMonth, onLancarPagamento }: Props) => {
  const { orcamentos, reload: reloadOrcamentos } = useOrcamentos();
  const { transacoes, pacientes } = useDentalSystem();
  const navigate = useNavigate();

  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_andamento' | 'em_dia' | 'vencido' | 'quitado'>('em_andamento');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modais
  const [modalReceberOpen, setModalReceberOpen] = useState(false);
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<Transacao | null>(null);
  const [dadosRecebimentoAvulso, setDadosRecebimentoAvulso] = useState<{
    orcamentoId?: string;
    pacienteId?: string;
    valor?: number;
    descricao?: string;
  } | null>(null);

  const [apresentarOrcamento, setApresentarOrcamento] = useState<any | null>(null);
  const [orcamentoParaConciliar, setOrcamentoParaConciliar] = useState<Orcamento | null>(null);
  const [modalConciliarOpen, setModalConciliarOpen] = useState(false);
  const [orcamentoParaEditar, setOrcamentoParaEditar] = useState<Orcamento | null>(null);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [orcamentoParaExcluir, setOrcamentoParaExcluir] = useState<Orcamento | null>(null);
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);

  // Mapeamento e cálculo de todos os tratamentos aprovados
  const tratamentosProcessados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return (orcamentos || [])
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
      .map((o) => {
        const saldo = calcularSaldoOrcamento(o, transacoes as any[], orcamentos as any[]);
        const transacoesVinculadas = (transacoes || [])
          .filter((t) => t.orcamentoId === o.id)
          .sort((a, b) => new Date(a.vencimento || a.data).getTime() - new Date(b.vencimento || b.data).getTime());

        const isQuitado = saldo.saldo <= 0.009;
        const pendentes = transacoesVinculadas.filter((t) => ehTransacaoPendente(t));
        const pagas = transacoesVinculadas.filter((t) => ehTransacaoPaga(t));

        // Detecta parcelas vencidas
        const hasVencida = pendentes.some((t) => {
          const dt = t.vencimento ? new Date(t.vencimento) : new Date(t.data);
          dt.setHours(0, 0, 0, 0);
          return dt < hoje;
        });

        // Próxima parcela
        const proxima = pendentes[0] || null;
        const proximaData = proxima ? (proxima.vencimento || proxima.data) : null;
        const proximaValor = proxima ? Number(proxima.valor || 0) : (isQuitado ? 0 : saldo.saldo);

        // Status analítico
        let statusTratamento: 'quitado' | 'vencido' | 'em_dia' = 'em_dia';
        if (isQuitado) statusTratamento = 'quitado';
        else if (hasVencida) statusTratamento = 'vencido';

        // Detecção de paciente órfão
        const isOrfao = !o.pacienteId || !pacientes.some((p) => p.id === o.pacienteId);

        return {
          orcamento: o,
          saldo,
          transacoesVinculadas,
          pendentes,
          pagas,
          isQuitado,
          hasVencida,
          proxima,
          proximaData,
          proximaValor,
          statusTratamento,
          isOrfao,
        };
      })
      .sort((a, b) => {
        // Vencidos primeiro, depois em dia por maior saldo, depois quitados
        if (a.hasVencida && !b.hasVencida) return -1;
        if (!a.hasVencida && b.hasVencida) return 1;
        if (!a.isQuitado && b.isQuitado) return -1;
        if (a.isQuitado && !b.isQuitado) return 1;
        return b.saldo.saldo - a.saldo.saldo;
      });
  }, [orcamentos, transacoes, pacientes]);

  // Filtros aplicados
  const tratamentosFiltrados = useMemo(() => {
    return tratamentosProcessados.filter((item) => {
      const { orcamento, statusTratamento, isQuitado } = item;

      // Filtro de Status
      if (filtroStatus === 'em_andamento' && isQuitado) return false;
      if (filtroStatus === 'em_dia' && statusTratamento !== 'em_dia') return false;
      if (filtroStatus === 'vencido' && statusTratamento !== 'vencido') return false;
      if (filtroStatus === 'quitado' && statusTratamento !== 'quitado') return false;

      // Filtro de Texto
      if (buscaTexto.trim()) {
        const q = buscaTexto.toLowerCase();
        const nomePac = (orcamento.pacienteNome || '').toLowerCase();
        const tit = (orcamento.titulo || '').toLowerCase();
        const iden = (orcamento.identificador || '').toLowerCase();
        if (!nomePac.includes(q) && !tit.includes(q) && !iden.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [tratamentosProcessados, filtroStatus, buscaTexto]);

  // Totais consolidados da aba
  const totaisAba = useMemo(() => {
    const emAndamento = tratamentosProcessados.filter((t) => !t.isQuitado);
    const totalContratado = emAndamento.reduce((s, t) => s + Number(t.orcamento.total || 0), 0);
    const totalRecebido = emAndamento.reduce((s, t) => s + t.saldo.pago, 0);
    const saldoDevedorTotal = emAndamento.reduce((s, t) => s + t.saldo.saldo, 0);
    const qtdVencidas = emAndamento.filter((t) => t.hasVencida).length;

    return {
      qtdTratamentos: emAndamento.length,
      totalContratado,
      totalRecebido,
      saldoDevedorTotal,
      qtdVencidas,
    };
  }, [tratamentosProcessados]);

  return (
    <div className="space-y-4">
      {/* Cards de Resumo dos Tratamentos Ativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" /> Tratamentos em Andamento
            </span>
            <p className="text-2xl font-black text-foreground">
              {totaisAba.qtdTratamentos} <span className="text-xs font-normal text-muted-foreground">paciente(s)</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Planos aprovados com saldo em aberto</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-amber-600" /> Valor Contratado Total
            </span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {formatMoney(totaisAba.totalContratado)}
            </p>
            <p className="text-[11px] text-muted-foreground">Soma dos contratos ativos em pagamento</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Já Recebido no Caixa
            </span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(totaisAba.totalRecebido)}
            </p>
            <p className="text-[11px] text-muted-foreground">Pagamentos quitados e confirmados</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-orange-600" /> Saldo Devedor Total
            </span>
            <p className="text-2xl font-black text-orange-600 dark:text-orange-400">
              {formatMoney(totaisAba.saldoDevedorTotal)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {totaisAba.qtdVencidas > 0 ? (
                <span className="text-rose-600 font-semibold">{totaisAba.qtdVencidas} com parcela(s) vencida(s)</span>
              ) : (
                'Todas as parcelas em dia'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por paciente ou tratamento..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select
              value={filtroStatus}
              onValueChange={(val: any) => setFiltroStatus(val)}
            >
              <SelectTrigger className="text-xs h-9 w-full sm:w-48">
                <SelectValue placeholder="Status do tratamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_andamento" className="text-xs">Em Andamento (Com Saldo)</SelectItem>
                <SelectItem value="todos" className="text-xs">Todos os Tratamentos</SelectItem>
                <SelectItem value="em_dia" className="text-xs">Em Dia</SelectItem>
                <SelectItem value="vencido" className="text-xs">Parcela Vencida</SelectItem>
                <SelectItem value="quitado" className="text-xs">Quitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listagem de Tratamentos em Pagamento */}
      <div className="space-y-3">
        {tratamentosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-xs text-muted-foreground space-y-1">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="font-semibold text-foreground">Nenhum tratamento encontrado para o filtro selecionado.</p>
              <p>Tente ajustar a busca ou o status para visualizar outros registros.</p>
            </CardContent>
          </Card>
        ) : (
          tratamentosFiltrados.map((item) => {
            const {
              orcamento,
              saldo,
              transacoesVinculadas,
              pendentes,
              pagas,
              isQuitado,
              hasVencida,
              proximaData,
              proximaValor,
              statusTratamento,
              isOrfao,
            } = item;

            const isExpanded = expandedId === orcamento.id;

            return (
              <Card
                key={orcamento.id}
                className={`transition-all border ${
                  hasVencida
                    ? 'border-rose-500/30 bg-gradient-to-r from-rose-500/[0.03] to-transparent'
                    : isQuitado
                      ? 'border-border/60 bg-card'
                      : 'border-amber-500/30 bg-gradient-to-r from-amber-500/[0.03] to-transparent'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Cabeçalho do Card */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : orcamento.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-foreground">
                          {orcamento.pacienteNome || 'Paciente não identificado'}
                        </span>
                        {isOrfao && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40 bg-amber-500/10 gap-1 font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Pendente de Conciliação
                          </Badge>
                        )}
                        {statusTratamento === 'vencido' && (
                          <Badge className="bg-rose-500 text-white text-[10px] font-bold gap-1">
                            <AlertTriangle className="h-3 w-3" /> Parcela Vencida
                          </Badge>
                        )}
                        {statusTratamento === 'em_dia' && (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            Em Dia
                          </Badge>
                        )}
                        {statusTratamento === 'quitado' && (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Quitado
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                        <span className="font-medium text-foreground">{orcamento.titulo}</span>
                        {orcamento.identificador && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{orcamento.identificador}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{transacoesVinculadas.length} parcela(s)</span>
                      </div>
                    </div>

                    {/* Resumo Financeiro no Topo do Card */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 text-right">
                      <div>
                        <div className="text-xs text-muted-foreground">Saldo Devedor</div>
                        <div className="text-base sm:text-lg font-black text-orange-600 dark:text-orange-400">
                          {formatMoney(saldo.saldo)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Contratado</div>
                        <div className="text-sm font-bold text-foreground">
                          {formatMoney(saldo.total)}
                        </div>
                      </div>

                      <div className="pl-2">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Barra de Progresso Financeiro */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">
                        Progresso: <strong className="text-foreground">{saldo.percentual.toFixed(0)}%</strong> quitado
                      </span>
                      <span className="text-muted-foreground">
                        Pago: <strong className="text-emerald-600">{formatMoney(saldo.pago)}</strong> de {formatMoney(saldo.total)}
                      </span>
                    </div>
                    <Progress value={saldo.percentual} className="h-2 bg-muted" />
                  </div>

                  {/* Próxima Parcela em Destaque */}
                  {!isQuitado && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 border border-border/40 text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-amber-600" />
                        <span>
                          Próxima Parcela:{' '}
                          <strong className="text-foreground">{formatMoney(proximaValor)}</strong>
                        </span>
                        {proximaData && (
                          <span className="text-muted-foreground">
                            · Vencimento: <strong className="text-foreground">{new Date(proximaData).toLocaleDateString('pt-BR')}</strong>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {pagas.length} paga(s) · {pendentes.length} pendente(s)
                      </div>
                    </div>
                  )}

                  {/* Ações Rápidas */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {orcamento.pacienteId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-primary gap-1 px-2 font-medium"
                          onClick={() => {
                            navigate(`/pacientes/${orcamento.pacienteId}`);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver Ficha do Paciente
                        </Button>
                      )}

                      {isOrfao && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-amber-600 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 gap-1 font-semibold"
                          onClick={() => {
                            setOrcamentoParaConciliar(orcamento);
                            setModalConciliarOpen(true);
                          }}
                        >
                          <Handshake className="h-3 w-3" />
                          Conciliar Paciente
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                      {!isQuitado && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setTransacaoSelecionada(null);
                            setDadosRecebimentoAvulso({
                              orcamentoId: orcamento.id,
                              pacienteId: orcamento.pacienteId || '',
                              valor: proximaValor > 0 ? proximaValor : saldo.saldo,
                              descricao: `Pagamento: ${orcamento.titulo}`,
                            });
                            setModalReceberOpen(true);
                          }}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 shadow-sm"
                        >
                          <QrCode className="h-3 w-3" />
                          Receber Parcela
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                        onClick={() => {
                          setOrcamentoParaEditar(orcamento);
                          setModalEditarOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1 px-2"
                        onClick={() => {
                          setOrcamentoParaExcluir(orcamento);
                          setModalExcluirOpen(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                        Cancelar
                      </Button>
                    </div>
                  </div>

                  {/* Cronograma Expandido de Parcelas */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t text-xs space-y-2">
                      <p className="font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                        <Receipt className="h-3.5 w-3.5" /> Cronograma de Pagamentos
                      </p>

                      {transacoesVinculadas.length === 0 ? (
                        <div className="p-3 text-center text-muted-foreground bg-muted/20 rounded">
                          Nenhum lançamento individual gerado. O valor pode ser quitado diretamente pelo botão Receber Parcela.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {transacoesVinculadas.map((t, idx) => {
                            const isPago = ehTransacaoPaga(t);
                            const dtVenc = t.vencimento ? new Date(t.vencimento) : new Date(t.data);
                            dtVenc.setHours(0, 0, 0, 0);
                            const vencida = !isPago && dtVenc < new Date();

                            return (
                              <div
                                key={t.id}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg border ${
                                  isPago
                                    ? 'bg-card border-border/40'
                                    : vencida
                                      ? 'bg-rose-500/10 border-rose-500/30'
                                      : 'bg-muted/30 border-border/40'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-foreground truncate">
                                    {t.descricao || `Parcela ${idx + 1}`}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="uppercase font-semibold">{t.metodoPagamento || 'PIX'}</span>
                                    <span>•</span>
                                    <span>Venc: {dtVenc.toLocaleDateString('pt-BR')}</span>
                                    {isPago && (
                                      <>
                                        <span>•</span>
                                        <span className="text-emerald-600 font-semibold">
                                          Pago em {new Date(t.data).toLocaleDateString('pt-BR')}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                  <div className="text-right">
                                    <span
                                      className={`font-black block text-sm ${
                                        isPago
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : vencida
                                            ? 'text-rose-600'
                                            : 'text-amber-600'
                                      }`}
                                    >
                                      {formatMoney(t.valor)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                      {isPago ? '✓ Quitado' : vencida ? '⚠️ Vencida' : '⏳ Pendente'}
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
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal de Recebimento */}
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

      {/* Modal de Conciliação */}
      <ModalConciliarOrcamento
        open={modalConciliarOpen}
        onOpenChange={setModalConciliarOpen}
        orcamento={orcamentoParaConciliar}
        pacientes={pacientes}
        onSuccess={() => {
          reloadOrcamentos();
        }}
      />

      {/* Modal de Edição */}
      <ModalEditarRegistroFinanceiro
        open={modalEditarOpen}
        onOpenChange={setModalEditarOpen}
        orcamento={orcamentoParaEditar}
        onSuccess={() => {
          reloadOrcamentos();
        }}
      />

      {/* Modal de Exclusão / Cancelamento Individual */}
      <ModalExcluirRegistroFinanceiro
        open={modalExcluirOpen}
        onOpenChange={setModalExcluirOpen}
        orcamento={orcamentoParaExcluir}
        transacoes={transacoes}
        onSuccess={() => {
          reloadOrcamentos();
        }}
      />

      {/* Modal Apresentar Orçamento */}
      {apresentarOrcamento && (
        <ModalApresentarOrcamento
          open={!!apresentarOrcamento}
          onOpenChange={(open) => !open && setApresentarOrcamento(null)}
          orcamento={apresentarOrcamento}
        />
      )}
    </div>
  );
};

