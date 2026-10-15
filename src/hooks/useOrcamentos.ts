import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { registrarAuditoria } from './useAuditLog';

export interface OrcamentoItem {
  nome: string;
  quantidade: number;
  valor: number;
}

export interface Orcamento {
  id: string;
  pacienteId?: string | null;
  pacienteNome?: string | null;
  titulo: string;
  itens: OrcamentoItem[];
  desconto: number;
  total: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  validade?: string | null;
  observacoes?: string | null;
  formasPagamento?: string | null;

  parceiroId?: string | null;
  parceiroNome?: string | null;
  parceiroTipoRepasse?: 'percentual' | 'fixo' | null;
  parceiroValorRepasse?: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

const rowToOrcamento = (row: any): Orcamento | null => {
  if (!row) return null;
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    pacienteNome: row.paciente_nome,
    titulo: row.titulo || 'Plano de tratamento',
    itens: Array.isArray(row.itens) ? row.itens : [],
    desconto: Number(row.desconto || 0),
    total: Number(row.total || 0),
    status: row.status || 'rascunho',
    validade: row.validade,
    observacoes: row.observacoes,
    formasPagamento: (row as any).formas_pagamento ?? null,
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
    const payload = {
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

    const { error } = o.id
      ? await supabase.from('orcamentos').update(payload).eq('id', o.id)
      : await supabase.from('orcamentos').insert(payload);

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

