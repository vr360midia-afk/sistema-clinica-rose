import { supabase } from '@/integrations/supabase/client';
import {
  ProcedimentoTratamento,
  SessaoTratamento,
  ConfirmacaoSessao,
  HistoricoTratamento,
  StatusProcedimentoTratamento,
} from '@/types/tratamento';

export const tratamentoService = {
  /**
   * Carrega todos os procedimentos de tratamento de um paciente, com suas sessões e confirmações.
   */
  async carregarProcedimentosPaciente(pacienteId: string): Promise<ProcedimentoTratamento[]> {
    const { data: procs, error: procError } = await supabase
      .from('tratamentos_procedimentos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: true });

    if (procError) throw procError;
    if (!procs || procs.length === 0) return [];

    const procIds = procs.map(p => p.id);

    // Carrega todas as sessões dos procedimentos do paciente
    const { data: sessoes, error: sessError } = await supabase
      .from('tratamento_sessoes')
      .select('*')
      .in('tratamento_procedimento_id', procIds)
      .order('numero_sessao', { ascending: true });

    if (sessError) throw sessError;

    // Carrega confirmações associadas
    const sessaoIds = (sessoes || []).map(s => s.id);
    let confirmacoes: ConfirmacaoSessao[] = [];
    if (sessaoIds.length > 0) {
      const { data: confs, error: confError } = await supabase
        .from('tratamento_confirmacoes')
        .select('*')
        .in('sessao_id', sessaoIds);

      if (!confError && confs) {
        confirmacoes = confs as ConfirmacaoSessao[];
      }
    }

    // Agrupa sessões e confirmações dentro de cada procedimento
    return procs.map(p => {
      const procsSessoes = (sessoes || [])
        .filter(s => s.tratamento_procedimento_id === p.id)
        .map(s => {
          const conf = confirmacoes.find(c => c.sessao_id === s.id);
          return {
            ...s,
            confirmacao: conf || null,
          } as SessaoTratamento;
        });

      return {
        ...p,
        sessoes: procsSessoes,
      } as ProcedimentoTratamento;
    });
  },

  /**
   * Sincroniza procedimentos a partir de um orçamento aprovado via RPC atômico.
   */
  async sincronizarProcedimentosOrcamento(
    orcamentoId: string,
    usuarioId: string,
    usuarioNome: string
  ): Promise<{ sucesso: boolean; importados: number; ignorados_financeiros: number }> {
    const { data, error } = await supabase.rpc('sincronizar_procedimentos_orcamento', {
      p_orcamento_id: orcamentoId,
      p_usuario_id: usuarioId,
      p_usuario_nome: usuarioNome,
    });

    if (error) throw error;
    return data as any;
  },

  /**
   * Atualiza status de um procedimento de tratamento (ex: não iniciado -> em tratamento -> pausado -> cancelado).
   */
  async atualizarStatusProcedimento(
    id: string,
    status: StatusProcedimentoTratamento,
    justificativa?: string,
    usuarioId?: string,
    usuarioNome?: string
  ): Promise<void> {
    const updates: any = {
      status,
      atualizado_em: new Date().toISOString(),
    };

    if (status === 'cancelado') {
      if (!justificativa || justificativa.trim().length < 5) {
        throw new Error('Justificativa é obrigatória para cancelamento de procedimento.');
      }
      updates.justificativa_cancelamento = justificativa;
    }

    if (status === 'em_tratamento') {
      updates.data_inicio = new Date().toISOString().split('T')[0];
    }

    const { data: proc, error } = await supabase
      .from('tratamentos_procedimentos')
      .update(updates)
      .eq('id', id)
      .select('clinica_id')
      .single();

    if (error) throw error;

    // Registra na auditoria
    if (usuarioId && proc) {
      await supabase.from('tratamento_historico_alteracoes').insert({
        tratamento_procedimento_id: id,
        clinica_id: proc.clinica_id,
        usuario_id: usuarioId,
        usuario_nome: usuarioNome || 'Profissional',
        acao: 'STATUS_ALTERADO',
        dados_novos: { status, justificativa },
        justificativa: justificativa || `Status alterado para ${status}`,
      });
    }
  },

  /**
   * Adiciona uma nova sessão (ilimitadas) a um procedimento.
   */
  async adicionarSessao(
    dados: Omit<SessaoTratamento, 'id' | 'criado_em' | 'atualizado_em'>,
    usuarioId: string,
    usuarioNome: string
  ): Promise<SessaoTratamento> {
    const { data, error } = await supabase
      .from('tratamento_sessoes')
      .insert({
        tratamento_procedimento_id: dados.tratamento_procedimento_id,
        clinica_id: dados.clinica_id,
        paciente_id: dados.paciente_id,
        numero_sessao: dados.numero_sessao,
        nome_objetivo: dados.nome_objetivo,
        data_prevista: dados.data_prevista,
        profissional_id: dados.profissional_id,
        profissional_nome: dados.profissional_nome,
        descricao_atos: dados.descricao_atos,
        observacoes_clinicas: dados.observacoes_clinicas,
        status: dados.status || 'prevista',
        consulta_id: dados.consulta_id || null,
        anexos: dados.anexos || [],
      })
      .select('*')
      .single();

    if (error) throw error;

    // Se o procedimento estava como 'nao_iniciado', passa automaticamente para 'em_tratamento'
    await supabase
      .from('tratamentos_procedimentos')
      .update({
        status: 'em_tratamento',
        data_inicio: new Date().toISOString().split('T')[0],
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', dados.tratamento_procedimento_id)
      .eq('status', 'nao_iniciado');

    // Registra auditoria
    await supabase.from('tratamento_historico_alteracoes').insert({
      tratamento_procedimento_id: dados.tratamento_procedimento_id,
      sessao_id: data.id,
      clinica_id: dados.clinica_id,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      acao: 'SESSAO_CRIADA',
      dados_novos: { numero_sessao: data.numero_sessao, nome_objetivo: data.nome_objetivo },
      justificativa: `Inclusão da Sessão ${data.numero_sessao}`,
    });

    return data as SessaoTratamento;
  },

  /**
   * Reagenda uma sessão futura mantendo auditoria da data anterior e motivo.
   */
  async reagendarSessao(
    sessaoId: string,
    novaData: string,
    motivo: string,
    usuarioId: string,
    usuarioNome: string
  ): Promise<void> {
    if (!motivo || motivo.trim().length < 3) {
      throw new Error('Motivo do reagendamento é obrigatório.');
    }

    const { data: sessao, error: fetchErr } = await supabase
      .from('tratamento_sessoes')
      .select('*')
      .eq('id', sessaoId)
      .single();

    if (fetchErr || !sessao) throw new Error('Sessão não localizada.');

    const { error: updErr } = await supabase
      .from('tratamento_sessoes')
      .update({
        data_prevista: novaData,
        data_prevista_anterior: sessao.data_prevista,
        motivo_reagendamento: motivo,
        status: 'agendada',
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', sessaoId);

    if (updErr) throw updErr;

    // Auditoria
    await supabase.from('tratamento_historico_alteracoes').insert({
      tratamento_procedimento_id: sessao.tratamento_procedimento_id,
      sessao_id: sessaoId,
      clinica_id: sessao.clinica_id,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      acao: 'SESSAO_REAGENDADA',
      dados_anteriores: { data_prevista: sessao.data_prevista },
      dados_novos: { data_prevista: novaData, motivo_reagendamento: motivo },
      justificativa: motivo,
    });
  },

  /**
   * Marca uma sessão como realizada, registrando data, hora, atos clínicos praticados e anexos.
   */
  async marcarSessaoRealizada(
    sessaoId: string,
    dados: {
      data_realizada: string;
      hora_realizada: string;
      descricao_atos: string;
      observacoes_clinicas?: string;
      anexos?: Array<{ nome: string; url: string }>;
    },
    usuarioId: string,
    usuarioNome: string
  ): Promise<void> {
    const { data: sessao, error: fetchErr } = await supabase
      .from('tratamento_sessoes')
      .select('*')
      .eq('id', sessaoId)
      .single();

    if (fetchErr || !sessao) throw new Error('Sessão não localizada.');

    const { error: updErr } = await supabase
      .from('tratamento_sessoes')
      .update({
        status: 'realizada',
        data_realizada: dados.data_realizada,
        hora_realizada: dados.hora_realizada,
        descricao_atos: dados.descricao_atos,
        observacoes_clinicas: dados.observacoes_clinicas,
        anexos: dados.anexos || sessao.anexos || [],
        concluido_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', sessaoId);

    if (updErr) throw updErr;

    // Auditoria
    await supabase.from('tratamento_historico_alteracoes').insert({
      tratamento_procedimento_id: sessao.tratamento_procedimento_id,
      sessao_id: sessaoId,
      clinica_id: sessao.clinica_id,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      acao: 'SESSAO_REALIZADA',
      dados_novos: {
        data_realizada: dados.data_realizada,
        hora_realizada: dados.hora_realizada,
        descricao_atos: dados.descricao_atos,
      },
      justificativa: 'Sessão concluída pelo profissional',
    });
  },

  /**
   * Gera ou regenera um token criptográfico único para confirmação digital do paciente.
   */
  async gerarLinkConfirmacaoSessao(
    sessaoId: string,
    pacienteId: string,
    clinicaId: string,
    diasValidade: number = 7
  ): Promise<{ token: string; link: string; expiraEm: string }> {
    // Gera token de alta entropia (64 hex characters)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

    const expiraEmDate = new Date();
    expiraEmDate.setDate(expiraEmDate.getDate() + diasValidade);
    const expiraEm = expiraEmDate.toISOString();

    // Texto objetivo de declaração
    const declaracaoTexto = 
      'Declaro para os devidos fins que compareci à Clínica Rosângela na data informada e recebi os atos clínicos descritos nesta sessão de atendimento. Esta confirmação atesta exclusivamente a realização do atendimento presencial e não constitui quitação financeira ou renúncia de direitos.';

    // Invalida tokens anteriores pendentes para a mesma sessão
    await supabase
      .from('tratamento_confirmacoes')
      .update({ status: 'expirado' })
      .eq('sessao_id', sessaoId)
      .eq('status', 'pendente');

    // Cria o novo registro de confirmação
    const { error } = await supabase
      .from('tratamento_confirmacoes')
      .insert({
        sessao_id: sessaoId,
        paciente_id: pacienteId,
        clinica_id: clinicaId,
        token,
        token_expira_em: expiraEm,
        status: 'pendente',
        declaracao_texto: declaracaoTexto,
      });

    if (error) throw error;

    // Atualiza status da sessão para aguardando_confirmacao
    await supabase
      .from('tratamento_sessoes')
      .update({
        status: 'aguardando_confirmacao',
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', sessaoId);

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.lentesemresinamaceio.com.br';
    const link = `${baseUrl}/confirmar-sessao/${token}`;

    return { token, link, expiraEm };
  },

  /**
   * Conclui formalmente o procedimento e emite o Termo de Conclusão do Tratamento via RPC.
   */
  async concluirProcedimento(
    procedimentoId: string,
    usuarioId: string,
    usuarioNome: string,
    observacoes?: string
  ): Promise<{ sucesso: boolean; termo_conclusao_id: string; total_sessoes: number }> {
    const { data, error } = await supabase.rpc('concluir_procedimento_tratamento', {
      p_procedimento_id: procedimentoId,
      p_usuario_id: usuarioId,
      p_usuario_nome: usuarioNome,
      p_observacoes: observacoes || null,
    });

    if (error) throw error;
    return data as any;
  },

  /**
   * Reabre formalmente um procedimento concluído com justificativa auditada.
   */
  async reabrirProcedimento(
    procedimentoId: string,
    usuarioId: string,
    usuarioNome: string,
    justificativa: string
  ): Promise<{ sucesso: boolean; procedimento_id: string; status: string }> {
    const { data, error } = await supabase.rpc('reabrir_procedimento_tratamento', {
      p_procedimento_id: procedimentoId,
      p_usuario_id: usuarioId,
      p_usuario_nome: usuarioNome,
      p_justificativa: justificativa,
    });

    if (error) throw error;
    return data as any;
  },

  /**
   * Carrega histórico de auditoria de um procedimento ou sessão.
   */
  async carregarHistorico(procedimentoId: string): Promise<HistoricoTratamento[]> {
    const { data, error } = await supabase
      .from('tratamento_historico_alteracoes')
      .select('*')
      .eq('tratamento_procedimento_id', procedimentoId)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return (data || []) as HistoricoTratamento[];
  },
};

