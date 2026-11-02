import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { registrarAuditoria } from './useAuditLog';

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
    formasPagamento: (row as any).formas_pagamento ?? null,
    tokenAssinatura: row.token_assinatura || snap.tokenAssinatura,
    dataExpiracaoLink: row.data_expiracao_link || snap.dataExpiracaoLink,
    aprovadoEm: row.aprovado_em || snap.aprovadoEm || row.data_assinatura,
    condicaoEscolhida: row.condicao_escolhida || snap.condicaoEscolhida,
    snapshotAprovacao: row.snapshot_aprovacao || snap.snapshotAprovacao,
    fotosPlanejamento: Array.isArray(row.fotos_planejamento) ? row.fotos_planejamento : (snap.fotosPlanejamento || []),
    contratoId: row.contrato_id || snap.contratoId,
    contratoToken: row.contrato_token || snap.contratoToken,
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

    const snapAssinatura = {
      identificador: o.identificador,
      tokenAssinatura: o.tokenAssinatura,
      dataExpiracaoLink: o.dataExpiracaoLink,
      aprovadoEm: o.aprovadoEm,
      condicaoEscolhida: o.condicaoEscolhida,
      snapshotAprovacao: o.snapshotAprovacao,
      fotosPlanejamento: o.fotosPlanejamento,
      contratoId: o.contratoId,
      contratoToken: o.contratoToken,
      versao: o.versao || 1,
      solicitacoesAjuste: o.solicitacoesAjuste || [],
      historicoVersoes: o.historicoVersoes || [],
    };
    payload.assinatura_paciente = snapAssinatura;

    if (o.identificador) payload.identificador = o.identificador;
    if (o.tokenAssinatura) payload.token_assinatura = o.tokenAssinatura;
    if (o.dataExpiracaoLink) payload.data_expiracao_link = o.dataExpiracaoLink;
    if (o.aprovadoEm) payload.aprovado_em = o.aprovadoEm;
    if (o.condicaoEscolhida) payload.condicao_escolhida = o.condicaoEscolhida;
    if (o.snapshotAprovacao) payload.snapshot_aprovacao = o.snapshotAprovacao;
    if (o.fotosPlanejamento) payload.fotos_planejamento = o.fotosPlanejamento;
    if (o.contratoId) payload.contrato_id = o.contratoId;
    if (o.contratoToken) payload.contrato_token = o.contratoToken;
    if (o.versao !== undefined) payload.versao = o.versao;
    if (o.solicitacoesAjuste) payload.solicitacoes_ajuste = o.solicitacoesAjuste;
    if (o.historicoVersoes) payload.historico_versoes = o.historicoVersoes;

    let { error } = o.id
      ? await supabase.from('orcamentos').update(payload).eq('id', o.id)
      : await supabase.from('orcamentos').insert(payload);

    if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
      delete payload.identificador;
      delete payload.fotos_planejamento;
      delete payload.condicao_escolhida;
      delete payload.snapshot_aprovacao;
      delete payload.contrato_id;
      delete payload.contrato_token;
      delete payload.aprovado_em;
      delete payload.versao;
      delete payload.solicitacoes_ajuste;
      delete payload.historico_versoes;

      const retry = o.id
        ? await supabase.from('orcamentos').update(payload).eq('id', o.id)
        : await supabase.from('orcamentos').insert(payload);
      error = retry.error;
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

  const deleteOrcamento = async (id: string) => {
    const { error } = await supabase.from('orcamentos').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover orçamento');
      return;
    }
    await registrarAuditoria({ acao: 'removeu', entidade: 'orcamento', entidadeId: id });
    toast.success('Orçamento removido');
    load();
  };

  return { orcamentos, loading, saveOrcamento, updateStatus, deleteOrcamento, reload: load };
};
