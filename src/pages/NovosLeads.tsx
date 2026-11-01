import React, { useState, useMemo, useEffect, useRef } from 'react';
import Layout from '@/components/layout/Layout';
import { useNovosLeads } from '@/hooks/useNovosLeads';
import {
  NovoLead,
  StatusNovoLead,
  PrioridadeNovoLead,
  RespostaFormulario,
} from '@/types/novosLeads';
import {
  formatarTelefoneExibicao,
  normalizarTelefone,
  novosLeadsService,
} from '@/services/novosLeadsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  FileImage,
  ExternalLink,
  Download,
  Calendar,
  Clock,
  Bell,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Search,
} from 'lucide-react';
import ModalNovoLeadManual from '@/components/leads/ModalNovoLeadManual';
import ModalImportarCsv from '@/components/leads/ModalImportarCsv';
import ModalImportarScreenshot from '@/components/leads/ModalImportarScreenshot';
import LeadDetalhesModal from '@/components/leads/LeadDetalhesModal';
import ModalRevisarLead from '@/components/leads/ModalRevisarLead';
import { toast } from 'sonner';

// Etapas oficiais do fluxo de Follow-up (12 etapas)
const STAGES = [
  'Não iniciado',
  'CONTATO INICIAL',
  '3H',
  '15H',
  '24H',
  '3º dia',
  '4º dia',
  '6º dia',
  '8º dia',
  '15º dia',
  '30º dia',
  'Finalizado',
];

// Intervalos em horas para cálculo da próxima etapa (3H..30º dia)
const STAGE_OFFSETS = [3, 15, 24, 72, 96, 144, 192, 360, 720];

// Perguntas padrão da clínica odontológica
const QUESTIONS = [
  'O que você gostaria de melhorar no seu sorriso?',
  'Você já fez algum tratamento estético nos dentes?',
  'Quando você pretende realizar o tratamento ou as lentes?',
  'Qual investimento você imagina ou tem para seu novo sorriso?',
];

// Status padrão do lead
const STATUS_OPTIONS: StatusNovoLead[] = [
  'Pendente',
  'Agendado',
  'Interessado',
  'Começou mas não deu andamento',
  'Convertido',
  'Perdido',
];

// Etapas de lembretes de consulta agendada (antecipação)
interface ReminderStep {
  id: '72h' | '48h' | '24h' | '3h';
  label: string;
  hours: number;
}

const REMINDER_STEPS: ReminderStep[] = [
  { id: '72h', label: '3 dias antes', hours: 72 },
  { id: '48h', label: '2 dias antes', hours: 48 },
  { id: '24h', label: '1 dia antes', hours: 24 },
  { id: '3h', label: '3 horas antes', hours: 3 },
];

