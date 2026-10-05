import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Procedimento, CategoriaProcedimento, ComplexidadeProcedimento } from '@/types/procedimentos';

export interface Pacote {
  id: string;
  nome: string;
  descricao: string;
  procedimentos: string[];
  precoTotal: number;
  desconto: number;
  ativo: boolean;
}

const rowToProcedimento = (row: any): Procedimento => ({
  id: row.id,
  nome: row.nome,
  categoria: (row.categoria || 'outros') as CategoriaProcedimento,
  descricao: row.descricao || '',
  preco: Number(row.preco || 0),
  precoConvenio: row.preco_convenio != null ? Number(row.preco_convenio) : undefined,
  duracaoMinutos: row.duracao_minutos ?? 30,
  complexidade: (row.complexidade || 'baixa') as ComplexidadeProcedimento,
  requererAnestesia: !!row.requerer_anestesia,
  requererRaioX: !!row.requerer_raio_x,
  materiaisNecessarios: Array.isArray(row.materiais_necessarios) ? row.materiais_necessarios : [],
  equipamentosNecessarios: Array.isArray(row.equipamentos_necessarios) ? row.equipamentos_necessarios : [],
  ativo: !!row.ativo,
  observacoes: row.observacoes || undefined,
  criadoEm: new Date(row.criado_em),
  atualizadoEm: new Date(row.atualizado_em),
  criadoPor: row.criado_por || '',
});

const procedimentoToRow = (p: Partial<Procedimento>) => ({
  nome: p.nome,
  categoria: p.categoria,
  descricao: p.descricao ?? null,
  preco: p.preco ?? 0,
  preco_convenio: p.precoConvenio ?? 0,
  duracao_minutos: p.duracaoMinutos ?? 30,
  complexidade: p.complexidade ?? 'baixa',
  requerer_anestesia: p.requererAnestesia ?? false,
  requerer_raio_x: p.requererRaioX ?? false,
  materiais_necessarios: p.materiaisNecessarios ?? [],
  equipamentos_necessarios: p.equipamentosNecessarios ?? [],
  observacoes: p.observacoes ?? null,
  ativo: p.ativo ?? true,
  criado_por: p.criadoPor ?? null,
});

const rowToPacote = (row: any): Pacote => ({
  id: row.id,
  nome: row.nome,
  descricao: row.descricao || '',
  procedimentos: Array.isArray(row.procedimento_ids) ? row.procedimento_ids : [],
  precoTotal: Number(row.preco || 0),
  desconto: Number(row.desconto_percentual || 0),
  ativo: !!row.ativo,
});

export const useProcedimentos = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (authLoading) return;
    if (!clinicaId) {
      setProcedimentos([]);
      setPacotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [procRes, pacRes] = await Promise.all([
      supabase.from('procedimentos').select('*').eq('user_id', clinicaId).order('nome'),
      supabase.from('pacotes_procedimentos').select('*').eq('user_id', clinicaId).order('nome'),
    ]);
    if (procRes.error) {
      toast({ title: 'Erro ao carregar procedimentos', description: procRes.error.message, variant: 'destructive' });
    } else {
      setProcedimentos((procRes.data || []).map(rowToProcedimento));
    }
    if (!pacRes.error) setPacotes((pacRes.data || []).map(rowToPacote));
    setLoading(false);
  }, [clinicaId, authLoading, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addProcedimento = async (p: Omit<Procedimento, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    if (!clinicaId) return;
    const { error } = await supabase.from('procedimentos').insert({ ...procedimentoToRow(p), user_id: clinicaId });
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Procedimento salvo!' });
    await fetchAll();
  };

  const updateProcedimento = async (id: string, p: Partial<Procedimento>) => {
    const { error } = await supabase.from('procedimentos').update(procedimentoToRow(p)).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Procedimento atualizado!' });
    await fetchAll();
  };

  const deleteProcedimento = async (id: string) => {
    const { error } = await supabase.from('procedimentos').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Procedimento removido' });
    await fetchAll();
  };

  const duplicateProcedimento = async (p: Procedimento) => {
    await addProcedimento({ ...p, nome: `${p.nome} (cópia)` });
  };

  const addPacote = async (pacote: Omit<Pacote, 'id'>) => {
    if (!clinicaId) return;
    const { error } = await supabase.from('pacotes_procedimentos').insert({
      user_id: clinicaId,
      nome: pacote.nome,
      descricao: pacote.descricao || null,
      procedimento_ids: pacote.procedimentos,
      preco: pacote.precoTotal,
      desconto_percentual: pacote.desconto,
      ativo: pacote.ativo,
    });
    if (error) {
      toast({ title: 'Erro ao salvar pacote', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Pacote criado!' });
    await fetchAll();
  };

  const deletePacote = async (id: string) => {
    const { error } = await supabase.from('pacotes_procedimentos').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir pacote', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Pacote removido' });
    await fetchAll();
  };

  return {
    procedimentos,
    pacotes,
    loading,
    addProcedimento,
    updateProcedimento,
    deleteProcedimento,
    duplicateProcedimento,
    addPacote,
    deletePacote,
    refetch: fetchAll,
  };
};

