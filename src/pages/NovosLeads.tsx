import React, { useState, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import { useNovosLeads } from '@/hooks/useNovosLeads';
import {
  NovoLead,
  StatusNovoLead,
  PrioridadeNovoLead,
} from '@/types/novosLeads';
import {
  formatarTelefoneExibicao,
  normalizarTelefone,
} from '@/services/novosLeadsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  FileImage,
  MessageCircle,
  Calendar,
  Sparkles,
  UserCheck,
  ShieldAlert,
  Clock,
  DollarSign,
  Filter,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  ExternalLink,
  Archive,
  Phone,
} from 'lucide-react';
import ModalNovoLeadManual from '@/components/leads/ModalNovoLeadManual';
import ModalImportarCsv from '@/components/leads/ModalImportarCsv';
import ModalImportarScreenshot from '@/components/leads/ModalImportarScreenshot';
import LeadDetalhesModal from '@/components/leads/LeadDetalhesModal';
import ModalAgendamentoLead from '@/components/leads/ModalAgendamentoLead';
import ModalConversaoLead from '@/components/leads/ModalConversaoLead';
import ModalPerdaLead from '@/components/leads/ModalPerdaLead';
import ModalRevisarLead from '@/components/leads/ModalRevisarLead';
import { toast } from 'sonner';