export default function NovosLeads() {
  const {
    leads,
    loading,
    refreshing,
    unreviewedCount,
    refreshLeads,
    mudarStatus,
  } = useNovosLeads();

  // Modais de suporte
  const [modalNovoManualAberto, setModalNovoManualAberto] = useState(false);
  const [modalCsvAberto, setModalCsvAberto] = useState(false);
  const [modalScreenshotAberto, setModalScreenshotAberto] = useState(false);
  const [leadSelecionado, setLeadSelecionado] = useState<NovoLead | null>(null);
  const [leadParaRevisar, setLeadParaRevisar] = useState<NovoLead | null>(null);

  // Estados de filtros da toolbar (iguais ao HTML do painel)
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroNovos, setFiltroNovos] = useState<'new' | 'all' | 'older'>('all');
  const [filtroFollow, setFiltroFollow] = useState<string>('');
  const [ordenacao, setOrdenacao] = useState<'new' | 'old'>('new');
  const [archiveView, setArchiveView] = useState(false);
  const [expandAll, setExpandAll] = useState(false);

  // Estados locais para inputs em edição (motivo de perda, valor de venda)
  const [motivosPerdaInput, setMotivosPerdaInput] = useState<Record<string, string>>({});
  const [valoresVendaInput, setValoresVendaInput] = useState<Record<string, string>>({});

  // Utilitários de data e formatação
  const localDatetime = (d: string | Date): string => {
    try {
      const x = new Date(d);
      if (isNaN(x.getTime())) return '';
      return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const showDatetime = (d?: string | Date | null): string => {
    if (!d) return 'Data indisponível';
    try {
      const x = new Date(d);
      if (isNaN(x.getTime())) return String(d);
      return x.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return String(d);
    }
  };

  const brl = (val: number): string => {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const parseMoney = (v: string): number | null => {
    let clean = String(v || '').trim().replace(/[^\d,.]/g, '');
    if (!clean) return null;
    if (clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if ((clean.match(/\./g) || []).length > 1) {
      clean = clean.replace(/\./g, '');
    }
    const n = Number(clean);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  };

  // Cálculo da próxima etapa de follow-up
  const nextFollow = (lead: NovoLead): { label: string; date: Date } | null => {
    const stage = lead.follow_up_stage;
    const updatedAt = lead.follow_up_updated_at || lead.data_criacao;
    if (!stage || !updatedAt) return null;
    const i = STAGES.indexOf(stage);
    if (i < 1 || i >= STAGES.length - 2) return null;
    const targetHours = STAGE_OFFSETS[i - 1];
    if (targetHours === undefined) return null;
    return {
      label: STAGES[i + 1] || 'Próximo contato',
      date: new Date(new Date(updatedAt).getTime() + targetHours * 3600000),
    };
  };

  const getFollowState = (lead: NovoLead): {
    type: 'overdue' | 'today' | 'soon' | 'later' | 'none';
    next: { label: string; date: Date } | null;
  } => {
    const n = nextFollow(lead);
    if (!n) return { type: 'none', next: null };
    const now = new Date();
    const today = n.date.toDateString() === now.toDateString();
    return {
      type: n.date <= now ? 'overdue' : today ? 'today' : n.date.getTime() - now.getTime() <= 86400000 ? 'soon' : 'later',
      next: n,
    };
  };

  // Cálculo dos lembretes de consulta
  const reminderDate = (dateStr: string, step: ReminderStep): Date => {
    return new Date(new Date(dateStr).getTime() - step.hours * 3600000);
  };

  const reminderText = (lead: NovoLead, step: ReminderStep, apDate: string): string => {
    const first = (lead.nome || '').trim().split(/\s+/)[0] || 'Olá';
    const d = new Date(apDate);
    const dateFormatted = d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
    const hourFormatted = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (step.id === '72h') {
      return `Olá, ${first}! Tudo bem? 💙 Sua avaliação com a Dra. Rosângela está agendada para ${dateFormatted}, às ${hourFormatted}. Estamos preparando tudo para receber você com carinho e atenção. Qualquer dúvida antes do nosso encontro, pode nos chamar!`;
    }
    if (step.id === '48h') {
      return `Oi, ${first}! 💙 Faltam 2 dias para sua avaliação com a Dra. Rosângela, no dia ${dateFormatted}, às ${hourFormatted}. Cada sorriso tem sua história, e será um prazer entender o que você deseja transformar. Até breve!`;
    }
    if (step.id === '24h') {
      return `Olá, ${first}! Passando para confirmar sua avaliação com a Dra. Rosângela amanhã, às ${hourFormatted}. Podemos contar com sua presença? 💙`;
    }
    return `Oi, ${first}! 💙 Sua avaliação com a Dra. Rosângela será hoje, às ${hourFormatted}. Estamos aguardando você. Até já!`;
  };

  const handleSendReminder = (lead: NovoLead, step: ReminderStep) => {
    if (!lead.agendado_para) return;
    const phone = normalizarTelefone(lead.telefone).replace(/\D/g, '');
    const msg = reminderText(lead, step, lead.agendado_para);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleMarkReminder = async (lead: NovoLead, stepId: string) => {
    const atuais = { ...(lead.lembretes_enviados || {}) };
    atuais[stepId] = new Date().toISOString();
    await novosLeadsService.atualizarLead(lead.id, { lembretes_enviados: atuais });
    refreshLeads();
    toast.success('Lembrete marcado como enviado.');
  };

  const handleUnmarkReminder = async (lead: NovoLead, stepId: string) => {
    const atuais = { ...(lead.lembretes_enviados || {}) };
    delete atuais[stepId];
    await novosLeadsService.atualizarLead(lead.id, { lembretes_enviados: atuais });
    refreshLeads();
    toast.info('Lembrete desmarcado.');
  };

  // Atualização de Status
  const handleUpdateStatus = async (lead: NovoLead, novoStatus: StatusNovoLead) => {
    const updates: Partial<NovoLead> = { status: novoStatus };
    if (novoStatus !== 'Perdido') {
      updates.motivo_perda = null;
      updates.motivo_perda_data = null;
      updates.arquivado = false;
    } else {
      updates.arquivado = true;
    }
    await novosLeadsService.atualizarLead(lead.id, updates);
    refreshLeads();
    toast.success(`Status de ${lead.nome} atualizado para ${novoStatus}.`);
  };

  // Salvar motivo da perda e arquivar
  const handleSaveLoss = async (lead: NovoLead) => {
    const reason = (motivosPerdaInput[lead.id] || '').trim();
    if (!reason) {
      toast.error('Informe o motivo da perda para arquivar o lead.');
      return;
    }
    await novosLeadsService.atualizarLead(lead.id, {
      status: 'Perdido',
      motivo_perda: reason,
      motivo_perda_data: new Date().toISOString(),
      arquivado: true,
    });
    refreshLeads();
    toast.success('Motivo salvo e lead arquivado com sucesso.');
  };

  // Restaurar lead perdido
  const handleRestoreLead = async (lead: NovoLead) => {
    await novosLeadsService.atualizarLead(lead.id, {
      status: 'Interessado',
      motivo_perda: null,
      motivo_perda_data: null,
      arquivado: false,
    });
    refreshLeads();
    toast.success(`Lead ${lead.nome} restaurado para a lista ativa como Interessado.`);
  };

  // Atualização de Valor de Venda
  const handleUpdateSale = async (lead: NovoLead, valStr: string) => {
    const valNum = parseMoney(valStr);
    await novosLeadsService.atualizarLead(lead.id, { valor_venda: valNum });
    refreshLeads();
  };

  // Atualização de Data de Consulta
  const handleSetAppointment = async (lead: NovoLead, val: string) => {
    if (!val) {
      await novosLeadsService.atualizarLead(lead.id, { agendado_para: null, lembretes_enviados: {} });
      refreshLeads();
      toast.info('Consulta desmarcada.');
      return;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      toast.error('Informe uma data e horário válidos.');
      return;
    }
    await novosLeadsService.atualizarLead(lead.id, {
      agendado_para: d.toISOString(),
      status: 'Agendado',
      lembretes_enviados: {},
    });
    refreshLeads();
    toast.success('Horário da consulta salvo com lembretes automáticos programados.');
  };

  // Atualização de Etapa de Follow-up
  const handleChangeFollow = async (lead: NovoLead, stage: string) => {
    const nowIso = new Date().toISOString();
    await novosLeadsService.atualizarLead(lead.id, {
      follow_up_stage: stage,
      follow_up_updated_at: nowIso,
    });
    refreshLeads();
    toast.success(`Etapa de follow-up atualizada para: ${stage}`);
  };

  const handleChangeFollowTime = async (lead: NovoLead, val: string) => {
    if (!val) return;
    const d = new Date(val);
    if (isNaN(d.getTime())) return;
    await novosLeadsService.atualizarLead(lead.id, {
      follow_up_updated_at: d.toISOString(),
    });
    refreshLeads();
    toast.info('Horário de atualização corrigido.');
  };

  // Notificações do Navegador (Web Notification API)
  const notifiedRef = useRef<Record<string, boolean>>({});

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('Seu navegador não oferece notificações.');
      return;
    }
    const r = await Notification.requestPermission();
    if (r === 'granted') {
      toast.success('Alertas habilitados enquanto o painel estiver aberto!');
      checkAndNotify();
    } else {
      toast.error('Permissão de notificações não concedida.');
    }
  };

  const checkAndNotify = () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();

    leads.forEach((l) => {
      // 1. Follow-ups
      if (!['Convertido', 'Perdido'].includes(l.status) && !l.arquivado) {
        const n = nextFollow(l);
        if (n && n.date <= now) {
          const k = `fu_${l.id}_${n.label}_${n.date.toISOString().slice(0, 13)}`;
          if (!notifiedRef.current[k]) {
            notifiedRef.current[k] = true;
            new Notification(`Follow-up pendente: ${l.nome}`, {
              body: `${n.label} · previsto para ${showDatetime(n.date)}`,
              tag: `followup-${l.id}`,
            });
          }
        }
      }

      // 2. Consultas e lembretes
      if (l.status === 'Agendado' && l.agendado_para) {
        const apDate = new Date(l.agendado_para);
        if (apDate >= now) {
          REMINDER_STEPS.forEach((step) => {
            const due = reminderDate(l.agendado_para!, step);
            const k = `ap_${l.id}_${l.agendado_para}_${step.id}`;
            if (!l.lembretes_enviados?.[step.id] && due <= now && !notifiedRef.current[k]) {
              notifiedRef.current[k] = true;
              new Notification(`Lembrete de consulta: ${l.nome}`, {
                body: `${step.label} · Consulta ${showDatetime(l.agendado_para)}`,
                tag: `consulta-${l.id}-${step.id}`,
              });
            }
          });
        }
      }
    });
  };

  useEffect(() => {
    const timer = setInterval(checkAndNotify, 60000);
    return () => clearInterval(timer);
  }, [leads]);

  // Download do CSV Completo Atualizado
  const handleDownloadCsv = () => {
    const heads = [
      'Nome',
      'Data',
      'Hora',
      'Telefone',
      'Status',
      'Valor da venda (R$)',
      'Campanha',
      'Criativo',
      'Melhoria desejada',
      'Tratamento anterior',
      'Quando pretende',
      'Investimento',
      'Etapa de follow-up',
      'Última atualização',
      'Próxima etapa',
      'Vencimento do follow-up',
      'Data e hora da consulta',
      'Lembretes enviados',
      'Motivo da perda',
      'Arquivado em',
    ];

    const values = leads.map((l) => {
      const d = l.data_criacao ? new Date(l.data_criacao) : null;
      const dataStr = d ? d.toLocaleDateString('pt-BR') : '';
      const horaStr = d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      const n = nextFollow(l);

      const resp1 = l.respostas?.[0]?.resposta || '';
      const resp2 = l.respostas?.[1]?.resposta || '';
      const resp3 = l.respostas?.[2]?.resposta || '';
      const resp4 = l.respostas?.[3]?.resposta || '';

      const lembretesList = REMINDER_STEPS.filter((step) => l.lembretes_enviados?.[step.id])
        .map((s) => s.label)
        .join(', ');

      return [
        l.nome,
        dataStr,
        horaStr,
        l.telefone,
        l.status || 'Pendente',
        l.valor_venda ?? '',
        l.campanha || '',
        l.criativo || '',
        resp1,
        resp2,
        resp3,
        resp4,
        l.follow_up_stage || 'Não iniciado',
        l.follow_up_updated_at ? showDatetime(l.follow_up_updated_at) : '',
        n?.label || '',
        n?.date ? showDatetime(n.date) : '',
        l.agendado_para ? showDatetime(l.agendado_para) : '',
        lembretesList,
        l.motivo_perda || '',
        l.motivo_perda_data ? showDatetime(l.motivo_perda_data) : '',
      ];
    });

    const quote = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [heads, ...values].map((row) => row.map(quote).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_rosangela_atualizados_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success('Planilha CSV gerada e baixada com sucesso!');
  };

  // Filtros dinâmicos dos leads
  const leadsFiltrados = useMemo(() => {
    let list = leads.filter((l) => {
      // 1. Arquivados vs Ativos
      const isArchived = Boolean(l.arquivado || l.status === 'Perdido');
      if (archiveView !== isArchived) return false;

      // 2. Busca
      if (busca.trim()) {
        const q = busca.toLowerCase().trim();
        const nomeMatch = (l.nome || '').toLowerCase().includes(q);
        const telMatch = (l.telefone || '').includes(q.replace(/\D/g, ''));
        const campMatch = (l.campanha || '').toLowerCase().includes(q);
        const criatMatch = (l.criativo || '').toLowerCase().includes(q);
        const respMatch = (l.respostas || []).some(
          (r) => r.pergunta.toLowerCase().includes(q) || r.resposta.toLowerCase().includes(q)
        );
        if (!nomeMatch && !telMatch && !campMatch && !criatMatch && !respMatch) {
          return false;
        }
      }

      // 3. Status
      if (filtroStatus && (l.status || 'Pendente') !== filtroStatus) {
        return false;
      }

      // 4. Novos Leads
      if (filtroNovos === 'new' && !l.isNew) return false;
      if (filtroNovos === 'older' && l.isNew) return false;

      // 5. Follow-up
      if (filtroFollow) {
        if (['Convertido', 'Perdido'].includes(l.status)) return false;
        const fs = getFollowState(l);
        if (fs.type !== filtroFollow) return false;
      }

      return true;
    });

    if (ordenacao === 'old') {
      list = [...list].sort((a, b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime());
    } else {
      list = [...list].sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime());
    }

    return list;
  }, [leads, busca, filtroStatus, filtroNovos, filtroFollow, ordenacao, archiveView]);

  // Contadores e métricas de estatísticas
  const stats = useMemo(() => {
    const all = leads;
    const counts: Record<string, number> = {};
    STATUS_OPTIONS.forEach((st) => {
      counts[st] = all.filter((l) => (l.status || 'Pendente') === st).length;
    });
    const totalVendas = all
      .filter((l) => (l.status || 'Pendente') === 'Convertido')
      .reduce((sum, l) => sum + (Number(l.valor_venda) || 0), 0);
    const novosCount = all.filter((l) => l.isNew).length;
    const archiveCount = all.filter((l) => Boolean(l.arquivado || l.status === 'Perdido')).length;

    // Resumo de Consultas
    let scheduled = 0;
    let pendingReminders = 0;
    let todayReminders = 0;
    const now = new Date();
    all.forEach((l) => {
      if ((l.status || 'Pendente') === 'Agendado' && l.agendado_para) {
        scheduled++;
        REMINDER_STEPS.forEach((step) => {
          const when = reminderDate(l.agendado_para!, step);
          if (!l.lembretes_enviados?.[step.id] && when <= now && new Date(l.agendado_para!) >= now) {
            pendingReminders++;
            if (when.toDateString() === now.toDateString()) todayReminders++;
          }
        });
      }
    });

    // Resumo de Follow-ups
    let overdue = 0;
    let todayFollows = 0;
    let soonFollows = 0;
    all.forEach((l) => {
      if (['Convertido', 'Perdido'].includes(l.status) || l.arquivado) return;
      const x = getFollowState(l);
      if (x.type === 'overdue') overdue++;
      else if (x.type === 'today') todayFollows++;
      else if (x.type === 'soon') soonFollows++;
    });

    return {
      allCount: all.length,
      counts,
      totalVendas,
      novosCount,
      archiveCount,
      scheduled,
      pendingReminders,
      todayReminders,
      overdue,
      todayFollows,
      soonFollows,
    };
  }, [leads]);

  return (
    <Layout>
      <div className="max-w-[1140px] mx-auto px-3 sm:px-5 py-6 pb-20 space-y-5">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="text-[12px] font-extrabold tracking-widest text-[#a05d72] dark:text-[#f7bbcf] uppercase">
              Gestão comercial • Odontologia
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              Leads da Dra. Rosângela
              {stats.novosCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-[#fff0c8] text-[#875400] dark:bg-[#4a3407] dark:text-[#ffd880] rounded-full px-2.5 py-0.5 text-xs font-bold shadow-2xs">
                  ★ {stats.novosCount} novos leads
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {stats.allCount} contatos • {stats.novosCount} novos leads em destaque por criativo • WhatsApp e acompanhamento
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCsv}
              className="bg-[#78485a] hover:bg-[#633a49] text-white border-transparent text-xs font-semibold h-9 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar CSV atualizado
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshLeads(true)}
              disabled={refreshing}
              className="text-xs h-9 font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalCsvAberto(true)}
              className="text-xs h-9 font-medium"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Planilha
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalScreenshotAberto(true)}
              className="text-xs h-9 font-medium"
            >
              <FileImage className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Print
            </Button>

            <Button
              size="sm"
              onClick={() => setModalNovoManualAberto(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Novo Lead
            </Button>
          </div>
        </header>

        {/* Grade de Estatísticas / Cards (7 cards) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
            <strong className="text-2xl font-black text-foreground block">{stats.allCount}</strong>
            <small className="text-xs text-muted-foreground">Total de leads</small>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
            <strong className="text-2xl font-black text-emerald-600 block">{stats.counts['Agendado'] || 0}</strong>
            <small className="text-xs text-muted-foreground">Agendados</small>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
            <strong className="text-2xl font-black text-blue-600 block">{stats.counts['Interessado'] || 0}</strong>
            <small className="text-xs text-muted-foreground">Interessados</small>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
            <strong className="text-2xl font-black text-purple-600 block">{stats.counts['Convertido'] || 0}</strong>
            <small className="text-xs text-muted-foreground">Convertidos</small>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
            <strong className="text-2xl font-black text-amber-600 block">
              {stats.counts['Começou mas não deu andamento'] || 0}
            </strong>
            <small className="text-xs text-muted-foreground">Sem andamento</small>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
            <strong className="text-2xl font-black text-rose-600 block">{stats.counts['Perdido'] || 0}</strong>
            <small className="text-xs text-muted-foreground">Perdidos</small>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 shadow-2xs col-span-2 sm:col-span-1">
            <strong className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-300 block truncate">
              {brl(stats.totalVendas)}
            </strong>
            <small className="text-xs text-muted-foreground">Faturamento convertido</small>
          </div>
        </section>

        {/* Toolbar Principal */}
        <div className="flex flex-wrap items-center gap-2.5 bg-card/60 p-2 rounded-xl border border-border">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Buscar por nome, telefone, campanha ou criativo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <select
            id="filter"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-border bg-background font-medium text-foreground cursor-pointer"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            id="newFilter"
            value={filtroNovos}
            onChange={(e) => setFiltroNovos(e.target.value as 'new' | 'all' | 'older')}
            className="h-9 px-3 text-xs rounded-lg border border-border bg-background font-medium text-foreground cursor-pointer"
          >
            <option value="new">★ Novos leads ({stats.novosCount})</option>
            <option value="all">Todos os leads</option>
            <option value="older">Leads anteriores</option>
          </select>

          <select
            id="order"
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as 'new' | 'old')}
            className="h-9 px-3 text-xs rounded-lg border border-border bg-background font-medium text-foreground cursor-pointer"
          >
            <option value="new">Mais recentes primeiro</option>
            <option value="old">Mais antigos primeiro</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandAll(!expandAll)}
            className="h-9 text-xs font-semibold"
          >
            {expandAll ? 'Recolher respostas' : 'Expandir respostas'}
          </Button>
        </div>

        {/* Caixas de Aviso / Resumo de Consultas e Follow-ups */}
        <div className="space-y-2.5">
          <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200">
            <strong>Agenda de consultas:</strong> {stats.scheduled} consulta(s) cadastrada(s) · {stats.pendingReminders}{' '}
            lembrete(s) pendente(s) · {stats.todayReminders} vencido(s) hoje.{' '}
            <span className="text-muted-foreground">Alertas no navegador dependem de manter esta página aberta.</span>
          </div>

          <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-950 dark:text-amber-200">
            <strong>Follow-ups:</strong> {stats.overdue} atrasado(s) · {stats.todayFollows} vencem hoje ·{' '}
            {stats.soonFollows} nas próximas 24h.{' '}
            <span className="text-muted-foreground">
              A agenda é recalculada ao atualizar a etapa e considera a data/hora dessa atualização.
            </span>
          </div>
        </div>

        {/* Barra de Filtro de Follow-up + Botão de Notificação */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <select
              id="followFilter"
              value={filtroFollow}
              onChange={(e) => setFiltroFollow(e.target.value)}
              className="h-9 px-3 text-xs rounded-lg border border-border bg-background font-medium text-foreground cursor-pointer"
            >
              <option value="">Todos os follow-ups</option>
              <option value="overdue">Atrasados</option>
              <option value="today">Vencem hoje</option>
              <option value="soon">Próximas 24 horas</option>
              <option value="none">Sem acompanhamento</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={enableNotifications}
            className="h-9 text-xs font-semibold gap-1.5"
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            Ativar alertas neste navegador
          </Button>
        </div>

        {/* Barra de Abas: Leads Ativos vs Arquivados */}
        <div className="flex items-center gap-2 border-b border-border/80 pb-2">
          <button
            type="button"
            onClick={() => setArchiveView(false)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              !archiveView
                ? 'bg-[#78485a] text-white shadow-xs'
                : 'text-muted-foreground hover:bg-muted/40'
            }`}
          >
            Leads ativos
          </button>
          <button
            type="button"
            onClick={() => setArchiveView(true)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              archiveView
                ? 'bg-[#78485a] text-white shadow-xs'
                : 'text-muted-foreground hover:bg-muted/40'
            }`}
          >
            Arquivados ({stats.archiveCount})
          </button>
        </div>

        {/* Lista de Cards de Leads (2 Colunas no Desktop / 1 Coluna no Mobile) */}
        {loading ? (
          <div className="p-16 text-center text-xs text-muted-foreground rounded-2xl border border-dashed flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#78485a]" />
            <span>Carregando painel de novos leads...</span>
          </div>
        ) : leadsFiltrados.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground rounded-2xl border border-dashed bg-muted/10">
            Nenhum lead encontrado para este filtro.
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leadsFiltrados.map((lead, idx) => {
              const globalIdx = idx + 1;
              const telLimpo = (lead.telefone || '').replace(/\D/g, '');
              const d = lead.data_criacao ? new Date(lead.data_criacao) : null;
              const dataFormatada = d ? d.toLocaleDateString('pt-BR') : 'Data indisponível';
              const horaFormatada = d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Hora indisponível';

              // Deteccao de urgencia / curto prazo pelas respostas
              const isRapid = (lead.respostas || []).some((r) => {
                const txt = (r.resposta || '').toLowerCase();
                return txt.includes('quanto antes') || txt.includes('essa semana') || txt.includes('15 dias') || txt.includes('imediato');
              });

              // Status de Follow-up
              const fs = getFollowState(lead);

              // Lembretes do Agendamento
              const ap = lead.agendado_para;

              return (
                <article
                  key={lead.id}
                  className={`bg-card rounded-[18px] p-4 sm:p-5 transition-all space-y-3.5 ${
                    lead.isNew
                      ? 'border-2 border-[#d49b37] dark:border-amber-500 shadow-[0_5px_18px_rgba(218,166,77,0.18)]'
                      : 'border border-border/90 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  {/* Topo do Card: Nome + Telefone + Data + Tags + Botão WhatsApp */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div
                        onClick={() => setLeadParaRevisar(lead)}
                        className="text-base sm:text-lg font-bold text-foreground hover:text-blue-600 transition-colors cursor-pointer truncate"
                        title={lead.nome}
                      >
                        {globalIdx}. {lead.nome}
                      </div>

                      <div className="text-xs text-muted-foreground leading-relaxed">
                        <span>{dataFormatada} · {horaFormatada}</span>
                        <br />
                        <span className="font-mono text-foreground font-medium">+{telLimpo}</span>
                      </div>

                      {/* Destaque Obrigatório: Campanha e Criativo */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {lead.isNew ? (
                          <span className="inline-flex items-center gap-1 bg-[#fff0c8] text-[#875400] dark:bg-[#4a3407] dark:text-[#ffd880] rounded-lg px-2.5 py-0.5 text-xs font-extrabold shadow-2xs">
                            ★ NOVO · {lead.criativo || 'Meta Ads'}
                          </span>
                        ) : lead.criativo ? (
                          <span className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 rounded-md px-2 py-0.5 text-[11px] font-bold">
                            🎨 Criativo: {lead.criativo}
                          </span>
                        ) : null}

                        {lead.campanha && (
                          <span
                            className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-md px-2 py-0.5 text-[11px] font-semibold truncate max-w-[220px]"
                            title={lead.campanha}
                          >
                            📢 Campanha: {lead.campanha}
                          </span>
                        )}

                        {isRapid && (
                          <span className="inline-flex items-center bg-[#f4e6eb] text-[#915269] dark:bg-[#4a2131] dark:text-[#f7bbcf] rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                            Interesse em curto prazo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botão de WhatsApp direto */}
                    <div className="shrink-0 flex flex-col gap-1.5 items-end">
                      <a
                        href={`https://wa.me/${telLimpo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#128c62] hover:bg-[#0e704e] text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                      >
                        <span>WhatsApp</span>
                        <span>↗</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => setLeadParaRevisar(lead)}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium underline cursor-pointer"
                      >
                        Revisar
                      </button>
                    </div>
                  </div>

                  {/* ESTADO DO LEAD */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase shrink-0">
                      ESTADO DO LEAD
                    </label>
                    <select
                      value={lead.status || 'Pendente'}
                      onChange={(e) => handleUpdateStatus(lead, e.target.value as StatusNovoLead)}
                      className="flex-1 min-w-[190px] h-9 px-3 rounded-lg border border-border bg-background text-xs font-semibold text-foreground cursor-pointer"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SEÇÃO SE STATUS === 'Perdido' (Loss Box) */}
                  {(lead.status || 'Pendente') === 'Perdido' && (
                    <div className="bg-[#fff8f4] dark:bg-rose-950/20 border border-[#efd1c2] dark:border-rose-900/60 p-3.5 rounded-xl space-y-2">
                      <strong className="text-xs font-bold text-[#8d4c37] dark:text-rose-300 block">
                        Motivo da perda
                      </strong>
                      {lead.motivo_perda ? (
                        <div>
                          <p className="text-xs text-foreground font-medium">{lead.motivo_perda}</p>
                          <small className="text-[11px] text-muted-foreground block mt-1">
                            Arquivado em {showDatetime(lead.motivo_perda_data || lead.data_atualizacao)}
                          </small>
                          <button
                            type="button"
                            onClick={() => handleRestoreLead(lead)}
                            className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                          >
                            ↩ Restaurar lead
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <small className="text-[11px] text-muted-foreground block">
                            Descreva o que aconteceu para arquivar este lead. Ele ficará disponível na aba Arquivados.
                          </small>
                          <textarea
                            value={motivosPerdaInput[lead.id] ?? ''}
                            onChange={(e) =>
                              setMotivosPerdaInput({ ...motivosPerdaInput, [lead.id]: e.target.value })
                            }
                            maxLength={2000}
                            placeholder="Ex.: Paciente informou que não pretende realizar o tratamento neste momento."
                            className="w-full text-xs p-2.5 rounded-lg border border-border bg-background min-h-[75px]"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveLoss(lead)}
                            className="bg-[#78485a] hover:bg-[#633a49] text-white text-xs font-semibold"
                          >
                            Salvar motivo e arquivar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SEÇÃO SE STATUS === 'Convertido' (Valor da Venda) */}
                  {(lead.status || 'Pendente') === 'Convertido' && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 rounded-xl">
                      <label className="text-[11px] font-bold text-purple-950 dark:text-purple-300 uppercase">
                        VALOR DA VENDA (R$)
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex.: 3.500,00"
                        defaultValue={
                          lead.valor_venda !== null && lead.valor_venda !== undefined
                            ? Number(lead.valor_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                            : ''
                        }
                        onBlur={(e) => handleUpdateSale(lead, e.target.value)}
                        className="h-8 text-xs font-semibold w-32 bg-background"
                      />
                      <small className="text-[11px] text-muted-foreground">
                        Incluído no faturamento quando convertido
                      </small>
                    </div>
                  )}

                  {/* SEÇÃO SE STATUS === 'Agendado' (Consulta Agendada · Antecipação) */}
                  {(lead.status || 'Pendente') === 'Agendado' && (
                    <div className="p-3.5 bg-[#fcf7fa] dark:bg-rose-950/15 border border-[#eadde3] dark:border-rose-900/40 rounded-xl space-y-2.5">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>📅</span> Consulta agendada · Antecipação
                      </h4>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground block">
                          Dia e horário da consulta
                        </label>
                        <input
                          type="datetime-local"
                          defaultValue={ap ? localDatetime(ap) : ''}
                          onChange={(e) => handleSetAppointment(lead, e.target.value)}
                          className="w-full max-w-[280px] h-8 px-2.5 text-xs rounded-lg border border-border bg-background font-medium"
                        />
                      </div>

                      {!ap ? (
                        <p className="text-[11px] text-muted-foreground">
                          Selecione o dia e o horário para criar automaticamente os lembretes de 3, 2 e 1 dia e 3 horas antes da consulta.
                        </p>
                      ) : (
                        <div className="space-y-2 pt-1 border-t border-border/60">
                          <div className="text-[11px] text-muted-foreground">
                            Consulta: <strong>{showDatetime(ap)}</strong>. O WhatsApp abre com a mensagem pronta.
                          </div>

                          <div className="space-y-1.5">
                            {REMINDER_STEPS.map((step) => {
                              const when = reminderDate(ap, step);
                              const sent = lead.lembretes_enviados?.[step.id];
                              const now = new Date();
                              const late = when < now;

                              return (
                                <div
                                  key={step.id}
                                  className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border/80 text-xs"
                                >
                                  <div>
                                    <strong>{step.label}</strong>
                                    <small className="text-muted-foreground block text-[11px]">
                                      {showDatetime(when)}
                                    </small>
                                    {sent ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                        ✓ Enviado em {showDatetime(sent)}
                                      </span>
                                    ) : (
                                      <span
                                        className={`text-[11px] font-bold ${
                                          late
                                            ? 'text-amber-700 dark:text-amber-400'
                                            : 'text-blue-600 dark:text-blue-400'
                                        }`}
                                      >
                                        {late ? 'Pendente / horário já passou' : 'Programado'}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSendReminder(lead, step)}
                                      className="h-7 text-[11px] px-2 font-medium"
                                    >
                                      Abrir WhatsApp ↗
                                    </Button>

                                    {sent ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleUnmarkReminder(lead, step.id)}
                                        className="h-7 text-[11px] px-2 text-muted-foreground"
                                      >
                                        Desmarcar
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => handleMarkReminder(lead, step.id)}
                                        className="h-7 text-[11px] px-2 bg-[#78485a] hover:bg-[#633a49] text-white font-semibold"
                                      >
                                        Marcar enviado
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ETAPA DE FOLLOW-UP */}
                  <div className="pt-2 border-t border-border/60 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase shrink-0">
                        ETAPA DE FOLLOW-UP
                      </label>
                      <select
                        value={lead.follow_up_stage || 'Não iniciado'}
                        onChange={(e) => handleChangeFollow(lead, e.target.value)}
                        className="flex-1 min-w-[150px] h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground cursor-pointer"
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {lead.follow_up_updated_at && (
                      <div className="space-y-1">
                        <div className="text-[11px] text-muted-foreground">
                          Atualizado: {showDatetime(lead.follow_up_updated_at)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">Corrigir atualização:</span>
                          <input
                            type="datetime-local"
                            defaultValue={localDatetime(lead.follow_up_updated_at)}
                            onChange={(e) => handleChangeFollowTime(lead, e.target.value)}
                            className="h-7 px-2 text-[11px] rounded border border-border bg-background"
                          />
                        </div>
                      </div>
                    )}

                    {fs.next ? (
                      <div className="text-xs pt-0.5">
                        <small className="text-muted-foreground">
                          Próxima etapa: <strong>{fs.next.label}</strong> · {showDatetime(fs.next.date)}{' '}
                          <span
                            className={`inline-block font-extrabold text-[10px] px-1.5 py-0.5 rounded ${
                              fs.type === 'overdue'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                : fs.type === 'today'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            }`}
                          >
                            {fs.type === 'overdue' ? 'ATRASADO' : fs.type === 'today' ? 'HOJE' : 'PROGRAMADO'}
                          </span>
                        </small>
                      </div>
                    ) : (
                      <small className="text-[11px] text-muted-foreground block">
                        Selecione uma etapa para iniciar o acompanhamento.
                      </small>
                    )}
                  </div>

                  {/* PERGUNTAS E RESPOSTAS (Accordion / Details) */}
                  <div className="pt-2 border-t border-border/60">
                    <details open={expandAll}>
                      <summary className="text-xs font-bold text-[#805267] dark:text-[#f7bbcf] cursor-pointer hover:opacity-80 py-1">
                        Ver perguntas e respostas
                      </summary>
                      <div className="pt-2.5 pb-1 space-y-2.5">
                        {QUESTIONS.map((q, qIdx) => {
                          const resp = lead.respostas?.[qIdx]?.resposta || 'Não informado';
                          return (
                            <div key={qIdx} className="text-xs space-y-0.5">
                              <div className="text-muted-foreground">
                                {qIdx + 1}. {q}
                              </div>
                              <div className="font-semibold text-foreground">{resp}</div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Nota Informativa */}
        <p className="text-xs text-muted-foreground leading-relaxed pt-4 border-t border-border/80">
          <strong>Importante:</strong> os status, agendamentos e follow-ups são sincronizados em nuvem no banco de dados.
          Alertas visuais e notificações do navegador dependem de permissão e de o painel estar aberto. Os contatos
          estão destacados pelo criativo e campanha de origem.
        </p>
      </div>

      {/* Modais Globais */}
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
        onRegistrarFollowUp={() => {}}
        onLeadAtualizado={(atualizado) => {
          setLeadSelecionado(atualizado);
          refreshLeads(true);
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
