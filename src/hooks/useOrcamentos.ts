import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { registrarAuditoria } from './useAuditLog';
import { gerarTokenAcessoOrcamento } from '@/utils/orcamentoEngine';

export type StatusOrcamento =
  | 'rascunho'
  | 'enviado'
  | 'aguardando_aprovacao'
  | 'ajuste_solicitado'
  | 'em_revisao'
  | 'nova_proposta_enviada'
  | 'aprovado'
  | 'recusado'
  | 'expirado';

export interface OrcamentoItem {
  nome: string;
  quantidade: number;
  valor: number;
}

export interface Orcamento {
  id: string;
  identificador?: string;
  pacienteId?: string | null;
  pacienteNome?: string | null;
  titulo: string;
  itens: OrcamentoItem[];
  desconto: number;
  total: number;
  status: StatusOrcamento;
  versao?: number;
  solicitacoesAjuste?: any[];
  historicoVersoes?: any[];
  validade?: string | null;
  observacoes?: string | null;
  formasPagamento?: string | null;
  tokenAssinatura?: string | null;
  dataExpiracaoLink?: string | null;
  aprovadoEm?: string | null;
  condicaoEscolhida?: any;
  snapshotAprovacao?: any;
  fotosPlanejamento?: any[];
  contratoId?: string | null;
  contratoToken?: string | null;
  contratoStatus?: string | null;
  contratoFormalizadoEm?: string | null;
  assinaturaDraStatus?: string | null;
  assinaturaPacienteStatus?: string | null;
  pdfPath?: string | null;

