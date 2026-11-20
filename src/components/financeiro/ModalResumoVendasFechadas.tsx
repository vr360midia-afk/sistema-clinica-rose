import React, { useState, useMemo, useEffect } from 'react';
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
  Layers,
  Sparkles,
  History,
  MessageCircle,
  Copy,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '@/utils/exportCsv';
import { calcularSaldosOrcamentos } from '@/utils/orcamentoSaldo';
import { 
  isDataNoMesString, 
  ehTransacaoPaga, 
  ehTransacaoPendente,
  extrairAnoMes,
  ResumoFinanceiroMes
} from '@/utils/financeiroCalculos';
import { extrairTodasParcelasOrcamento } from '@/utils/orcamentoParcelasPrevisao';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { gerarPayloadPix } from '@/utils/pixPayload';
import { openWhatsApp } from '@/lib/whatsapp';
import { ModalReceberPagamento } from './ModalReceberPagamento';
import { toast } from 'sonner';

interface ModalResumoVendasFechadasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamentos: any[];
  orcamentosFechadosNoMes?: any[];
  transacoes: any[];
  pacientes: any[];
  selectedMonth: string;
  totalFechadoMes: number;
  resumoFinanceiro?: ResumoFinanceiroMes;
  initialTab?: 'parcelas_mes' | 'contratos_fechados';
  onVerOrcamento?: (orcamento: any) => void;
  onIrParaAbaOrcamentos?: () => void;
}