export default function NovosLeads() {
  const {
    leads,
    loading,
    refreshing,
    unreviewedCount,
    refreshLeads,
    mudarStatus,
    registrarFollowUp,
    marcarComoRevisado,
  } = useNovosLeads();

  // Estados de modais
  const [modalNovoManualAberto, setModalNovoManualAberto] = useState(false);
  const [modalCsvAberto, setModalCsvAberto] = useState(false);
  const [modalScreenshotAberto, setModalScreenshotAberto] = useState(false);
  const [leadSelecionado, setLeadSelecionado] = useState<NovoLead | null>(null);

  // Modais de ação rápida na tabela
  const [leadParaAgendar, setLeadParaAgendar] = useState<NovoLead | null>(null);
  const [leadParaConverter, setLeadParaConverter] = useState<NovoLead | null>(null);
  const [leadParaPerder, setLeadParaPerder] = useState<NovoLead | null>(null);
  const [leadParaRevisar, setLeadParaRevisar] = useState<NovoLead | null>(null);

  // Controle de perguntas e respostas visíveis/ocultas por lead (ocultas por padrão)
  const [perguntasAbertas, setPerguntasAbertas] = useState<Record<string, boolean>>({});

  const togglePerguntas = (leadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPerguntasAbertas((prev) => ({
      ...prev,
      [leadId]: !prev[leadId],
    }));
  };

  const formatarDataLead = (iso?: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const dataStr = d.toLocaleDateString('pt-BR');
    const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dataStr} · ${horaStr}`;
  };

  const getTagInteresse = (lead: NovoLead) => {
    // 1. Procura se tem resposta sobre prazo / urgência
    const respPrazo = lead.respostas?.find((r) =>
      r.pergunta.toLowerCase().includes('quando') ||
      r.pergunta.toLowerCase().includes('pretende')
    )?.resposta?.toLowerCase() || '';

    if (
      respPrazo.includes('quanto antes') ||
      respPrazo.includes('15 dias') ||
      respPrazo.includes('próximos') ||
      respPrazo.includes('imediato') ||
      respPrazo.includes('urgente')
    ) {
      return (
        <Badge className="bg-rose-100/80 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/40 text-[11px] font-semibold px-2.5 py-0.5 rounded-md">
          Interesse em curto prazo
        </Badge>
      );
    }

    if (
      respPrazo.includes('informações') ||
      respPrazo.includes('enquanto') ||
      respPrazo.includes('pesquisando')
    ) {
      return (
        <Badge className="bg-amber-100/80 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/40 text-[11px] font-semibold px-2.5 py-0.5 rounded-md">
          Pesquisando informações
        </Badge>
      );
    }

    // 2. Se tem investimento
    const respInvestimento = lead.respostas?.find((r) =>
      r.pergunta.toLowerCase().includes('investimento') ||
      r.pergunta.toLowerCase().includes('valor')
    )?.resposta;

    if (respInvestimento && respInvestimento.toLowerCase() !== 'não informado') {
      return (
        <Badge className="bg-blue-100/80 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/40 text-[11px] font-semibold px-2.5 py-0.5 rounded-md">
          Investimento: {respInvestimento}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-muted-foreground text-[11px] font-medium px-2 py-0.5">
        {lead.origem || 'Meta Lead Ads'}
      </Badge>
    );
  };

  const getEtapaFollowUpAtual = (lead: NovoLead): string => {
    const concluidos = lead.follow_ups?.filter((f) => f.concluido) || [];
    if (concluidos.length === 0) return 'nao_iniciado';
    return concluidos[concluidos.length - 1].etapa;
  };

  const handleMudarEtapaFollowUp = async (lead: NovoLead, etapa: string) => {
    if (etapa === 'nao_iniciado') {
      const resetados = lead.follow_ups.map((f) => ({ ...f, concluido: false }));
      await novosLeadsService.atualizarLead(lead.id, { follow_ups: resetados });
      refreshLeads();
      toast.info('Etapa de follow-up reiniciada.');
      return;
    }

    try {
      await registrarFollowUp(lead.id, etapa as import('@/types/novosLeads').FollowUpItem['etapa'], {
        canal: 'whatsapp',
        data_contato: new Date().toISOString(),
      });
      toast.success('Etapa de follow-up atualizada.');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao atualizar follow-up: ' + errMsg);
    }
  };

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const [filtroRevisao, setFiltroRevisao] = useState<'todos' | 'nao_revisados' | 'revisados'>('todos');

  // Filtro dinâmico
  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Busca por texto
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const nomeMatch = (lead.nome || '').toLowerCase().includes(termo);
        const telMatch = (lead.telefone || '').replace(/\D/g, '').includes(termo.replace(/\D/g, ''));
        const campMatch = (lead.campanha || '').toLowerCase().includes(termo);
        const origMatch = (lead.origem || '').toLowerCase().includes(termo);
        const respMatch = (lead.respostas || []).some(
          (r) =>
            r.pergunta.toLowerCase().includes(termo) ||
            r.resposta.toLowerCase().includes(termo)
        );

        if (!nomeMatch && !telMatch && !campMatch && !origMatch && !respMatch) {
          return false;
        }
      }

      // 2. Filtro de Status
      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'arquivados') {
          if (!lead.arquivado && lead.status !== 'Perdido') return false;
        } else {
          if (lead.status !== filtroStatus) return false;
        }
      } else {
        // Por padrão oculta os perdidos/arquivados a menos que explicitamente filtrado
        if (lead.status === 'Perdido' || lead.arquivado) return false;
      }

      // 3. Filtro de Prioridade
      if (filtroPrioridade !== 'todas') {
        if (lead.prioridade !== filtroPrioridade) return false;
      }

      // 4. Filtro de Revisão
      if (filtroRevisao === 'nao_revisados' && lead.revisado) return false;
      if (filtroRevisao === 'revisados' && !lead.revisado) return false;

      return true;
    });
  }, [leads, busca, filtroStatus, filtroPrioridade, filtroRevisao]);

  // Métricas
  const metricas = useMemo(() => {
    const total = leads.length;
    const naoRevisados = unreviewedCount;
    const agendados = leads.filter((l) => l.status === 'Agendado').length;
    const convertidos = leads.filter((l) => l.status === 'Convertido');
    const valorTotalConvertido = convertidos.reduce(
      (acc, l) => acc + (l.valor_venda || 0),
      0
    );

    return {
      total,
      naoRevisados,
      agendados,
      convertidos: convertidos.length,
      valorTotalConvertido,
    };
  }, [leads, unreviewedCount]);

  // Disparo direto de WhatsApp com mensagem personalizada
  const handleAbrirWhatsApp = (e: React.MouseEvent, lead: NovoLead) => {
    e.stopPropagation();
    const tel = normalizarTelefone(lead.telefone).replace(/\D/g, '');
    if (!tel) {
      toast.error('Telefone não disponível para este lead.');
      return;
    }

    const primeiroNome = (lead.nome || '').split(' ')[0] || 'Olá';
    const saudacao = encodeURIComponent(
      `Olá ${primeiroNome}, tudo bem? Sou da equipe da Clínica Dra. Rosangela Santos. Vimos seu interesse através de nosso anúncio na Meta e gostaríamos de te passar todas as informações!`
    );

    window.open(`https://wa.me/${tel}?text=${saudacao}`, '_blank');
  };

  const getStatusBadge = (status: StatusNovoLead) => {
    switch (status) {
      case 'Pendente':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">Pendente</Badge>;
      case 'Interessado':
        return <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">Interessado</Badge>;
      case 'Agendado':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">Agendado</Badge>;
      case 'Começou mas não deu andamento':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">Não Deu Andamento</Badge>;
      case 'Convertido':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">Convertido</Badge>;
      case 'Perdido':
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">Perdido</Badge>;
    }
  };

  const getPrioridadeBadge = (p: PrioridadeNovoLead) => {
    switch (p) {
      case 'alta':
        return <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-700 bg-rose-50/50">Alta</Badge>;
      case 'media':
        return <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50/50">Média</Badge>;
      case 'baixa':
        return <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700 bg-slate-50/50">Baixa</Badge>;
    }
  };

  const handleStatusChange = (lead: NovoLead, novoStatus: StatusNovoLead) => {
    if (novoStatus === 'Agendado') {
      setLeadParaAgendar(lead);
    } else if (novoStatus === 'Convertido') {
      setLeadParaConverter(lead);
    } else if (novoStatus === 'Perdido') {
      setLeadParaPerder(lead);
    } else {
      mudarStatus(lead.id, novoStatus);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-md shadow-blue-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  Novos Leads
                  {unreviewedCount > 0 && (
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full animate-pulse">
                      {unreviewedCount} não revisados
                    </Badge>
                  )}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Central de captação e triagem de formulários do Meta Lead Ads (Instagram / Facebook), WhatsApp e importações.
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshLeads(true)}
              disabled={refreshing}
              className="text-xs font-semibold h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalCsvAberto(true)}
              className="text-xs font-semibold h-9 border-border"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Importar CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalScreenshotAberto(true)}
              className="text-xs font-semibold h-9 border-border"
            >
              <FileImage className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Importar Print
            </Button>

            <Button
              size="sm"
              onClick={() => setModalNovoManualAberto(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Total de Leads</span>
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-foreground">{metricas.total}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Registrados no sistema</p>
          </div>

          <div
            onClick={() => setFiltroRevisao(filtroRevisao === 'nao_revisados' ? 'todos' : 'nao_revisados')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filtroRevisao === 'nao_revisados'
                ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/30 dark:bg-blue-950/40'
                : 'bg-card border-border hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Não Revisados
              </span>
              <UserCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-400">
              {metricas.naoRevisados}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Aguardando conferência</p>
          </div>

          <div
            onClick={() => setFiltroStatus(filtroStatus === 'Agendado' ? 'todos' : 'Agendado')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filtroStatus === 'Agendado'
                ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/30 dark:bg-emerald-950/40'
                : 'bg-card border-border hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Agendados
              </span>
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {metricas.agendados}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Com alertas programados</p>
          </div>

          <div
            onClick={() => setFiltroStatus(filtroStatus === 'Convertido' ? 'todos' : 'Convertido')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filtroStatus === 'Convertido'
                ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/30 dark:bg-purple-950/40'
                : 'bg-card border-border hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                Convertidos ({metricas.convertidos})
              </span>
              <DollarSign className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-400 truncate">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              }).format(metricas.valorTotalConvertido)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Valor total de fechamentos</p>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, campanha ou resposta do formulário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 text-xs w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Status: Ativos</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Interessado">Interessado</SelectItem>
                <SelectItem value="Agendado">Agendado</SelectItem>
                <SelectItem value="Começou mas não deu andamento">Começou mas não deu andamento</SelectItem>
                <SelectItem value="Convertido">Convertido</SelectItem>
                <SelectItem value="arquivados">Arquivados / Perdidos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
              <SelectTrigger className="h-9 text-xs w-[130px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Prioridade: Todas</SelectItem>
                <SelectItem value="alta">🔴 Alta</SelectItem>
                <SelectItem value="media">🟡 Média</SelectItem>
                <SelectItem value="baixa">🟢 Baixa</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroRevisao} onValueChange={(v: any) => setFiltroRevisao(v)}>
              <SelectTrigger className="h-9 text-xs w-[140px]">
                <SelectValue placeholder="Revisão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Revisão: Todos</SelectItem>
                <SelectItem value="nao_revisados">⚠️ Não Revisados</SelectItem>
                <SelectItem value="revisados">✅ Já Revisados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista / Tabela da Caixa de Entrada */}
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground rounded-2xl border border-dashed flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            Carregando caixa de entrada de novos leads...
          </div>
        ) : leadsFiltrados.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed bg-muted/10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">
              Nenhum lead encontrado com estes filtros
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Quando novos formulários forem preenchidos no Instagram ou Facebook Ads, eles aparecerão aqui instantaneamente.
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBusca('');
                  setFiltroStatus('todos');
                  setFiltroPrioridade('todas');
                  setFiltroRevisao('todos');
                }}
              >
                Limpar Filtros
              </Button>
              <Button
                size="sm"
                onClick={() => setModalNovoManualAberto(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Cadastrar Lead Manualmente
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {leadsFiltrados.map((lead, index) => {
              const followUpsConcluidos = lead.follow_ups.filter((f) => f.concluido).length;
              const etapaAtual = getEtapaFollowUpAtual(lead);
              const isPerguntasAberta = Boolean(perguntasAbertas[lead.id]);

              return (
                <div
                  key={lead.id}
                  className="p-5 rounded-2xl border border-border bg-card shadow-xs hover:shadow-md transition-all space-y-4 relative"
                >
                  {/* Topo do Lead: Número + Nome + Data + Telefone + Tag + Botão WhatsApp */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3
                          onClick={() => setLeadSelecionado(lead)}
                          className="text-lg font-bold text-foreground hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {index + 1}. {lead.nome}
                        </h3>
                        {!lead.revisado && (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-2 py-0.5 font-semibold">
                            Não Revisado
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        <span>{formatarDataLead(lead.data_criacao)}</span>
                        <span>·</span>
                        <span className="font-mono text-foreground font-medium">
                          {formatarTelefoneExibicao(lead.telefone)}
                        </span>
                      </div>

                      <div className="pt-1">
                        {getTagInteresse(lead)}
                      </div>
                    </div>

                    {/* Botões de Ação Topo Direito: WhatsApp + Revisar */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={(e) => handleAbrirWhatsApp(e, lead)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-xs shrink-0 gap-1.5"
                      >
                        <span>WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLeadParaRevisar(lead)}
                        className="text-xs h-9 px-2.5 border-border text-muted-foreground hover:text-foreground"
                        title="Ver e editar cadastro completo do lead"
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-1" />
                        Revisar
                      </Button>
                    </div>
                  </div>

                  {/* Linha dos Selects: Estado do Lead & Etapa de Follow-up */}
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        ESTADO DO LEAD
                      </span>
                      <Select
                        value={lead.status}
                        onValueChange={(val) => handleStatusChange(lead, val as StatusNovoLead)}
                      >
                        <SelectTrigger className="w-full sm:w-[260px] h-9 text-xs font-semibold bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="Interessado">Interessado</SelectItem>
                          <SelectItem value="Agendado">Agendado</SelectItem>
                          <SelectItem value="Começou mas não deu andamento">Começou mas não deu andamento</SelectItem>
                          <SelectItem value="Convertido">Convertido</SelectItem>
                          <SelectItem value="Perdido">Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        ETAPA DE FOLLOW-UP
                      </span>
                      <Select
                        value={etapaAtual}
                        onValueChange={(etapa) => handleMudarEtapaFollowUp(lead, etapa)}
                      >
                        <SelectTrigger className="w-full sm:w-[260px] h-9 text-xs font-semibold bg-background">
                          <SelectValue placeholder="Não iniciado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao_iniciado">Não iniciado</SelectItem>
                          <SelectItem value="3h">1º Contato (3 horas)</SelectItem>
                          <SelectItem value="15h">2º Contato (15 horas)</SelectItem>
                          <SelectItem value="24h">3º Contato (24 horas / 1 dia)</SelectItem>
                          <SelectItem value="3d">4º Contato (3º dia)</SelectItem>
                          <SelectItem value="4d">5º Contato (4º dia)</SelectItem>
                          <SelectItem value="6d">6º Contato (6º dia)</SelectItem>
                          <SelectItem value="8d">7º Contato (8º dia)</SelectItem>
                          <SelectItem value="15d">8º Contato (15º dia)</SelectItem>
                          <SelectItem value="30d">9º Contato (30º dia)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Selecione uma etapa para iniciar o acompanhamento.
                    </p>
                  </div>

                  {/* Seção Oculta de Perguntas e Respostas com Seta */}
                  <div className="pt-2 border-t border-border/60">
                    <button
                      type="button"
                      onClick={(e) => togglePerguntas(lead.id, e)}
                      className="text-xs font-bold text-rose-950 dark:text-rose-200 hover:opacity-80 flex items-center gap-1.5 transition-opacity cursor-pointer py-1"
                    >
                      <span className="text-[10px]">{isPerguntasAberta ? '▲' : '▼'}</span>
                      <span>
                        {isPerguntasAberta
                          ? 'Ocultar perguntas e respostas'
                          : 'Ver perguntas e respostas'}
                      </span>
                    </button>

                    {isPerguntasAberta && (
                      <div className="pt-3 pb-1 space-y-3 animate-in fade-in-50 duration-200">
                        {lead.respostas && lead.respostas.length > 0 ? (
                          lead.respostas.map((r, i) => (
                            <div key={i} className="text-xs space-y-0.5">
                              <p className="text-muted-foreground font-normal">
                                {i + 1}. {r.pergunta}
                              </p>
                              <p className="font-bold text-foreground">
                                {r.resposta || 'Não informado'}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Nenhuma resposta de formulário registrada para este lead.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modais Globais do Módulo */}
      <ModalNovoLeadManual
        isOpen={modalNovoManualAberto}
        onClose={() => setModalNovoManualAberto(false)}
        onLeadCriado={() => refreshLeads(true)}
      />

      <ModalImportarCsv
        isOpen={modalCsvAberto}
        onClose={() => setModalCsvAberto(false)}
        onImportacaoConcluida={() => refreshLeads(true)}
      />

      <ModalImportarScreenshot
        isOpen={modalScreenshotAberto}
        onClose={() => setModalScreenshotAberto(false)}
        onImportacaoConcluida={() => refreshLeads(true)}
      />

      <LeadDetalhesModal
        isOpen={Boolean(leadSelecionado)}
        onClose={() => setLeadSelecionado(null)}
        lead={leadSelecionado}
        onMudarStatus={mudarStatus}
        onRegistrarFollowUp={registrarFollowUp}
        onLeadAtualizado={(atualizado) => {
          setLeadSelecionado(atualizado);
          refreshLeads(true);
        }}
      />

      <ModalAgendamentoLead
        isOpen={Boolean(leadParaAgendar)}
        onClose={() => setLeadParaAgendar(null)}
        lead={leadParaAgendar}
        onConfirmar={async (dataHoraIso, alertas) => {
          if (!leadParaAgendar) return;
          await mudarStatus(leadParaAgendar.id, 'Agendado', {
            agendado_para: dataHoraIso,
            alertas_agendamento: alertas,
          });
        }}
      />

      <ModalConversaoLead
        isOpen={Boolean(leadParaConverter)}
        onClose={() => setLeadParaConverter(null)}
        lead={leadParaConverter}
        onConfirmar={async (valorVenda, converterEmPaciente) => {
          if (!leadParaConverter) return;
          await mudarStatus(leadParaConverter.id, 'Convertido', {
            valor_venda: valorVenda,
          });
          if (converterEmPaciente) {
            setLeadParaRevisar(leadParaConverter);
          }
        }}
      />

      <ModalPerdaLead
        isOpen={Boolean(leadParaPerder)}
        onClose={() => setLeadParaPerder(null)}
        lead={leadParaPerder}
        onConfirmar={async (motivo, detalhes) => {
          if (!leadParaPerder) return;
          await mudarStatus(leadParaPerder.id, 'Perdido', {
            motivo_perda: motivo,
          });
        }}
      />

      <ModalRevisarLead
        isOpen={Boolean(leadParaRevisar)}
        onClose={() => setLeadParaRevisar(null)}
        lead={leadParaRevisar}
        onLeadAtualizado={() => refreshLeads(true)}
      />
    </Layout>
  );
}
