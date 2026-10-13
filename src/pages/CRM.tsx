import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import KanbanBoard from '@/components/crm/KanbanBoard';
import { supabase } from '@/integrations/supabase/client';
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
} from 'lucide-react';
import { toast } from 'sonner';
import LeadModal from '@/components/crm/LeadModal';
import LeadIntegracoesModal from '@/components/crm/LeadIntegracoesModal';

export default function CRM() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIntegracoesOpen, setIsIntegracoesOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');

  useEffect(() => {
    fetchLeads();

    // Inscrição Realtime no Supabase para receber novos leads instantaneamente
    const canal = supabase
      .channel('crm_leads_realtime_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_leads' },
        (payload) => {
          const novoLead: any = payload.new;
          if (!novoLead) return;
          toast.info(`🎉 Novo lead recebido: ${novoLead.nome || 'Novo Contato'}!`, {
            description: `Origem: ${novoLead.origem || 'Meta Ads / Site'}`,
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
            prev.map((l) => (l.id === leadAtualizado.id ? leadAtualizado : l))
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
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const fetchLeads = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .order('data_criacao', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
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

  // Atualização da lista vinda do Kanban (inclusive com filtros ativos)
  const handleLeadsChange = (updatedLeads: any[]) => {
    if (busca.trim() || filtroOrigem !== 'todos') {
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
      // Filtro de texto (nome ou telefone)
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const nomeMatch = (lead.nome || '').toLowerCase().includes(termo);
        const telMatch = (lead.telefone || '').replace(/\D/g, '').includes(termo);
        if (!nomeMatch && !telMatch) return false;
      }

      // Filtro de origem
      if (filtroOrigem !== 'todos') {
        const origemLead = (lead.origem || 'Manual').toLowerCase();
        if (origemLead !== filtroOrigem.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [leads, busca, filtroOrigem]);

  // Métricas do Funil
  const metricas = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter((l) => l.status === 'novo' || !l.status).length;
    const primeiroContato = leads.filter(
      (l) => l.status === 'primeiro_contato' || l.status === '1_contato'
    ).length;
    const agendados = leads.filter(
      (l) => l.status === 'agendado' || l.status === 'consulta_agendada'
    ).length;
    const perdidos = leads.filter((l) => l.status === 'perdido').length;
    const valorTotal = leads.reduce(
      (acc, l) => acc + (Number(l.valor_estimado) || 0),
      0
    );

    return { total, novos, primeiroContato, agendados, perdidos, valorTotal };
  }, [leads]);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-5.5rem)] overflow-hidden space-y-3">
        {/* Topo do CRM com Título e Ações Principais */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              CRM & Leads
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Gerencie seus contatos do site e Meta Ads com funil de atendimento e follow-up
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsIntegracoesOpen(true)}
              className="h-9 gap-1.5 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
              title="Configurar captura automática de leads (Meta Ads, Site, Webhooks)"
            >
              <Zap className="h-4 w-4 text-blue-600 animate-pulse" />
              <span className="hidden md:inline">Puxar Leads (Meta & Webhook)</span>
              <span className="md:hidden">Integrações</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLeads(true)}
              disabled={loading || refreshing}
              className="h-9 gap-1.5"
              title="Atualizar lista"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>

            <Button onClick={handleNew} size="sm" className="h-9 gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Novo Lead
            </Button>
          </div>
        </div>

        {/* Barra de Filtros e Busca Rápida */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 bg-card rounded-lg border border-border shrink-0 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou WhatsApp..."
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

            <div className="w-[170px]">
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="h-8 text-xs border-border bg-background">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Origens</SelectItem>
                  <SelectItem value="meta ads">Meta Ads</SelectItem>
                  <SelectItem value="google ads">Google Ads</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="pacientes">Pacientes</SelectItem>
                  <SelectItem value="manual">Manual / Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(busca || filtroOrigem !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBusca('');
                  setFiltroOrigem('todos');
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Indicadores Resumidos Rápidos */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 shrink-0 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded text-[11px]">
              Total: <strong className="text-foreground">{metricas.total}</strong>
            </span>
            <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-[11px]">
              1º Contato: <strong>{metricas.primeiroContato}</strong>
            </span>
            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[11px]">
              <CalendarCheck className="h-3 w-3" /> Agendados: <strong>{metricas.agendados}</strong>
            </span>
            <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[11px]">
              Perdidos: <strong>{metricas.perdidos}</strong>
            </span>
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