export const ModalResumoVendasFechadas: React.FC<ModalResumoVendasFechadasProps> = ({
  open,
  onOpenChange,
  orcamentos = [],
  orcamentosFechadosNoMes = [],
  transacoes = [],
  pacientes = [],
  selectedMonth,
  totalFechadoMes,
  resumoFinanceiro,
  initialTab = 'parcelas_mes',
  onVerOrcamento,
  onIrParaAbaOrcamentos,
}) => {
  const navigate = useNavigate();
  const { configuracoes } = useConfiguracoes();
  const { configContrato } = useConfiguracoesContrato();

  const [busca, setBusca] = useState('');
  const [abaVisao, setAbaVisao] = useState<'parcelas_mes' | 'contratos_fechados'>(initialTab);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'quitados' | 'pendentes'>('todos');

  // Modal de Baixa Rápida / Recebimento Integrado
  const [modalReceberOpen, setModalReceberOpen] = useState(false);
  const [recebimentoPrefill, setRecebimentoPrefill] = useState<{
    pacienteId?: string;
    orcamentoId?: string;
    valor?: number;
    descricao?: string;
    transacao?: any;
  } | null>(null);

  const chavePix = configContrato?.chavePix || configuracoes?.telefone || configuracoes?.cnpj || '';
  const tipoChave = configContrato?.tipoChavePix;
  const nomeClinica = configContrato?.favorecidoPix || configuracoes?.nomeClinica || 'Clínica Odontológica';
  const cidade = (configuracoes?.cidade && !configuracoes.cidade.toUpperCase().includes('SAO PAULO')) ? configuracoes.cidade : 'MACEIO';

  const cobrarWhatsAppItem = (item: any) => {
    const paciente = item.paciente;
    if (!paciente?.telefone) {
      toast.error('Paciente não possui número de WhatsApp cadastrado.');
      return;
    }
    const valorNum = Number(item.valorPendenteMes || item.saldo?.saldo || item.valorParcelaMes || 0);
    const primeiroNome = paciente.nome ? paciente.nome.trim().split(' ')[0] : 'Cliente';
    const desc = item.orcamento?.titulo || item.descricao || 'Tratamento Odontológico';
    const vencimentoStr = item.dataVencimentoPrevista || (item.parcelaDoMes?.vencimento ? new Date(item.parcelaDoMes.vencimento).toLocaleDateString('pt-BR') : '');

    const payloadPix = chavePix
      ? gerarPayloadPix({
          chave: chavePix,
          tipoChave,
          nomeFavorecido: nomeClinica,
          cidade,
          valor: valorNum,
          descricao: desc.slice(0, 30),
        })
      : '';

    const linhas = [
      `Olá, ${primeiroNome}! Tudo bem? Esperamos que sim.`,
      '',
      `Passando da equipe da *${nomeClinica}* para lembrar da sua parcela referente ao seu tratamento:`,
      `📋 *Procedimento:* ${desc}`,
      vencimentoStr ? `📅 *Vencimento:* ${vencimentoStr}` : null,
      `💰 *Valor:* ${formatMoney(valorNum)}`,
      chavePix ? `🔑 *Chave PIX:* ${chavePix}` : null,
      '',
      payloadPix
        ? `💎 *PIX Copia e Cola (com valor exato):*\n\`\`\`${payloadPix}\`\`\`\n\n📲 *Como pagar:*\nCopie o código acima, abra o app do seu banco e cole na opção *Pix Copia e Cola*.`
        : null,
      '',
      'Caso já tenha efetuado o pagamento, por favor nos envie o comprovante. Qualquer dúvida, estamos à disposição!',
    ]
      .filter(Boolean)
      .join('\n');

    if (openWhatsApp(paciente.telefone, linhas)) {
      toast.success(`Mensagem de cobrança com PIX aberta no WhatsApp para ${primeiroNome}!`);
    } else {
      toast.error('Não foi possível abrir o WhatsApp. Verifique o número de telefone.');
    }
  };

  const abrirRecebimento = (item: any) => {
    const pId = item.paciente?.id || item.orcamento?.pacienteId || item.pacienteId;
    const orcId = item.orcamento?.id || item.orcamentoId || item.id;
    const val = Number(item.valorPendenteMes ?? item.saldo?.saldo ?? item.valorParcelaMes ?? 0);
    const desc = item.orcamento?.titulo ? `Parcela - ${item.orcamento.titulo}` : 'Recebimento de Parcela';

    setRecebimentoPrefill({
      pacienteId: pId,
      orcamentoId: orcId,
      valor: val,
      descricao: desc,
      transacao: item.transacaoPendente || null,
    });
    setModalReceberOpen(true);
  };

  // Atualiza aba ao abrir com preferência externa (ex: ao clicar no card de vendas fechadas vs parcelas do mês)
  useEffect(() => {
    if (open && initialTab) {
      setAbaVisao(initialTab);
    }
  }, [open, initialTab]);

  // Mapa de pacientes por ID
  const pacientesMap = useMemo(() => {
    const map = new Map<string, any>();
    (pacientes || []).forEach((p) => {
      if (p?.id) map.set(p.id, p);
    });
    return map;
  }, [pacientes]);

  // Mapa de orçamentos por ID
  const orcamentosMap = useMemo(() => {
    const map = new Map<string, any>();
    (orcamentos || []).forEach((o) => {
      if (o?.id) map.set(o.id, o);
    });
    return map;
  }, [orcamentos]);

  // Mapa de saldos de todos os orçamentos
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

  // 1. VISÃO PARCELAS DO MÊS VIGENTE (Sem inflar com o valor total de orçamentos fechados no passado)
  const parcelasDoMesItens = useMemo(() => {
    // Filtra transações de receita com data ou vencimento no mês selecionado
    const transacoesMes = (transacoes || []).filter((t) => {
      if (t?.tipo !== 'receita') return false;
      const dataRef = ehTransacaoPaga(t) ? (t.data || t.dataPagamento) : (t.vencimento || t.data);
      return isDataNoMesString(dataRef, selectedMonth);
    });

    // Agrupa por paciente/orçamento para exibir a parcela consolidada do mês
    const grupos = new Map<string, any>();

    transacoesMes.forEach((t) => {
      const orcId = t.orcamentoId || t.orcamento_id;
      const pacId = t.pacienteId || t.paciente_id || '';
      const key = orcId ? `orc_${orcId}` : `pac_${pacId}_${t.descricao || 'avulso'}`;

      const orc = orcId ? orcamentosMap.get(orcId) : (orcamentos || []).find((o) => o.pacienteId === pacId && o.status === 'aprovado');
      const pac = pacId ? pacientesMap.get(pacId) : (orc?.pacienteId ? pacientesMap.get(orc.pacienteId) : null);
      const pacNome = pac?.nome || t.pacienteNome || orc?.pacienteNome || 'Paciente';

      const isPago = ehTransacaoPaga(t);
      const valor = Number(t.valor || 0);

      if (!grupos.has(key)) {
        const snap = (orc as any)?.assinatura_paciente || (orc as any)?.assinaturaPaciente || {};
        const codigoContrato = snap.codigoContrato || orc?.numero || (orc?.id ? `ORC-${String(orc.id).slice(0, 8).toUpperCase()}` : 'AVULSO');
        
        // Data real de fechamento do orçamento (sempre criada ou aprovada, sem atualizadoEm)
        const dataFechamento = orc
          ? (orc.aprovadoEm || orc.dataAssinatura || (orc as any).data_assinatura || snap.aprovadoEm || orc.criadoEm)
          : t.data;

        const saldoObj = orc ? (saldosMap.get(orc.id) || { total: Number(orc.total || 0), pago: 0, saldo: 0, percentual: 0 }) : null;

        grupos.set(key, {
          id: key,
          orcamento: orc,
          paciente: pac,
          pacNome,
          codigoContrato,
          dataFechamento,
          saldoGeral: saldoObj,
          transacoes: [],
          valorPagoMes: 0,
          valorPendenteMes: 0,
          valorParcelaMes: 0,
          formasPagamento: orc?.formasPagamento || orc?.formas_pagamento || t.metodoPagamento,
          parcelasInfo: orc?.parcelas ? `${orc.parcelas}x` : (t.parcelas ? `${t.parcelas}x` : ''),
        });
      }

      const item = grupos.get(key)!;
      item.transacoes.push(t);
      if (isPago) {
        item.valorPagoMes += valor;
      } else {
        item.valorPendenteMes += valor;
      }
      item.valorParcelaMes += valor;
    });

    const [anoSel, mesSel] = (selectedMonth || '').split('-').map(Number);

    // Também inclui orçamentos com parcelas programadas para o mês selecionado (ex: PIX parcelado, boleto)
    (orcamentos || []).forEach((o) => {
      if (!o || String(o.status || '').toLowerCase() !== 'aprovado') return;
      const snap = (o as any)?.assinatura_paciente || (o as any)?.assinaturaPaciente || {};
      if (
        o.statusFinanceiro === 'cancelado' ||
        o.statusFinanceiro === 'arquivado' ||
        snap.statusFinanceiro === 'cancelado' ||
        snap.statusFinanceiro === 'arquivado'
      ) {
        return;
      }

      const orcKey = `orc_${o.id}`;
      if (grupos.has(orcKey)) return;

      const parcelasOrc = extrairTodasParcelasOrcamento(o, transacoes);
      const parcelasDesteMes = parcelasOrc.filter(
        (p) => p.ano === anoSel && p.mes0Indexed === mesSel - 1
      );

      if (parcelasDesteMes.length > 0) {
        const codigoContrato = snap.codigoContrato || o.numero || `ORC-${String(o.id).slice(0, 8).toUpperCase()}`;
        const pac = o.pacienteId ? pacientesMap.get(o.pacienteId) : null;
        const pacNome = pac?.nome || o.pacienteNome || 'Paciente';
        const saldoObj = saldosMap.get(o.id) || { total: Number(o.total || 0), pago: 0, saldo: 0, percentual: 0 };
        const dataFechamento = o.aprovadoEm || o.dataAssinatura || (o as any).data_assinatura || snap.aprovadoEm || o.criadoEm;
        const valorPendente = parcelasDesteMes.reduce((s, p) => s + p.valor, 0);

        grupos.set(orcKey, {
          id: orcKey,
          orcamento: o,
          paciente: pac,
          pacNome,
          codigoContrato,
          dataFechamento,
          saldoGeral: saldoObj,
          transacoes: [],
          valorPagoMes: 0,
          valorPendenteMes: valorPendente,
          valorParcelaMes: valorPendente,
          formasPagamento: o.formasPagamento || o.formas_pagamento || parcelasDesteMes[0]?.metodo,
          parcelasInfo: o.parcelas ? `${o.parcelas}x` : `${parcelasDesteMes.length}x`,
          isPrevisaoFutura: true,
          dataVencimentoPrevista: parcelasDesteMes[0]?.dataBr,
        });
      }
    });

    const lista = Array.from(grupos.values()).map((item) => {
      const isQuitadaNoMes = item.valorPendenteMes <= 0.01;
      const amFechamento = extrairAnoMes(item.dataFechamento);
      const isPacienteOutroMes = Boolean(
        amFechamento &&
        anoSel &&
        mesSel &&
        (amFechamento.ano < anoSel || (amFechamento.ano === anoSel && amFechamento.mes < mesSel - 1))
      );
      const mesFechamento = amFechamento ? `${String(amFechamento.mes + 1).padStart(2, '0')}/${amFechamento.ano}` : '';

      return {
        ...item,
        isQuitadaNoMes,
        isPacienteOutroMes,
        mesFechamento,
      };
    });

    return lista;
  }, [transacoes, orcamentos, orcamentosMap, pacientesMap, saldosMap, selectedMonth]);

  // 2. VISÃO NOVOS CONTRATOS FECHADOS NO MÊS
  const contratosFechadosItens = useMemo(() => {
    return (orcamentosFechadosNoMes || [])
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
      });
  }, [orcamentosFechadosNoMes, pacientesMap, saldosMap]);

  // Totais agregados calculados para o cabeçalho
  const totaisParcelasMes = useMemo(() => {
    let pago = 0;
    let pendente = 0;
    parcelasDoMesItens.forEach((it) => {
      pago += it.valorPagoMes;
      pendente += it.valorPendenteMes;
    });
    const total = pago + pendente;
    return {
      total: resumoFinanceiro?.parcelasMesTotal || total,
      pago: resumoFinanceiro?.receitaCaixa || pago,
      pendente: resumoFinanceiro?.aReceberNoMes || pendente,
      quantidade: parcelasDoMesItens.length,
    };
  }, [parcelasDoMesItens, resumoFinanceiro]);

  const totaisContratos = useMemo(() => {
    const total = contratosFechadosItens.reduce((sum, c) => sum + Number(c.orcamento?.total || 0), 0);
    return {
      total: total || totalFechadoMes,
      quantidade: contratosFechadosItens.length,
    };
  }, [contratosFechadosItens, totalFechadoMes]);

  // Filtragem e busca
  const itensExibicao = useMemo(() => {
    if (abaVisao === 'parcelas_mes') {
      return parcelasDoMesItens.filter((item) => {
        if (filtroStatus === 'quitados' && !item.isQuitadaNoMes) return false;
        if (filtroStatus === 'pendentes' && item.isQuitadaNoMes) return false;

        if (busca.trim()) {
          const q = busca.toLowerCase();
          const matchNome = item.pacNome.toLowerCase().includes(q);
          const matchContrato = item.codigoContrato.toLowerCase().includes(q);
          const matchDesc = item.transacoes.some((t: any) => (t.descricao || '').toLowerCase().includes(q));
          if (!matchNome && !matchContrato && !matchDesc) return false;
        }

        return true;
      }).sort((a, b) => b.valorParcelaMes - a.valorParcelaMes);
    } else {
      return contratosFechadosItens.filter((item) => {
        if (filtroStatus === 'quitados' && !item.isQuitado) return false;
        if (filtroStatus === 'pendentes' && item.isQuitado) return false;

        if (busca.trim()) {
          const q = busca.toLowerCase();
          const matchNome = item.pacNome.toLowerCase().includes(q);
          const matchContrato = item.codigoContrato.toLowerCase().includes(q);
          if (!matchNome && !matchContrato) return false;
        }

        return true;
      }).sort((a, b) => Number(b.orcamento?.total || 0) - Number(a.orcamento?.total || 0));
    }
  }, [abaVisao, parcelasDoMesItens, contratosFechadosItens, filtroStatus, busca]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <span>Faturamento & Parcelas do Mês</span>
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold text-xs ml-1">
                  {mesFormatado}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Contabilização justa por competência: contabiliza apenas a parcela do mês vigente de cada paciente, sem inflar com o valor total de orçamentos parcelados.
              </DialogDescription>
            </div>

            {/* Alternador de Visão no Topo */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border/60 shrink-0 self-start sm:self-center">
              <Button
                variant={abaVisao === 'parcelas_mes' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAbaVisao('parcelas_mes')}
                className="h-7 text-xs font-semibold px-2.5"
              >
                Parcelas do Mês ({parcelasDoMesItens.length})
              </Button>
              <Button
                variant={abaVisao === 'contratos_fechados' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAbaVisao('contratos_fechados')}
                className="h-7 text-xs font-semibold px-2.5"
              >
                Novos Contratos ({contratosFechadosItens.length})
              </Button>
            </div>
          </div>

          {/* Cards Rápidos de Indicadores do Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-3">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                  {abaVisao === 'parcelas_mes' ? 'Parcelas do Mês Vigente' : 'Novos Contratos do Mês'}
                </span>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(abaVisao === 'parcelas_mes' ? totaisParcelasMes.total : totaisContratos.total)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {abaVisao === 'parcelas_mes' 
                    ? `${totaisParcelasMes.quantidade} paciente(s) com parcelas no mês`
                    : `${totaisContratos.quantidade} novo(s) contrato(s) aprovado(s)`}
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-3">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                  Já Recebido no Caixa
                </span>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(totaisParcelasMes.pago)}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                  Parcelas já quitadas no mês
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-3">
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                  A Receber no Mês
                </span>
                <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                  {formatMoney(totaisParcelasMes.pendente)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Parcelas com vencimento no mês
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
              placeholder={abaVisao === 'parcelas_mes' ? "Buscar paciente, descrição ou contrato..." : "Buscar novo contrato..."}
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
              Todos ({itensExibicao.length})
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
              A Receber
            </Button>
          </div>
        </div>

        {/* Lista de Itens com Rolagem */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {itensExibicao.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck2 className="h-12 w-12 mx-auto stroke-1 opacity-40 mb-3" />
              <p className="text-sm font-medium">Nenhum registro encontrado para os filtros selecionados.</p>
              <p className="text-xs mt-1">Verifique o termo buscado ou selecione outro mês no cabeçalho.</p>
            </div>
          ) : (
            itensExibicao.map((item: any) => {
              if (abaVisao === 'parcelas_mes') {
                const { id, pacNome, paciente, orcamento, codigoContrato, dataFechamento, saldoGeral, valorParcelaMes, valorPagoMes, valorPendenteMes, isQuitadaNoMes, parcelasInfo } = item;
                const totalContratoGeral = saldoGeral?.total || Number(orcamento?.total || 0);

                return (
                  <div
                    key={id}
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
                          {item.isPacienteOutroMes && (
                            <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[10px] font-semibold gap-1">
                              <History className="h-3 w-3" /> Paciente de Outro Mês (Fechado em {item.mesFechamento})
                            </Badge>
                          )}
                          {isQuitadaNoMes ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Parcela Quitada no Mês
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-semibold gap-1">
                              <Clock className="h-3 w-3" /> Parcela a Receber no Mês
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Contrato fechado em: {formatarData(dataFechamento)}
                          </span>
                          {item.isPrevisaoFutura && item.dataVencimentoPrevista && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              • Vencimento Previsto: <strong>{item.dataVencimentoPrevista}</strong>
                            </span>
                          )}
                          {totalContratoGeral > 0 && totalContratoGeral !== valorParcelaMes && (
                            <span className="text-muted-foreground">
                              • Tratamento Total: <strong className="text-foreground">{formatMoney(totalContratoGeral)}</strong> {parcelasInfo ? `(${parcelasInfo})` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Valores da Parcela do Mês Vigente */}
                      <div className="text-left sm:text-right sm:shrink-0">
                        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                          Parcela do Mês
                        </div>
                        <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                          {formatMoney(valorParcelaMes)}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center sm:justify-end gap-1.5 mt-0.5">
                          {valorPagoMes > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Quitado: {formatMoney(valorPagoMes)}
                            </span>
                          )}
                          {valorPendenteMes > 0 && (
                            <>
                              {valorPagoMes > 0 && <span>•</span>}
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                A receber: {formatMoney(valorPendenteMes)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progresso Geral do Tratamento (se houver orcamento vinculado) */}
                    {saldoGeral && saldoGeral.total > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                          <span>Quitação Global do Tratamento: {formatMoney(saldoGeral.pago)} de {formatMoney(saldoGeral.total)}</span>
                          <span>{saldoGeral.percentual.toFixed(0)}%</span>
                        </div>
                        <Progress value={saldoGeral.percentual} className="h-1.5" />
                      </div>
                    )}

                    {/* Ações Rápidas */}
                    <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {item.transacoes.length} lançamento(s) vinculados ao mês
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {valorPendenteMes > 0 && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => cobrarWhatsAppItem(item)}
                              className="h-7 text-xs gap-1 bg-[#25D366] hover:bg-[#20ba5a] text-white font-medium shadow-xs"
                              title="Cobrar parcela pelo WhatsApp com chave PIX e valor"
                            >
                              <MessageCircle className="h-3 w-3 fill-white" />
                              <span>Cobrar WhatsApp</span>
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => abrirRecebimento(item)}
                              className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                              title="Receber e dar baixa nesta parcela"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Baixar Parcela</span>
                            </Button>
                          </>
                        )}

                        {paciente?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/pacientes/${paciente.id}?tab=orcamentos`);
                            }}
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Prontuário</span>
                          </Button>
                        )}

                        {orcamento && onVerOrcamento && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onVerOrcamento(orcamento)}
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
              } else {
                // Visão Novos Contratos Fechados no Mês
                const { orcamento, pacNome, paciente, codigoContrato, dataAprovacao, saldo, isQuitado } = item;
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
                              <CheckCircle2 className="h-3 w-3" /> Quitado
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-semibold gap-1">
                              <Clock className="h-3 w-3" /> Em Andamento
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Fechado em: {formatarData(dataAprovacao)}
                          </span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right sm:shrink-0">
                        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                          Valor Contratado
                        </div>
                        <div className="text-lg font-black text-foreground">
                          {formatMoney(saldo.total)}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center sm:justify-end gap-1.5 mt-0.5">
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

                    <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                      {(() => {
                        const condicaoTexto =
                          orcamento.formasPagamento ||
                          (orcamento as any).formas_pagamento ||
                          (orcamento as any).condicaoEscolhida?.descricao ||
                          (orcamento as any).condicaoEscolhida?.nome ||
                          (orcamento as any).formaPagamento ||
                          (orcamento.observacoes ? orcamento.observacoes.slice(0, 60) + '...' : null);

                        return (
                          <span
                            className="text-[10px] text-muted-foreground max-w-xs sm:max-w-md truncate"
                            title={condicaoTexto || ''}
                          >
                            {condicaoTexto ? `Condição: ${condicaoTexto}` : 'Sem forma predefinida'}
                          </span>
                        );
                      })()}

                      <div className="flex flex-wrap items-center gap-1.5">
                        {saldo.saldo > 0.01 && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => cobrarWhatsAppItem({ ...item, valorPendenteMes: saldo.saldo })}
                              className="h-7 text-xs gap-1 bg-[#25D366] hover:bg-[#20ba5a] text-white font-medium shadow-xs"
                              title="Cobrar saldo pendente pelo WhatsApp com chave PIX e valor"
                            >
                              <MessageCircle className="h-3 w-3 fill-white" />
                              <span>Cobrar WhatsApp</span>
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => abrirRecebimento({ ...item, valorPendenteMes: saldo.saldo })}
                              className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                              title="Receber e dar baixa no saldo deste contrato"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Receber Saldo</span>
                            </Button>
                          </>
                        )}

                        {paciente?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/pacientes/${paciente.id}?tab=orcamentos`);
                            }}
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Prontuário</span>
                          </Button>
                        )}

                        {onVerOrcamento && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onVerOrcamento(orcamento)}
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
              }
            })
          )}
        </div>

        {/* Rodapé com Navegação para a aba Orçamentos & Parcelas */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Para gerenciar todas as cobranças e conciliações detalhadas, acesse a aba{' '}
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

      {/* Modal de Baixa Rápida de Parcela / Recebimento */}
      <ModalReceberPagamento
        isOpen={modalReceberOpen}
        onClose={() => {
          setModalReceberOpen(false);
          setRecebimentoPrefill(null);
        }}
        transacaoPendente={recebimentoPrefill?.transacao}
        pacientePredefinidoId={recebimentoPrefill?.pacienteId}
        orcamentoIdPredefinido={recebimentoPrefill?.orcamentoId}
        valorSugerido={recebimentoPrefill?.valor}
        descricaoSugerida={recebimentoPrefill?.descricao}
        onSuccess={() => {
          setModalReceberOpen(false);
          setRecebimentoPrefill(null);
        }}
      />
    </Dialog>
  );
};
