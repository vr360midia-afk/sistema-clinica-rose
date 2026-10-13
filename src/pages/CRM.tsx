import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import KanbanBoard, { Lead } from '@/components/crm/KanbanBoard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
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
  Plus,
  Search,
  RefreshCw,
  Users,
  CalendarCheck,
  UserCheck,
  XCircle,
  DollarSign,
  X,
  MessageSquare,
  Zap,
  LayoutGrid,
  Kanban,
  UserPlus,
  Sparkles,
  TrendingUp,
  Clock,
  Globe,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import LeadModal from '@/components/crm/LeadModal';
import LeadIntegracoesModal from '@/components/crm/LeadIntegracoesModal';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/exportCsv';

export default function CRM() {
  const { user, clinicaId } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIntegracoesOpen, setIsIntegracoesOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);

  // Filtros e Visualização
  const [busca, setBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');
  const [filtroEtapa, setFiltroEtapa] = useState<
    'todos' | 'novos' | 'primeiro_contato' | 'followup' | 'agendados' | 'perdidos'
  >('todos');
  const [modoColunas, setModoColunas] = useState<'essencial' | 'completo'>('essencial');

  useEffect(() => {
    fetchLeads();

    // Inscrição Realtime no Supabase para receber novos leads e mensagens instantaneamente
    const canalLeads = supabase
      .channel('crm_leads_realtime_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_leads' },
        (payload) => {
          const novoLead: any = payload.new;
          if (!novoLead) return;
          toast.info(`🎉 Novo lead: ${novoLead.name || novoLead.nome || 'Novo Contato'}!`, {
            description: `Origem: ${novoLead.origin || novoLead.origem || 'WhatsApp'}`,
          });
          setLeads((prev) => [novoLead, ...prev.filter((l) => l.id !== novoLead.id)]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'crm_leads' },
        (payload) => {
          const leadAtualizado: any = payload.new;
          if (!leadAtualizado) return;
          setLeads((prev) =>
            prev.map((l) => (l.id === leadAtualizado.id ? { ...l, ...leadAtualizado } : l))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'crm_leads' },
        (payload) => {
          const leadDeletadoId = (payload.old as any)?.id;
          if (leadDeletadoId) {
            setLeads((prev) => prev.filter((l) => l.id !== leadDeletadoId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_messages' },
        (payload) => {
          const newMsg: any = payload.new;
          if (!newMsg?.lead_id) return;
          setLeads((prev) =>
            prev.map((lead) => {
              if (lead.id === newMsg.lead_id) {
                return {
                  ...lead,
                  ultima_mensagem: newMsg.body,
                  last_message_direction: newMsg.direction,
                  last_message_at: newMsg.created_at,
                };
              }
              return lead;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalLeads);
    };
  }, []);

  const fetchLeads = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: rawLeads, error } = await supabase
        .from('crm_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Busca últimas mensagens para prévia dinâmica nos cards
      const { data: messagesData } = await supabase
        .from('crm_messages')
        .select('lead_id, body, direction, created_at')
        .order('created_at', { ascending: false });

      const latestMsgMap = new Map();
      (messagesData || []).forEach((m: any) => {
        if (!latestMsgMap.has(m.lead_id)) {
          latestMsgMap.set(m.lead_id, m);
        }
      });

      const leadsComPreview = (rawLeads || []).map((l: any) => {
        const lastMsg = latestMsgMap.get(l.id);
        return {
          ...l,
          ultima_mensagem: lastMsg?.body || l.observacoes || null,
          last_message_direction: lastMsg?.direction || null,
          last_message_at:
            lastMsg?.created_at ||
            l.last_inbound_at ||
            l.last_outbound_at ||
            l.updated_at ||
            l.created_at ||
            l.data_criacao,
        };
      });

      setLeads(leadsComPreview);
      if (silencioso) {
        toast.success('Lista de leads atualizada!');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar leads do CRM');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleEdit = (lead: any) => {
    setEditingLead(lead);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingLead(null);
    setIsModalOpen(true);
  };

  // Cadastrar Lead diretamente como Paciente da Clínica
  const handleConverterEmPaciente = async (lead: Lead) => {
    const nome = lead.name || lead.nome;
    const telefone = lead.phone || lead.telefone;
    if (!nome) {
      toast.error('Lead sem nome para cadastrar.');
      return;
    }

    try {
      if (telefone) {
        const telLimpo = telefone.replace(/\D/g, '');
        if (telLimpo.length >= 8) {
          const { data: existente } = await supabase
            .from('pacientes')
            .select('id, nome')
            .filter('telefone', 'ilike', `%${telLimpo.slice(-8)}%`)
            .maybeSingle();

          if (existente) {
            toast.info(`Paciente "${existente.nome}" já está cadastrado na clínica!`);
            return;
          }
        }
      }

      const { error: insErr } = await supabase.from('pacientes').insert({
        user_id: clinicaId || user?.id,
        nome,
        telefone: telefone || null,
        observacoes: `Convertido do CRM (Origem: ${lead.origin || lead.origem || 'WhatsApp'})`,
        origem_lead: lead.origin || lead.origem || 'WhatsApp',
        status: 'ativo',
      });

      if (insErr) throw insErr;

      // Atualiza o lead no CRM para agendado
      await supabase
        .from('crm_leads')
        .update({
          stage: 'agendado',
          status: 'agendado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      toast.success(`🎉 ${nome} cadastrado como Paciente com sucesso!`, {
        description: 'Lead atualizado para "Consulta Agendada".',
      });

      fetchLeads(true);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao cadastrar paciente: ' + (err?.message || 'Tente novamente'));
    }
  };

  // Atualização da lista vinda do Kanban (inclusive com filtros ativos)
  const handleLeadsChange = (updatedLeads: any[]) => {
    if (busca.trim() || filtroOrigem !== 'todos' || filtroEtapa !== 'todos') {
      const updatedMap = new Map(updatedLeads.map((l) => [l.id, l]));
      setLeads((prev) =>
        prev.map((l) => (updatedMap.has(l.id) ? updatedMap.get(l.id) : l))
      );
    } else {
      setLeads(updatedLeads);
    }
  };

  // Filtragem dinâmica
  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Filtro de texto (nome, telefone ou observações)
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const nomeAlvo = (lead.name || lead.nome || '').toLowerCase();
        const telAlvo = (lead.phone || lead.telefone || '').replace(/\D/g, '');
        const obsAlvo = (lead.observacoes || lead.campanha || '').toLowerCase();
        const nomeMatch = nomeAlvo.includes(termo);
        const telMatch = telAlvo.includes(termo.replace(/\D/g, ''));
        const obsMatch = obsAlvo.includes(termo);
        if (!nomeMatch && !telMatch && !obsMatch) return false;
      }

      // 2. Filtro de origem
      if (filtroOrigem !== 'todos') {
        const origemLead = (lead.origin || lead.origem || 'whatsapp').toLowerCase();
        if (!origemLead.includes(filtroOrigem.toLowerCase())) {
          return false;
        }
      }

      // 3. Filtro de etapa rápida
      if (filtroEtapa !== 'todos') {
        const st = (lead.stage || lead.status || 'novo_lead').toLowerCase();
        if (filtroEtapa === 'novos' && st !== 'novo_lead' && st !== 'novo') return false;
        if (filtroEtapa === 'primeiro_contato' && st !== 'primeiro_contato' && st !== '1_contato')
          return false;
        if (
          filtroEtapa === 'followup' &&
          st !== 'followup_1' &&
          st !== 'followup_2' &&
          st !== 'fu_3h' &&
          st !== 'fu_18h' &&
          !st.startsWith('fu_') &&
          st !== 'mensal'
        ) {
          return false;
        }
        if (filtroEtapa === 'agendados' && st !== 'agendado' && st !== 'consulta_agendada')
          return false;
        if (filtroEtapa === 'perdidos' && st !== 'perdido') return false;
      }

      return true;
    });
  }, [leads, busca, filtroOrigem, filtroEtapa]);

  // Métricas do Funil
  const metricas = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter((l) => {
      const st = l.stage || l.status;
      return st === 'novo_lead' || st === 'novo' || !st;
    }).length;
    const primeiroContato = leads.filter((l) => {
      const st = l.stage || l.status;
      return st === 'primeiro_contato' || st === '1_contato';
    }).length;
    const followups = leads.filter((l) => {
      const st = l.stage || l.status;
      return (
        st === 'followup_1' ||
        st === 'followup_2' ||
        st === 'fu_3h' ||
        st === 'fu_18h' ||
        st?.startsWith('fu_') ||
        st === 'mensal'
      );
    }).length;
    const agendados = leads.filter((l) => {
      const st = l.stage || l.status;
      return st === 'agendado' || st === 'consulta_agendada';
    }).length;
    const perdidos = leads.filter((l) => {
      const st = l.stage || l.status;
      return st === 'perdido';
    }).length;
    const valorTotal = leads.reduce(
      (acc, l) => acc + (Number(l.valor_estimado) || 0),
      0
    );
    const taxaConversao = total > 0 ? Math.round((agendados / total) * 100) : 0;

    return { total, novos, primeiroContato, followups, agendados, perdidos, valorTotal, taxaConversao };
  }, [leads]);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-5.5rem)] overflow-hidden space-y-2.5">
        {/* Topo do CRM com Título e Ações Principais */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                CRM & Leads
              </h1>
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                Tempo Real (WhatsApp & Webhook)
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Funil de vendas, captura automática de contatos e automação de follow-up
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Alternador de Modo de Colunas */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setModoColunas('essencial')}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-all text-xs flex items-center gap-1.5",
                  modoColunas === 'essencial'
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Visualizar as 6 etapas essenciais do funil"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                <span>Principal (6)</span>
              </button>
              <button
                type="button"
                onClick={() => setModoColunas('completo')}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-all text-xs flex items-center gap-1.5",
                  modoColunas === 'completo'
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Visualizar todas as 13 etapas de follow-up a longo prazo"
              >
                <Kanban className="h-3.5 w-3.5 text-indigo-500" />
                <span>Completo (13)</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsIntegracoesOpen(true)}
              className="h-8 gap-1.5 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
              title="Configurar captura automática de leads (Meta Ads, Site, Webhooks)"
            >
              <Zap className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
              <span className="hidden md:inline">Puxar Leads</span>
              <span className="md:hidden">Integrações</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLeads(true)}
              disabled={loading || refreshing}
              className="h-8 gap-1.5"
              title="Atualizar lista"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>

            <Button onClick={handleNew} size="sm" className="h-8 gap-1.5 shadow-sm">
              <Plus className="h-3.5 w-3.5" /> Novo Lead
            </Button>
          </div>
        </div>

        {/* Cards de Métricas Interativos (Clicáveis para Filtrar) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
          {/* Card 1: Total */}
          <div
            onClick={() => setFiltroEtapa('todos')}
            className={cn(
              "p-2.5 rounded-lg border transition-all cursor-pointer bg-card hover:border-primary/50 shadow-2xs",
              filtroEtapa === 'todos' ? "ring-2 ring-primary border-primary bg-primary/5" : "border-border"
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total no Funil</span>
              <Users className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-foreground mt-0.5">{metricas.total}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {metricas.valorTotal > 0 ? formatMoney(metricas.valorTotal) : 'Sem valor est.'}
            </div>
          </div>

          {/* Card 2: Novos */}
          <div
            onClick={() => setFiltroEtapa(filtroEtapa === 'novos' ? 'todos' : 'novos')}
            className={cn(
              "p-2.5 rounded-lg border transition-all cursor-pointer bg-card hover:border-blue-400 shadow-2xs",
              filtroEtapa === 'novos' ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50/20 dark:bg-blue-950/20" : "border-border"
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="text-blue-700 dark:text-blue-400 font-medium">Novos Leads</span>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-0.5">{metricas.novos}</div>
            <div className="text-[10px] text-muted-foreground">Aguardando 1º contato</div>
          </div>

          {/* Card 3: 1º Contato */}
          <div
            onClick={() => setFiltroEtapa(filtroEtapa === 'primeiro_contato' ? 'todos' : 'primeiro_contato')}
            className={cn(
              "p-2.5 rounded-lg border transition-all cursor-pointer bg-card hover:border-indigo-400 shadow-2xs",
              filtroEtapa === 'primeiro_contato' ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20" : "border-border"
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="text-indigo-700 dark:text-indigo-400 font-medium">1º Contato</span>
              <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">{metricas.primeiroContato}</div>
            <div className="text-[10px] text-muted-foreground">Conversa iniciada</div>
          </div>

          {/* Card 4: Em Follow-up */}
          <div
            onClick={() => setFiltroEtapa(filtroEtapa === 'followup' ? 'todos' : 'followup')}
            className={cn(
              "p-2.5 rounded-lg border transition-all cursor-pointer bg-card hover:border-slate-400 shadow-2xs",
              filtroEtapa === 'followup' ? "ring-2 ring-slate-500 border-slate-500 bg-slate-50/30 dark:bg-slate-900/40" : "border-border"
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Em Follow-up</span>
              <Clock className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">{metricas.followups}</div>
            <div className="text-[10px] text-muted-foreground">Cadência ativa (3h/18h)</div>
          </div>

          {/* Card 5: Agendados */}
          <div
            onClick={() => setFiltroEtapa(filtroEtapa === 'agendados' ? 'todos' : 'agendados')}
            className={cn(
              "p-2.5 rounded-lg border transition-all cursor-pointer bg-card hover:border-emerald-400 shadow-2xs",
              filtroEtapa === 'agendados' ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20" : "border-border"
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Agendados</span>
              <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{metricas.agendados}</div>
            <div className="text-[10px] text-emerald-600 font-medium">
              Taxa: {metricas.taxaConversao}% de conversão
            </div>
          </div>

          {/* Card 6: Perdidos */}
          <div
            onClick={() => setFiltroEtapa(filtroEtapa === 'perdidos' ? 'todos' : 'perdidos')}
            className={cn(
              "p-2.5 rounded-lg border transition-all cursor-pointer bg-card hover:border-red-400 shadow-2xs",
              filtroEtapa === 'perdidos' ? "ring-2 ring-red-500 border-red-500 bg-red-50/20 dark:bg-red-950/20" : "border-border"
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="text-red-700 dark:text-red-400 font-medium">Perdidos</span>
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            </div>
            <div className="text-lg font-bold text-red-700 dark:text-red-300 mt-0.5">{metricas.perdidos}</div>
            <div className="text-[10px] text-muted-foreground">Sem interesse / outro</div>
          </div>
        </div>

        {/* Barra de Filtros e Busca Rápida */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-card rounded-lg border border-border shrink-0 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, WhatsApp ou anotações..."
                className="pl-8 h-8 text-xs border-border bg-background"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="w-[180px]">
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="h-8 text-xs border-border bg-background">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Origens</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="meta ads">🎯 Meta Ads</SelectItem>
                  <SelectItem value="site">🌐 Site da Clínica</SelectItem>
                  <SelectItem value="google ads">🔍 Google Ads</SelectItem>
                  <SelectItem value="instagram">📸 Instagram</SelectItem>
                  <SelectItem value="indicacao">🤝 Indicação / Paciente</SelectItem>
                  <SelectItem value="manual">✍️ Manual / Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chips Rápidos de Etapa */}
            <div className="hidden lg:flex items-center gap-1 bg-muted/40 p-0.5 rounded-md border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setFiltroEtapa('todos')}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] transition-colors",
                  filtroEtapa === 'todos' ? "bg-background text-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos ({metricas.total})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEtapa('novos')}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] transition-colors",
                  filtroEtapa === 'novos' ? "bg-background text-blue-600 font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Novos ({metricas.novos})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEtapa('followup')}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] transition-colors",
                  filtroEtapa === 'followup' ? "bg-background text-slate-800 dark:text-slate-200 font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                F-up ({metricas.followups})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEtapa('agendados')}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] transition-colors",
                  filtroEtapa === 'agendados' ? "bg-background text-emerald-600 font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Agendados ({metricas.agendados})
              </button>
            </div>

            {(busca || filtroOrigem !== 'todos' || filtroEtapa !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBusca('');
                  setFiltroOrigem('todos');
                  setFiltroEtapa('todos');
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground shrink-0 font-medium hidden sm:block">
            Exibindo <strong className="text-foreground">{leadsFiltrados.length}</strong> de {metricas.total} contatos
          </div>
        </div>

        {/* Quadro Kanban Interativo com Drag & Drop e Seleção por Clique */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-3">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span>Carregando contatos do CRM...</span>
            </div>
          ) : (
            <KanbanBoard
              leads={leadsFiltrados}
              onLeadsChange={handleLeadsChange}
              onEditLead={handleEdit}
              modoColunas={modoColunas}
              onConverterEmPaciente={handleConverterEmPaciente}
            />
          )}
        </div>
      </div>

      {/* Modal de Criação / Edição de Lead */}
      {isModalOpen && (
        <LeadModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          lead={editingLead}
          onSave={() => fetchLeads(true)}
        />
      )}

      {/* Modal de Integração Automática (Meta Ads, Site & Webhooks) */}
      {isIntegracoesOpen && (
        <LeadIntegracoesModal
          isOpen={isIntegracoesOpen}
          onClose={() => setIsIntegracoesOpen(false)}
          onLeadCriado={() => fetchLeads(true)}
        />
      )}
    </Layout>
  );
}