  parceiroId?: string | null;
  parceiroNome?: string | null;
  parceiroTipoRepasse?: 'percentual' | 'fixo' | null;
  parceiroValorRepasse?: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

const rowToOrcamento = (row: any): Orcamento | null => {
  if (!row) return null;
  const snap = row.assinatura_paciente || {};
  return {
    id: row.id,
    identificador: row.identificador || snap.identificador || (row.id ? `ORC-${String(row.id).slice(0, 8).toUpperCase()}` : undefined),
    pacienteId: row.paciente_id,
    pacienteNome: row.paciente_nome,
    titulo: row.titulo || 'Plano de tratamento',
    itens: Array.isArray(row.itens) ? row.itens : [],
    desconto: Number(row.desconto || 0),
    total: Number(row.total || 0),
    status: (row.status || snap.status || 'rascunho') as StatusOrcamento,
    versao: Number(row.versao || snap.versao || 1),
    solicitacoesAjuste: Array.isArray(row.solicitacoes_ajuste) ? row.solicitacoes_ajuste : (snap.solicitacoesAjuste || []),
    historicoVersoes: Array.isArray(row.historico_versoes) ? row.historico_versoes : (snap.historicoVersoes || []),
    validade: row.validade,
    observacoes: row.observacoes,
    formasPagamento: (row as any).formas_pagamento ?? snap.formasPagamento ?? snap.formas_pagamento ?? null,
    tokenAssinatura: row.token_assinatura || snap.tokenAssinatura,
    dataExpiracaoLink: row.data_expiracao_link || snap.dataExpiracaoLink,
    aprovadoEm: row.aprovado_em || snap.aprovadoEm || row.data_assinatura,
    condicaoEscolhida: row.condicao_escolhida || snap.condicaoEscolhida,
    snapshotAprovacao: row.snapshot_aprovacao || snap.snapshotAprovacao,
    fotosPlanejamento: Array.isArray(row.fotos_planejamento) ? row.fotos_planejamento : (snap.fotosPlanejamento || []),
    contratoId: row.contrato_id || snap.contratoId,
    contratoToken: row.contrato_token || snap.contratoToken,
    contratoStatus: row.contrato_status || snap.contratoStatus || snap.statusContrato || null,
    contratoFormalizadoEm: row.contrato_formalizado_em || snap.contratoFormalizadoEm || null,
    assinaturaDraStatus: row.assinatura_dra_status || snap.assinaturaDraStatus || null,
    assinaturaPacienteStatus: row.assinatura_paciente_status || snap.assinaturaPacienteStatus || null,
    pdfPath: row.pdf_path || snap.pdfPath || null,
    parceiroId: row.parceiro_id,
    parceiroNome: row.parceiro_nome,
    parceiroTipoRepasse: row.parceiro_tipo_repasse,
    parceiroValorRepasse: Number(row.parceiro_valor_repasse || 0),
    criadoEm: new Date(row.criado_em || row.created_at || new Date()),
    atualizadoEm: new Date(row.atualizado_em || row.updated_at || row.criado_em || row.created_at || new Date()),
  };
};

export const useOrcamentos = (pacienteId?: string) => {
  const { user, clinicaId } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setOrcamentos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase.from('orcamentos').select('*').order('criado_em', { ascending: false });
    if (pacienteId) query = query.eq('paciente_id', pacienteId);
    const { data, error } = await query;
    if (error) console.error('Erro ao carregar orçamentos:', error);
    setOrcamentos((data || []).map(rowToOrcamento).filter(Boolean) as Orcamento[]);
    setLoading(false);
  }, [user, pacienteId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOrcamento = async (o: Partial<Orcamento> & { itens: OrcamentoItem[] }) => {
    if (!user) return;
    const subtotal = o.itens.reduce((s, i) => s + (i.valor || 0) * (i.quantidade || 1), 0);
    const total = Math.max(0, subtotal - (o.desconto || 0));
    const payload: Record<string, any> = {
      user_id: clinicaId,
      paciente_id: o.pacienteId ?? pacienteId ?? null,
      paciente_nome: o.pacienteNome ?? null,
      titulo: o.titulo || 'Plano de tratamento',
      itens: o.itens as never,
      desconto: o.desconto || 0,
      total,
      status: o.status || 'rascunho',
      validade: o.validade || null,
      observacoes: o.observacoes || null,
      formas_pagamento: o.formasPagamento || null,
      parceiro_id: o.parceiroId || null,
      parceiro_nome: o.parceiroNome || null,
      parceiro_tipo_repasse: o.parceiroTipoRepasse || null,
      parceiro_valor_repasse: o.parceiroValorRepasse || 0,
      atualizado_em: new Date().toISOString(),
    };

    const identificador = o.identificador || (o.id ? `ORC-${String(o.id).slice(0, 8).toUpperCase()}` : undefined);
    const snapAssinatura = {
      identificador,
      tokenAssinatura: o.tokenAssinatura,
      dataExpiracaoLink: o.dataExpiracaoLink,
      aprovadoEm: o.aprovadoEm,
      condicaoEscolhida: o.condicaoEscolhida,
      snapshotAprovacao: o.snapshotAprovacao,
      fotosPlanejamento: o.fotosPlanejamento || [],
      contratoId: o.contratoId,
      contratoToken: o.contratoToken,
      contratoStatus: o.contratoStatus,
      contratoFormalizadoEm: o.contratoFormalizadoEm,
      assinaturaDraStatus: o.assinaturaDraStatus,
      assinaturaPacienteStatus: o.assinaturaPacienteStatus,
      pdfPath: o.pdfPath,
      versao: o.versao || 1,
      solicitacoesAjuste: o.solicitacoesAjuste || [],
      historicoVersoes: o.historicoVersoes || [],
    };
    payload.assinatura_paciente = snapAssinatura;

    const tokenAssinaturaFinal = o.tokenAssinatura || (o as any).token_assinatura || (!o.id ? gerarTokenAcessoOrcamento() : undefined);
    if (tokenAssinaturaFinal) {
      payload.token_assinatura = tokenAssinaturaFinal;
      snapAssinatura.tokenAssinatura = tokenAssinaturaFinal;
      (snapAssinatura as any).token = tokenAssinaturaFinal;
    }
    if (o.dataExpiracaoLink) payload.data_expiracao_link = o.dataExpiracaoLink;
    if (o.aprovadoEm) payload.data_assinatura = o.aprovadoEm;

    let { data: savedRow, error } = o.id
      ? await supabase.from('orcamentos').update(payload).eq('id', o.id).select('id').maybeSingle()
      : await supabase.from('orcamentos').insert(payload).select('id').maybeSingle();

    if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
      const retry = o.id
        ? await supabase.from('orcamentos').update(payload).eq('id', o.id).select('id').maybeSingle()
        : await supabase.from('orcamentos').insert(payload).select('id').maybeSingle();
      error = retry.error;
      savedRow = retry.data;
    }

    if (error) {
      console.error(error);
      alert('Erro DB Orçamento: ' + error.message);
      toast.error('Erro ao salvar orçamento');
      return;
    }

    const savedId = o.id || savedRow?.id;
    if (savedId && typeof window !== 'undefined' && window.localStorage) {
      try {
        const cacheItem = {
          ...o,
          id: savedId,
          identificador: identificador || `ORC-${String(savedId).slice(0, 8).toUpperCase()}`,
          tokenAssinatura: o.tokenAssinatura,
          total,
          versao: o.versao || 1,
          solicitacoesAjuste: o.solicitacoesAjuste || [],
          historicoVersoes: o.historicoVersoes || [],
        };
        if (identificador) {
          window.localStorage.setItem(`orcamento_${identificador}`, JSON.stringify(cacheItem));
        }
        window.localStorage.setItem(`orcamento_${savedId}`, JSON.stringify(cacheItem));
      } catch (_) {}
    }

    if (error) {
      console.error(error);
      alert('Erro DB Orçamento: ' + error.message);
      toast.error('Erro ao salvar orçamento');
      return;
    }
    if (payload.status === 'aprovado' && payload.paciente_id) {
      try {
        await supabase
          .from('pacientes')
          .update({
            status: 'Em Tratamento',
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', payload.paciente_id);
      } catch (errPac) {
        console.error('Erro ao atualizar status do paciente para Em Tratamento:', errPac);
      }
    }

    await registrarAuditoria({
      acao: o.id ? 'atualizou' : 'criou',
      entidade: 'orcamento',
      entidadeId: o.id,
      descricao: `${payload.titulo} — total ${total.toFixed(2)}`,
    });
    toast.success('Orçamento salvo');
    load();
  };

  const updateStatus = async (id: string, status: Orcamento['status']) => {
    const { error } = await supabase.from('orcamentos').update({ 
      status,
      atualizado_em: new Date().toISOString()
    }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
      return;
    }
    await registrarAuditoria({ acao: 'status', entidade: 'orcamento', entidadeId: id, descricao: status });

    if (status === 'aprovado') {
      try {
        const orcAlvo = orcamentos.find((o) => o.id === id);
        let pId = orcAlvo?.pacienteId || pacienteId;
        if (!pId) {
          const { data: orcDb } = await supabase
            .from('orcamentos')
            .select('paciente_id')
            .eq('id', id)
            .maybeSingle();
          pId = orcDb?.paciente_id;
        }
        if (pId) {
          await supabase
            .from('pacientes')
            .update({
              status: 'Em Tratamento',
              atualizado_em: new Date().toISOString(),
            })
            .eq('id', pId);
        }
      } catch (errPac) {
        console.error('Erro ao atualizar status do paciente para Em Tratamento:', errPac);
      }
    }

    load();
  };

  const deleteOrcamento = async (id: string): Promise<boolean> => {
    // 1. Verificação defensiva prévia: proíbe exclusão física de orçamentos aprovados ou com contrato
    const { data: checkRow } = await supabase
      .from('orcamentos')
      .select('status, contrato_id, assinatura_paciente')
      .eq('id', id)
      .maybeSingle();

    if (checkRow) {
      const snap = (checkRow.assinatura_paciente || {}) as any;
      const temContrato = Boolean(checkRow.contrato_id || snap.contratoId);
      if (checkRow.status === 'aprovado' || checkRow.status === 'formalizado' || temContrato) {
        toast.error('Exclusão física bloqueada por segurança jurídica', {
          description: 'Orçamentos aprovados ou com contrato formalizado devem ser cancelados/arquivados administrativamente, preservando a validade jurídica dos documentos.',
        });
        return false;
      }
    }

    // 2. Verifica se existem movimentações quitadas no Caixa
    const { data: transVinculadas } = await supabase
      .from('transacoes')
      .select('id, status, valor, descricao')
      .eq('orcamento_id', id);

    const temPagas = (transVinculadas || []).some((t: any) => {
      const s = String(t?.status || '').toLowerCase().trim();
      return s === 'pago' || s === 'quitado' || s === 'paga' || s === 'quitada' || s === 'concluido';
    });

    if (temPagas) {
      toast.error('Exclusão física bloqueada: existem recebimentos quitados no Caixa', {
        description: 'Orçamentos com recebimentos já confirmados devem ser cancelados/arquivados administrativamente para proteger o histórico financeiro.',
      });
      return false;
    }

    // 3. Remove parcelas pendentes vinculadas para não deixar transações órfãs
    if (transVinculadas && transVinculadas.length > 0) {
      await supabase.from('transacoes').delete().eq('orcamento_id', id).neq('status', 'pago');
    }

    // 4. Executa delete exigindo confirmação de linhas afetadas no banco via .select('id')
    const { data, error } = await supabase.from('orcamentos').delete().eq('id', id).select('id');
    if (error) {
      toast.error('Erro ao remover orçamento: ' + error.message);
      return false;
    }

    if (!data || data.length === 0) {
      toast.error('O orçamento não pôde ser removido', {
        description: 'Operação não autorizada pela segurança do banco (RLS) ou registro inexistente.',
      });
      return false;
    }

    await registrarAuditoria({ acao: 'removeu', entidade: 'orcamento', entidadeId: id });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('financeiro:transacoes-atualizadas', { detail: { orcamentoId: id, tipo: 'excluido' } })
      );
    }
    toast.success('Orçamento removido com sucesso');
    load();
    return true;
  };

  return { orcamentos, loading, saveOrcamento, updateStatus, deleteOrcamento, reload: load };
};
