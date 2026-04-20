import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Dentista {
  id: string;
  nome: string;
  cro?: string | null;
  especialidade?: string | null;
  telefone?: string | null;
  email?: string | null;
  ativo: boolean;
}

export const useDentistas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dentistas, setDentistas] = useState<Dentista[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDentistas = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('dentistas')
      .select('*')
      .eq('user_id', user.id)
      .order('nome');
    if (error) {
      toast({ title: 'Erro ao carregar dentistas', description: error.message, variant: 'destructive' });
    } else {
      setDentistas((data || []) as Dentista[]);
    }
    setLoading(false);
  }, [user?.id, toast]);

  useEffect(() => {
    fetchDentistas();
  }, [fetchDentistas]);

  const addDentista = async (d: Omit<Dentista, 'id' | 'ativo'> & { ativo?: boolean }) => {
    if (!user?.id) return;
    const { error } = await supabase.from('dentistas').insert({
      user_id: user.id,
      nome: d.nome,
      cro: d.cro || null,
      especialidade: d.especialidade || null,
      telefone: d.telefone || null,
      email: d.email || null,
      ativo: d.ativo ?? true,
    });
    if (error) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Dentista adicionado!' });
    await fetchDentistas();
  };

  const updateDentista = async (id: string, patch: Partial<Dentista>) => {
    const { error } = await supabase.from('dentistas').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchDentistas();
  };

  const deleteDentista = async (id: string) => {
    const { error } = await supabase.from('dentistas').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Dentista removido' });
    await fetchDentistas();
  };

  return { dentistas, loading, addDentista, updateDentista, deleteDentista, refetch: fetchDentistas };
};
