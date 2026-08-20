import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Medicamento {
  id: string;
  nome: string;
  principioAtivo?: string | null;
  apresentacao?: string | null;
  dosagem?: string | null;
  posologia?: string | null;
  periodo?: string | null;
  quantidade?: string | null;
  observacoes?: string | null;
  ativo: boolean;
}

interface MedicamentoRow {
  id: string;
  nome: string;
  principio_ativo: string | null;
  apresentacao: string | null;
  dosagem: string | null;
  posologia: string | null;
  periodo: string | null;
  quantidade: string | null;
  observacoes: string | null;
  ativo: boolean;
}

const fromRow = (r: MedicamentoRow): Medicamento => ({
  id: r.id,
  nome: r.nome,
  principioAtivo: r.principio_ativo,
  apresentacao: r.apresentacao,
  dosagem: r.dosagem,
  posologia: r.posologia,
  periodo: r.periodo,
  quantidade: r.quantidade,
  observacoes: r.observacoes,
  ativo: r.ativo,
});

type MedicamentoUpdate = Partial<Omit<MedicamentoRow, 'id'>>;

const toRow = (m: Partial<Medicamento>): MedicamentoUpdate => {
  const row: MedicamentoUpdate = {};
  if (m.nome !== undefined) row.nome = m.nome;
  if (m.principioAtivo !== undefined) row.principio_ativo = m.principioAtivo || null;
  if (m.apresentacao !== undefined) row.apresentacao = m.apresentacao || null;
  if (m.dosagem !== undefined) row.dosagem = m.dosagem || null;
  if (m.posologia !== undefined) row.posologia = m.posologia || null;
  if (m.periodo !== undefined) row.periodo = m.periodo || null;
  if (m.quantidade !== undefined) row.quantidade = m.quantidade || null;
  if (m.observacoes !== undefined) row.observacoes = m.observacoes || null;
  if (m.ativo !== undefined) row.ativo = m.ativo;
  return row;
};

export const useMedicamentos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMedicamentos = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('medicamentos')
      .select('*')
      .eq('user_id', user.id)
      .order('nome');
    if (error) {
      toast({ title: 'Erro ao carregar medicamentos', description: error.message, variant: 'destructive' });
    } else {
      setMedicamentos(((data || []) as MedicamentoRow[]).map(fromRow));
    }
    setLoading(false);
  }, [user?.id, toast]);

  useEffect(() => {
    fetchMedicamentos();
  }, [fetchMedicamentos]);

  const addMedicamento = async (m: Omit<Medicamento, 'id'>) => {
    if (!user?.id) return;
    const { error } = await supabase.from('medicamentos').insert({ user_id: user.id, ...toRow(m), nome: m.nome });
    if (error) {
      toast({ title: 'Erro ao adicionar medicamento', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Medicamento cadastrado!' });
    await fetchMedicamentos();
  };

  const updateMedicamento = async (id: string, patch: Partial<Medicamento>) => {
    const { error } = await supabase.from('medicamentos').update(toRow(patch)).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar medicamento', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Medicamento atualizado' });
    await fetchMedicamentos();
  };

  const deleteMedicamento = async (id: string) => {
    const { error } = await supabase.from('medicamentos').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir medicamento', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Medicamento removido' });
    await fetchMedicamentos();
  };

  return { medicamentos, loading, addMedicamento, updateMedicamento, deleteMedicamento, refetch: fetchMedicamentos };
};
