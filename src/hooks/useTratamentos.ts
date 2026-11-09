import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ProcedimentoTratamento, StatusProcedimentoTratamento, SessaoTratamento } from '@/types/tratamento';
import { tratamentoService } from '@/services/tratamentoService';

export function useTratamentos(pacienteId?: string) {
  const { user } = useAuth();
  const [procedimentos, setProcedimentos] = useState<ProcedimentoTratamento[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!pacienteId) {
      setProcedimentos([]);
      setIsLoading(false);
      return;
    }

    if (!silencioso) setIsLoading(true);
    try {
      const dados = await tratamentoService.carregarProcedimentosPaciente(pacienteId);
      setProcedimentos(dados);
    } catch (err: any) {
      console.error('[useTratamentos] Erro ao carregar procedimentos:', err);
      if (!silencioso) {
        toast.error('Erro ao carregar etapas do tratamento.');
      }
    } finally {
      if (!silencioso) setIsLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const sincronizarOrcamento = async (orcamentoId: string, indicesSelecionados?: number[]) => {
    if (!user?.id) throw new Error('Usuário não autenticado');
    setIsSyncing(true);
    try {
      const res = await tratamentoService.sincronizarProcedimentosOrcamento(
        orcamentoId,
        user.id,
        user.user_metadata?.nome || user.email?.split('@')[0] || 'Profissional',
        indicesSelecionados
      );
      await carregar(true);
      toast.success(
        `Sincronização concluída! ${res.importados} procedimento(s) clínico(s) importado(s). ${res.ignorados_financeiros} ajuste(s) financeiro(s) filtrado(s).`
      );
      return res;
    } catch (err: any) {
      console.error('[useTratamentos] Erro na sincronização:', err);
      toast.error(`Falha ao sincronizar: ${err.message}`);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const atualizarStatusProcedimento = async (
    procedimentoId: string,
    status: StatusProcedimentoTratamento,
    justificativa?: string
  ) => {
    try {
      await tratamentoService.atualizarStatusProcedimento(
        procedimentoId,
        status,
        justificativa,
        user?.id,
        user?.user_metadata?.nome || user?.email?.split('@')[0]
      );
      await carregar(true);
      toast.success(`Status do procedimento alterado para: ${status.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
      throw err;
    }
  };

  const adicionarSessao = async (dados: Omit<SessaoTratamento, 'id' | 'criado_em' | 'atualizado_em'>) => {
    if (!user?.id) throw new Error('Usuário não autenticado');
    try {
      const sessao = await tratamentoService.adicionarSessao(
        dados,
        user.id,
        user.user_metadata?.nome || user.email?.split('@')[0] || 'Profissional'
      );
      await carregar(true);
      toast.success(`Sessão ${sessao.numero_sessao} adicionada com sucesso!`);
      return sessao;
    } catch (err: any) {
      toast.error(`Erro ao adicionar sessão: ${err.message}`);
      throw err;
    }
  };

  const reagendarSessao = async (sessaoId: string, novaData: string, motivo: string) => {
    if (!user?.id) throw new Error('Usuário não autenticado');
    try {
      await tratamentoService.reagendarSessao(
        sessaoId,
        novaData,
        motivo,
        user.id,
        user.user_metadata?.nome || user.email?.split('@')[0] || 'Profissional'
      );
      await carregar(true);
      toast.success('Sessão reagendada com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao reagendar: ${err.message}`);
      throw err;
    }
  };

  const marcarSessaoRealizada = async (
    sessaoId: string,
    dados: {
      data_realizada: string;
      hora_realizada: string;
      descricao_atos: string;
      observacoes_clinicas?: string;
      anexos?: Array<{ nome: string; url: string }>;
    }
  ) => {
    if (!user?.id) throw new Error('Usuário não autenticado');
    try {
      await tratamentoService.marcarSessaoRealizada(
        sessaoId,
        dados,
        user.id,
        user.user_metadata?.nome || user.email?.split('@')[0] || 'Profissional'
      );
      await carregar(true);
      toast.success('Sessão marcada como realizada!');
    } catch (err: any) {
      toast.error(`Erro ao concluir sessão: ${err.message}`);
      throw err;
    }
  };

  const gerarLinkConfirmacao = async (sessaoId: string, diasValidade: number = 7) => {
    if (!pacienteId) throw new Error('Paciente não selecionado');
    try {
      const sessao = procedimentos.flatMap(p => p.sessoes || []).find(s => s.id === sessaoId);
      const clinicaId = sessao?.clinica_id || user?.id || '';
      const res = await tratamentoService.gerarLinkConfirmacaoSessao(
        sessaoId,
        pacienteId,
        clinicaId,
        diasValidade
      );
      await carregar(true);
      toast.success('Link de confirmação digital gerado com sucesso!');
      return res;
    } catch (err: any) {
      toast.error(`Erro ao gerar link de confirmação: ${err.message}`);
      throw err;
    }
  };

  const concluirProcedimento = async (procedimentoId: string, observacoes?: string) => {
    if (!user?.id) throw new Error('Usuário não autenticado');
    try {
      const res = await tratamentoService.concluirProcedimento(
        procedimentoId,
        user.id,
        user.user_metadata?.nome || user.email?.split('@')[0] || 'Profissional',
        observacoes
      );
      await carregar(true);
      toast.success('Procedimento concluído e Termo de Conclusão emitido com sucesso!');
      return res;
    } catch (err: any) {
      toast.error(`Erro ao concluir procedimento: ${err.message}`);
      throw err;
    }
  };

  const reabrirProcedimento = async (procedimentoId: string, justificativa: string) => {
    if (!user?.id) throw new Error('Usuário não autenticado');
    try {
      const res = await tratamentoService.reabrirProcedimento(
        procedimentoId,
        user.id,
        user.user_metadata?.nome || user.email?.split('@')[0] || 'Profissional',
        justificativa
      );
      await carregar(true);
      toast.success('Procedimento reaberto com sucesso!');
      return res;
    } catch (err: any) {
      toast.error(`Erro ao reabrir procedimento: ${err.message}`);
      throw err;
    }
  };

  return {
    procedimentos,
    isLoading,
    isSyncing,
    recarregar: carregar,
    sincronizarOrcamento,
    atualizarStatusProcedimento,
    adicionarSessao,
    reagendarSessao,
    marcarSessaoRealizada,
    gerarLinkConfirmacao,
    concluirProcedimento,
    reabrirProcedimento,
  };
}

