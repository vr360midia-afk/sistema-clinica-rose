import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NovoLead, StatusNovoLead, AlertasAgendamento, FollowUpItem } from '@/types/novosLeads';
import { novosLeadsService, parseDbLeadParaNovoLead } from '@/services/novosLeadsService';
import { toast } from 'sonner';

export function useNovosLeads() {
  const [leads, setLeads] = useState<NovoLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregarLeads = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    else setRefreshing(true);

    try {
      const lista = await novosLeadsService.listarLeads();
      setLeads(lista);
    } catch (err) {
      console.error('[useNovosLeads] Erro ao carregar leads:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregarLeads();

    // Inscrição Realtime no Supabase para receber novos leads da Meta instantaneamente
    const canal = supabase
      .channel('novos_leads_live_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_leads' },
        (payload) => {
          const novoDb = payload.new;
          if (!novoDb) return;
          const novoLead = parseDbLeadParaNovoLead(novoDb);

          toast.success(`🎉 Novo Lead Recebido: ${novoLead.nome}!`, {
            description: `Origem: ${novoLead.origem} | ${novoLead.campanha || 'Campanha Meta'}`,
            duration: 8000,
          });

          setLeads((prev) => [novoLead, ...prev.filter((l) => l.id !== novoLead.id)]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'crm_leads' },
        (payload) => {
          const atualizadoDb = payload.new;
          if (!atualizadoDb) return;
          const leadAtualizado = parseDbLeadParaNovoLead(atualizadoDb);

          setLeads((prev) =>
            prev.map((l) => (l.id === leadAtualizado.id ? leadAtualizado : l))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'crm_leads' },
        (payload) => {
          const deletadoId = (payload.old as any)?.id;
          if (deletadoId) {
            setLeads((prev) => prev.filter((l) => l.id !== deletadoId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregarLeads]);

  const unreviewedCount = useMemo(() => {
    return leads.filter((l) => !l.revisado && l.status !== 'Perdido' && !l.arquivado).length;
  }, [leads]);

  const marcarComoRevisado = async (leadId: string, usuarioNome?: string) => {
    try {
      const atualizado = await novosLeadsService.marcarComoRevisado(leadId, usuarioNome);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? atualizado : l)));
      toast.success('Lead marcado como revisado!');
      return atualizado;
    } catch (err: any) {
      toast.error('Erro ao revisar lead: ' + (err.message || 'Tente novamente'));
      throw err;
    }
  };

  const mudarStatus = async (
    leadId: string,
    novoStatus: StatusNovoLead,
    dadosExtras?: {
      agendado_para?: string;
      alertas_agendamento?: AlertasAgendamento;
      valor_venda?: number;
      motivo_perda?: string;
    }
  ) => {
    try {
      const atualizado = await novosLeadsService.mudarStatus(leadId, novoStatus, dadosExtras);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? atualizado : l)));
      toast.success(`Status atualizado para "${novoStatus}"!`);
      return atualizado;
    } catch (err: any) {
      toast.error('Erro ao atualizar status: ' + (err.message || 'Tente novamente'));
      throw err;
    }
  };

  const registrarFollowUp = async (
    leadId: string,
    etapa: FollowUpItem['etapa'],
    contato: {
      canal: FollowUpItem['canal'];
      observacao?: string;
      data_contato?: string;
    }
  ) => {
    try {
      const atualizado = await novosLeadsService.registrarFollowUp(leadId, etapa, contato);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? atualizado : l)));
      toast.success(`Follow-up (${etapa}) registrado com sucesso!`);
      return atualizado;
    } catch (err: any) {
      toast.error('Erro ao registrar follow-up: ' + (err.message || 'Tente novamente'));
      throw err;
    }
  };

  const salvarLead = async (leadData: Partial<NovoLead>) => {
    try {
      const novo = await novosLeadsService.salvarLead(leadData);
      setLeads((prev) => [novo, ...prev.filter((l) => l.id !== novo.id)]);
      toast.success('Lead salvo com sucesso!');
      return novo;
    } catch (err: any) {
      toast.error('Erro ao salvar lead: ' + (err.message || 'Tente novamente'));
      throw err;
    }
  };

  return {
    leads,
    loading,
    refreshing,
    unreviewedCount,
    refreshLeads: carregarLeads,
    marcarComoRevisado,
    mudarStatus,
    registrarFollowUp,
    salvarLead,
  };
}
