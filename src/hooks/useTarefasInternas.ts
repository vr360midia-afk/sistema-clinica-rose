import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export type TipoTarefa = 
  | 'chamar_lead'          // Chamar lead novo (WhatsApp / Ligação)
  | 'followup_orcamento'   // Follow-up de orçamento / proposta
  | 'confirmar_paciente'   // Confirmar consulta de amanhã
  | 'pos_operatorio'       // Checar pós-operatório / retorno
  | 'laboratorio'          // Enviar ou cobrar trabalho de laboratório/prótese
  | 'financeiro'           // Cobrança ou lembrete financeiro
  | 'geral';               // Tarefa administrativa / geral

export type PrioridadeTarefa = 'baixa' | 'media' | 'alta';
export type StatusTarefa = 'pendente' | 'em_andamento' | 'concluida';

export interface TarefaInterna {
  id: string;
  titulo: string;
  descricao?: string;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  tipo: TipoTarefa;
  prioridade: PrioridadeTarefa;
  status: StatusTarefa;
  responsavel?: string; // Quem vai executar (Dra. Rose, Secretária, etc.)
  
  // Vínculo com Lead (CRM)
  leadId?: string;
  leadNome?: string;
  leadTelefone?: string;
  
  // Vínculo com Paciente
  pacienteId?: string;
  pacienteNome?: string;
  pacienteTelefone?: string;

  // Lembrete e metadados
  lembreteAtivo?: boolean;
  lembreteData?: string;
  concluidaEm?: string;
  criadoEm?: string;
  updatedAt?: string;
}

