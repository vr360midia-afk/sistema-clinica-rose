import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type TipoRepasse = 'percentual' | 'fixo';

export interface Parceiro {
  id: string;
  nome: string;
  especialidade?: string | null;
  telefone?: string | null;
  email?: string | null;
  tipoRepasse: TipoRepasse;
  valorRepasse: number;
  observacoes?: string | null;
  ativo: boolean;
}

interface ParceiroRow {
  id: string;
  nome: string;
  especialidade: string | null;
  telefone: string | null;
  email: string | null;
  tipo_repasse: string;
  valor_repasse: number;
  observacoes: string | null;
  ativo: boolean;
}

const fromRow = (r: ParceiroRow): Parceiro => ({
  id: r.id,
  nome: r.nome,
  especialidade: r.especialidade,
  telefone: r.telefone,
  email: r.email,
  tipoRepasse: (r.tipo_repasse === 'fixo' ? 'fixo' : 'percentual') as TipoRepasse,
  valorRepasse: Number(r.valor_repasse || 0),
  observacoes: r.observacoes,
  ativo: r.ativo,
});

export const useParceiros = () => {
  const { user, clinicaId } = useAuth();
  const { toast } = useToast();
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchParceiros = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('parceiros')
      .select('*')
      .eq('user_id', clinicaId)
      .order('nome');
    if (error) {
      toast({ title: 'Erro ao carregar parceiros', description: error.message, variant: 'destructive' });
    } else {
      setParceiros(((data || []) as ParceiroRow[]).map(fromRow));
    }
    setLoading(false);
  }, [clinicaId, toast]);

  useEffect(() => {
    fetchParceiros();
  }, [fetchParceiros]);

  const addParceiro = async (p: Omit<Parceiro, 'id'>) => {
    try {
      if (!clinicaId) {
        alert('Erro Parceiro: clinicaId não encontrado');
        return;
      }
      const { error } = await supabase.from('parceiros').insert({
        user_id: clinicaId,
        nome: p.nome,
        especialidade: p.especialidade || null,
        telefone: p.telefone || null,
        email: p.email || null,
        tipo_repasse: p.tipoRepasse,
        valor_repasse: p.valorRepasse || 0,
        observacoes: p.observacoes || null,
        ativo: p.ativo ?? true,
      });
      if (error) {
        alert('Erro Parceiro DB: ' + error.message);
        toast({ title: 'Erro ao adicionar parceiro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Parceiro adicionado!' });
      await fetchParceiros();
    } catch (err: any) {
      alert('Exception Parceiro: ' + err.message);
    }
  };

  const updateParceiro = async (id: string, patch: Partial<Parceiro>) => {
    const row: Partial<ParceiroRow> & { user_id?: string } = {};
    if (patch.nome !== undefined) row.nome = patch.nome;
    if (patch.especialidade !== undefined) row.especialidade = patch.especialidade || null;
    if (patch.telefone !== undefined) row.telefone = patch.telefone || null;
    if (patch.email !== undefined) row.email = patch.email || null;
    if (patch.tipoRepasse !== undefined) row.tipo_repasse = patch.tipoRepasse;
    if (patch.valorRepasse !== undefined) row.valor_repasse = patch.valorRepasse;
    if (patch.observacoes !== undefined) row.observacoes = patch.observacoes || null;
    if (patch.ativo !== undefined) row.ativo = patch.ativo;

    const { error } = await supabase.from('parceiros').update(row).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar parceiro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Parceiro atualizado' });
    await fetchParceiros();
  };

  const deleteParceiro = async (id: string) => {
    const { error } = await supabase.from('parceiros').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir parceiro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Parceiro removido' });
    await fetchParceiros();
  };

  return { parceiros, loading, addParceiro, updateParceiro, deleteParceiro, refetch: fetchParceiros };
};

