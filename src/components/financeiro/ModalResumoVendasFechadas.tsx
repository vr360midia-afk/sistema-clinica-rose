import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  ExternalLink,
  Eye,
  User,
  Calendar,
  Search,
  ArrowRight,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '@/utils/exportCsv';
import { calcularSaldosOrcamentos } from '@/utils/orcamentoSaldo';

interface ModalResumoVendasFechadasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamentos: any[];
  transacoes: any[];
  pacientes: any[];
  selectedMonth: string;
  totalFechadoMes: number;
  onVerOrcamento?: (orcamento: any) => void;
  onIrParaAbaOrcamentos?: () => void;
}

export const ModalResumoVendasFechadas: React.FC<ModalResumoVendasFechadasProps> = ({
  open,
  onOpenChange,
  orcamentos,
  transacoes,
  pacientes,
  selectedMonth,
  totalFechadoMes,
  onVerOrcamento,
  onIrParaAbaOrcamentos,
}) => {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'quitados' | 'pendentes'>('todos');

  // Mapa de pacientes por ID
  const pacientesMap = useMemo(() => {
    const map = new Map<string, any>();
    (pacientes || []).forEach((p) => {
      if (p?.id) map.set(p.id, p);
    });
    return map;
  }, [pacientes]);

  // Mapa de saldos atualizados de todos os orçamentos
  const saldosMap = useMemo(() => {
    return calcularSaldosOrcamentos(orcamentos, transacoes);
  }, [orcamentos, transacoes]);

  // Nome formatado do mês selecionado
  const mesFormatado = useMemo(() => {
    try {
      const [ano, mes] = (selectedMonth || '').split('-');
      if (!ano || !mes) return selectedMonth;
      const data = new Date(Number(ano), Number(mes) - 1, 1);
      const str = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  // Totais agregados dos orçamentos do mês
  const estatisticas = useMemo(() => {
    let totalContratado = 0;
    let totalPago = 0;
    let totalSaldo = 0;

    orcamentos.forEach((o) => {
      const val = Number(o?.total || 0);
      totalContratado += val;
      const saldoObj = saldosMap.get(o.id);
      if (saldoObj) {
        totalPago += saldoObj.pago;
        totalSaldo += saldoObj.saldo;
      } else {
        totalSaldo += val;
      }
    });

    const percentualPago = totalContratado > 0 ? (totalPago / totalContratado) * 100 : 0;

    return {
      totalContratado: totalContratado || totalFechadoMes,
      totalPago,
      totalSaldo,
      percentualPago,
      quantidade: orcamentos.length,
    };
  }, [orcamentos, saldosMap, totalFechadoMes]);

  // Lista de orçamentos enriquecida e filtrada
  const orcamentosFiltrados = useMemo(() => {
    return orcamentos
      .map((o) => {
        const pac = pacientesMap.get(o.pacienteId);
        const pacNome = pac?.nome || o.pacienteNome || 'Paciente não identificado';
        const saldoObj = saldosMap.get(o.id) || {
          total: Number(o.total || 0),
          pago: 0,
          saldo: Number(o.total || 0),
          percentual: 0,
        };

        const snap = (o as any).assinatura_paciente || (o as any).assinaturaPaciente || {};
        const codigoContrato = snap.codigoContrato || o.numero || `ORC-${String(o.id).slice(0, 8).toUpperCase()}`;
        
        const dataAprovacao =
          (o as any).dataAssinatura ||
          (o as any).data_assinatura ||
          o.aprovadoEm ||
          (o as any).aprovado_em ||
          snap.aprovadoEm ||
          o.atualizadoEm ||
          o.criadoEm;

        const isQuitado = saldoObj.saldo <= 0.01;

        return {
          orcamento: o,
          paciente: pac,
          pacNome,
          codigoContrato,
          dataAprovacao,
          saldo: saldoObj,
          isQuitado,
        };
      })
      .filter((item) => {
        if (filtroStatus === 'quitados' && !item.isQuitado) return false;
        if (filtroStatus === 'pendentes' && item.isQuitado) return false;

        if (busca.trim()) {
          const q = busca.toLowerCase();
          const matchNome = item.pacNome.toLowerCase().includes(q);
          const matchContrato = item.codigoContrato.toLowerCase().includes(q);
          const matchProcedimentos = (item.orcamento.itens || []).some((it: any) =>
            (it.descricao || it.procedimento || '').toLowerCase().includes(q)
          );
          if (!matchNome && !matchContrato && !matchProcedimentos) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.dataAprovacao || 0).getTime() - new Date(a.dataAprovacao || 0).getTime());
  }, [orcamentos, pacientesMap, saldosMap, busca, filtroStatus]);

  const formatarData = (d: any) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return String(d).slice(0, 10);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <span>Resumo de Vendas Fechadas</span>
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold text-xs ml-1">
                  {mesFormatado}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Detalhamento dos orçamentos aprovados no período comercial. Veja quem fechou, procedimentos contratados e o status de recebimento.
              </DialogDescription>
            </div>
          </div>

          {/* Cards Rápidos de Indicadores no Topo do Modal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-3">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                  Total Contratado
                </span>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(estatisticas.totalContratado)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {estatisticas.quantidade} orçamento(s) aprovado(s)
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-3">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                  Já Recebido (Caixa)
                </span>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(estatisticas.totalPago)}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                  {estatisticas.percentualPago.toFixed(1)}% do valor liquidado
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-3">
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                  Saldo a Receber
                </span>
                <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                  {formatMoney(estatisticas.totalSaldo)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Parcelas vincendas ou a acertar
                </p>
              </CardContent>
            </Card>
          </div>
        </DialogHeader>

        {/* Barra de Filtro e Busca */}
        <div className="px-5 py-3 border-b border-border/50 bg-background/50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente, contrato ou procedimento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Button
              variant={filtroStatus === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroStatus('todos')}
              className="h-7 text-xs px-2.5"
            >
              Todos ({orcamentos.length})
            </Button>
            <Button
              variant={filtroStatus === 'quitados' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroStatus('quitados')}
              className="h-7 text-xs px-2.5"
            >
              Quitados
            </Button>
            <Button
              variant={filtroStatus === 'pendentes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroStatus('pendentes')}
              className="h-7 text-xs px-2.5"
            >
              Com Saldo
            </Button>
          </div>
        </div>

        {/* Lista de Orçamentos com Rolagem */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {orcamentosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck2 className="h-12 w-12 mx-auto stroke-1 opacity-40 mb-3" />
              <p className="text-sm font-medium">Nenhum orçamento encontrado para os filtros selecionados.</p>
              <p className="text-xs mt-1">Verifique o termo buscado ou altere o mês no cabeçalho do Financeiro.</p>
            </div>
          ) : (
            orcamentosFiltrados.map((item) => {
              const { orcamento, pacNome, codigoContrato, dataAprovacao, saldo, isQuitado } = item;
              const itensQtd = (orcamento.itens || []).length;
              const itensDesc = (orcamento.itens || [])
                .map((it: any) => it.descricao || it.procedimento || 'Procedimento')
                .slice(0, 3)
                .join(', ');

              return (
                <div
                  key={orcamento.id}
                  className="p-4 rounded-xl border border-border/70 hover:border-amber-500/40 bg-card hover:bg-muted/30 transition-all shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <User className="h-4 w-4 text-primary shrink-0" />
                          {pacNome}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-muted/60 font-mono">
                          {codigoContrato}
                        </Badge>
                        {isQuitado ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold gap-1">
                            <CheckCircle2 className="h-3 w-3" /> 100% Quitado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-semibold gap-1">
                            <Clock className="h-3 w-3" /> Saldo a Receber
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Aprovado em: {formatarData(dataAprovacao)}
                        </span>
                        {itensDesc && (
                          <span className="truncate max-w-md hidden md:inline" title={itensDesc}>
                            • {itensDesc} {itensQtd > 3 ? `(+${itensQtd - 3})` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Valores */}
                    <div className="text-right sm:shrink-0">
                      <div className="text-base font-extrabold text-foreground">
                        {formatMoney(saldo.total)}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center sm:justify-end gap-1.5 mt-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Pago: {formatMoney(saldo.pago)}
                        </span>
                        {saldo.saldo > 0.01 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Resta: {formatMoney(saldo.saldo)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Barra de Progresso de Pagamento */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                      <span>Progresso da Quitação</span>
                      <span>{saldo.percentual.toFixed(0)}%</span>
                    </div>
                    <Progress value={saldo.percentual} className="h-1.5" />
                  </div>

                  {/* Ações Rápidas */}
                  <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {orcamento.formaPagamento ? `Condição: ${orcamento.formaPagamento}` : 'Sem forma predefinida'}
                      {orcamento.parcelas ? ` (${orcamento.parcelas}x)` : ''}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {item.paciente?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/pacientes/${item.paciente.id}?tab=orcamentos`);
                          }}
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          title="Abrir prontuário do paciente na aba de orçamentos"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Prontuário</span>
                        </Button>
                      )}

                      {onVerOrcamento && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onVerOrcamento(orcamento);
                          }}
                          className="h-7 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-semibold"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Ver Orçamento & Contrato</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com Navegação para a aba Orçamentos & Parcelas */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Dica: Para baixar parcelas, conciliar recebimentos ou renegociar, acesse a aba{' '}
            <strong className="text-foreground">Orçamentos & Parcelas</strong>.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onIrParaAbaOrcamentos && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onIrParaAbaOrcamentos();
                }}
                className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                <span>Acessar Orçamentos & Parcelas</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