export const TIPO_TAREFA_INFO: Record<TipoTarefa, { label: string; icon: string; cor: string; badgeClass: string }> = {
  chamar_lead: {
    label: 'Chamar Lead (WhatsApp)',
    icon: '📞',
    cor: '#10b981',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  followup_orcamento: {
    label: 'Follow-up Orçamento',
    icon: '💬',
    cor: '#8b5cf6',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  confirmar_paciente: {
    label: 'Confirmar Consulta',
    icon: '⏰',
    cor: '#0ea5e9',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  },
  pos_operatorio: {
    label: 'Pós-Operatório',
    icon: '🩺',
    cor: '#ec4899',
    badgeClass: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30',
  },
  laboratorio: {
    label: 'Laboratório / Prótese',
    icon: '📦',
    cor: '#f59e0b',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  financeiro: {
    label: 'Financeiro / Cobrança',
    icon: '💳',
    cor: '#ef4444',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  },
  geral: {
    label: 'Geral / Administrativo',
    icon: '📋',
    cor: '#64748b',
    badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
  },
};

const getHojeStr = () => new Date().toISOString().split('T')[0];

export const useTarefasInternas = () => {
  const { user, clinicaId } = useAuth();
  const [tarefas, setTarefas] = useState<TarefaInterna[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega as tarefas
  const carregarTarefas = useCallback(async () => {
    if (!user) {
      setTarefas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Tenta carregar da tabela especializada tarefas_internas
      const { data: dataDedicated, error: errorDedicated } = await supabase
        .from('tarefas_internas' as any)
        .select('*')
        .order('data', { ascending: true });

      if (!errorDedicated && Array.isArray(dataDedicated)) {
        const formatadas: TarefaInterna[] = dataDedicated.map((item: any) => ({
          id: item.id,
          titulo: item.titulo,
          descricao: item.descricao || '',
          data: item.data || getHojeStr(),
          hora: item.hora ? item.hora.slice(0, 5) : undefined,
          tipo: item.tipo || 'geral',
          prioridade: item.prioridade || 'media',
          status: item.status || (item.concluida_em ? 'concluida' : 'pendente'),
          responsavel: item.responsavel,
          leadId: item.lead_id,
          leadNome: item.lead_nome,
          leadTelefone: item.lead_telefone,
          pacienteId: item.paciente_id,
          pacienteNome: item.paciente_nome,
          pacienteTelefone: item.paciente_telefone,
          concluidaEm: item.concluida_em,
          criadoEm: item.created_at,
          updatedAt: item.updated_at,
        }));
        setTarefas(formatadas);
        setLoading(false);
        return;
      }

      // 2. Se a tabela dedicada ainda não existir no banco, usa a tabela 'notas' com categoria 'tarefa_interna'
      const { data: notasData, error: notasError } = await supabase
        .from('notas')
        .select('*')
        .eq('categoria', 'tarefa_interna')
        .order('prazo', { ascending: true });

      if (notasError) throw notasError;

      const formatadas: TarefaInterna[] = (notasData || []).map((nota: any) => {
        let payload: any = {};
        try {
          if (nota.conteudo && nota.conteudo.trim().startsWith('{')) {
            payload = JSON.parse(nota.conteudo);
          } else {
            payload = { descricao: nota.conteudo || '' };
          }
        } catch {
          payload = { descricao: nota.conteudo || '' };
        }

        const dataStr = nota.prazo ? nota.prazo.split('T')[0] : getHojeStr();
        const statusCalc: StatusTarefa = nota.concluida
          ? 'concluida'
          : (payload.status as StatusTarefa) || 'pendente';

        return {
          id: nota.id,
          titulo: nota.titulo,
          descricao: payload.descricao || '',
          data: dataStr,
          hora: payload.hora,
          tipo: (payload.tipo as TipoTarefa) || 'geral',
          prioridade: (nota.prioridade as PrioridadeTarefa) || 'media',
          status: statusCalc,
          responsavel: payload.responsavel,
          leadId: payload.leadId,
          leadNome: payload.leadNome,
          leadTelefone: payload.leadTelefone,
          pacienteId: payload.pacienteId,
          pacienteNome: payload.pacienteNome,
          pacienteTelefone: payload.pacienteTelefone,
          concluidaEm: payload.concluidaEm,
          criadoEm: nota.created_at,
          updatedAt: nota.updated_at,
        };
      });

      setTarefas(formatadas);
    } catch (err: any) {
      console.error('Erro ao carregar tarefas internas:', err);
      toast.error('Erro ao carregar calendário de tarefas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregarTarefas();
  }, [carregarTarefas]);

  // Criar uma nova tarefa
  const adicionarTarefa = async (tarefa: Omit<TarefaInterna, 'id' | 'criadoEm' | 'updatedAt'>): Promise<boolean> => {
    if (!user) return false;
    const targetUserId = clinicaId || user.id;

    try {
      // Tenta inserir na tabela especializada
      const payloadDedicated = {
        user_id: targetUserId,
        clinica_id: targetUserId,
        titulo: tarefa.titulo.trim(),
        descricao: tarefa.descricao?.trim() || null,
        tipo: tarefa.tipo,
        prioridade: tarefa.prioridade,
        status: tarefa.status,
        data: tarefa.data,
        hora: tarefa.hora || null,
        responsavel: tarefa.responsavel?.trim() || null,
        lead_id: tarefa.leadId || null,
        lead_nome: tarefa.leadNome || null,
        lead_telefone: tarefa.leadTelefone || null,
        paciente_id: tarefa.pacienteId || null,
        paciente_nome: tarefa.pacienteNome || null,
        paciente_telefone: tarefa.pacienteTelefone || null,
        concluida_em: tarefa.status === 'concluida' ? new Date().toISOString() : null,
      };

      const { error: errDedicated } = await supabase
        .from('tarefas_internas' as any)
        .insert(payloadDedicated);

      if (!errDedicated) {
        toast.success('Tarefa agendada com sucesso!');
        await carregarTarefas();
        return true;
      }

      // Se falhou (tabela não existe), salva na tabela 'notas'
      const payloadNotas = {
        user_id: targetUserId,
        titulo: tarefa.titulo.trim(),
        categoria: 'tarefa_interna',
        prioridade: tarefa.prioridade,
        prazo: tarefa.data,
        concluida: tarefa.status === 'concluida',
        conteudo: JSON.stringify({
          tipo: tarefa.tipo,
          descricao: tarefa.descricao?.trim() || '',
          hora: tarefa.hora || null,
          status: tarefa.status,
          responsavel: tarefa.responsavel?.trim() || null,
          leadId: tarefa.leadId || null,
          leadNome: tarefa.leadNome || null,
          leadTelefone: tarefa.leadTelefone || null,
          pacienteId: tarefa.pacienteId || null,
          pacienteNome: tarefa.pacienteNome || null,
          pacienteTelefone: tarefa.pacienteTelefone || null,
          concluidaEm: tarefa.status === 'concluida' ? new Date().toISOString() : null,
        }),
      };

      const { error: errNotas } = await supabase.from('notas').insert(payloadNotas);
      if (errNotas) throw errNotas;

      toast.success('Tarefa adicionada ao calendário com sucesso!');
      await carregarTarefas();
      return true;
    } catch (err: any) {
      console.error('Erro ao adicionar tarefa:', err);
      toast.error('Erro ao salvar tarefa: ' + (err.message || 'Tente novamente'));
      return false;
    }
  };

  // Atualizar tarefa
  const atualizarTarefa = async (id: string, updates: Partial<TarefaInterna>): Promise<boolean> => {
    if (!user) return false;

    // Atualização otimista imediata na UI
    setTarefas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );

    try {
      // Tenta atualizar em tarefas_internas
      const updateDedicated: any = {};
      if (updates.titulo !== undefined) updateDedicated.titulo = updates.titulo.trim();
      if (updates.descricao !== undefined) updateDedicated.descricao = updates.descricao?.trim() || null;
      if (updates.tipo !== undefined) updateDedicated.tipo = updates.tipo;
      if (updates.prioridade !== undefined) updateDedicated.prioridade = updates.prioridade;
      if (updates.status !== undefined) {
        updateDedicated.status = updates.status;
        updateDedicated.concluida_em = updates.status === 'concluida' ? new Date().toISOString() : null;
      }
      if (updates.data !== undefined) updateDedicated.data = updates.data;
      if (updates.hora !== undefined) updateDedicated.hora = updates.hora || null;
      if (updates.responsavel !== undefined) updateDedicated.responsavel = updates.responsavel?.trim() || null;
      if (updates.leadNome !== undefined) updateDedicated.lead_nome = updates.leadNome || null;
      if (updates.leadTelefone !== undefined) updateDedicated.lead_telefone = updates.leadTelefone || null;

      const { error: errDedicated } = await supabase
        .from('tarefas_internas' as any)
        .update(updateDedicated)
        .eq('id', id);

      if (!errDedicated) {
        toast.success('Tarefa atualizada!');
        return true;
      }

      // Se falhou ou não existe tabela dedicada, atualiza em notas
      const tarefaAtual = tarefas.find((t) => t.id === id);
      const tarefaCombinada = { ...tarefaAtual, ...updates };

      const updateNotas: any = {};
      if (updates.titulo !== undefined) updateNotas.titulo = updates.titulo;
      if (updates.prioridade !== undefined) updateNotas.prioridade = updates.prioridade;
      if (updates.data !== undefined) updateNotas.prazo = updates.data;
      if (updates.status !== undefined) updateNotas.concluida = updates.status === 'concluida';

      updateNotas.conteudo = JSON.stringify({
        tipo: tarefaCombinada.tipo,
        descricao: tarefaCombinada.descricao || '',
        hora: tarefaCombinada.hora || null,
        status: tarefaCombinada.status,
        responsavel: tarefaCombinada.responsavel || null,
        leadId: tarefaCombinada.leadId || null,
        leadNome: tarefaCombinada.leadNome || null,
        leadTelefone: tarefaCombinada.leadTelefone || null,
        pacienteId: tarefaCombinada.pacienteId || null,
        pacienteNome: tarefaCombinada.pacienteNome || null,
        pacienteTelefone: tarefaCombinada.pacienteTelefone || null,
        concluidaEm: tarefaCombinada.status === 'concluida' ? new Date().toISOString() : null,
      });

      const { error: errNotas } = await supabase
        .from('notas')
        .update(updateNotas)
        .eq('id', id);

      if (errNotas) throw errNotas;

      toast.success('Tarefa atualizada!');
      return true;
    } catch (err: any) {
      console.error('Erro ao atualizar tarefa:', err);
      toast.error('Erro ao salvar alterações');
      await carregarTarefas(); // Reverte em caso de erro
      return false;
    }
  };

  // Marcar como concluída ou reabrir
  const alternarConcluida = async (id: string, concluida: boolean): Promise<boolean> => {
    const novoStatus: StatusTarefa = concluida ? 'concluida' : 'pendente';
    return await atualizarTarefa(id, {
      status: novoStatus,
      concluidaEm: concluida ? new Date().toISOString() : undefined,
    });
  };

  // Remover tarefa
  const removerTarefa = async (id: string): Promise<boolean> => {
    if (!user) return false;

    setTarefas((prev) => prev.filter((t) => t.id !== id));

    try {
      await supabase.from('tarefas_internas' as any).delete().eq('id', id);
      await supabase.from('notas').delete().eq('id', id);
      toast.success('Tarefa removida!');
      return true;
    } catch (err: any) {
      console.error('Erro ao remover tarefa:', err);
      toast.error('Erro ao remover');
      await carregarTarefas();
      return false;
    }
  };

  // Métricas Computadas
  const hojeStr = getHojeStr();

  const metricas = useMemo(() => {
    let hojeCount = 0;
    let atrasadasCount = 0;
    let leadsCount = 0;
    let concluidasCount = 0;
    let totalPendentes = 0;

    tarefas.forEach((t) => {
      const isConcluida = t.status === 'concluida';
      if (isConcluida) {
        concluidasCount++;
      } else {
        totalPendentes++;
        if (t.data === hojeStr) hojeCount++;
        if (t.data < hojeStr) atrasadasCount++;
        if (t.tipo === 'chamar_lead' || t.tipo === 'followup_orcamento') leadsCount++;
      }
    });

    return {
      total: tarefas.length,
      pendentes: totalPendentes,
      hoje: hojeCount,
      atrasadas: atrasadasCount,
      leads: leadsCount,
      concluidas: concluidasCount,
    };
  }, [tarefas, hojeStr]);

  return {
    tarefas,
    loading,
    metricas,
    adicionarTarefa,
    atualizarTarefa,
    alternarConcluida,
    removerTarefa,
    recarregar: carregarTarefas,
  };
};
