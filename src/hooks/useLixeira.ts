import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface ItemLixeira {
  id: string;
  entidade: string;
  entidade_id: string | null;
  titulo: string | null;
  dados: Record<string, any>;
  excluido_por: string | null;
  excluido_em: string;
  expira_em: string;
}

export const ENTIDADE_LABELS: Record<string, string> = {
  pacientes: 'Paciente',
  consultas: 'Consulta',
  transacoes: 'Transação',
  prontuarios: 'Prontuário',
  anamneses: 'Anamnese',
  documentos_paciente: 'Documento',
  produtos: 'Produto',
  orcamentos: 'Orçamento',
  dentistas: 'Dentista',
};

export const useLixeira = () => {
  const { user, clinicaId } = useAuth();
  const [itens, setItens] = useState<ItemLixeira[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setItens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Purga automática dos itens com mais de 30 dias
    await (supabase as any)
      .from('lixeira')
      .delete()
      .eq('user_id', clinicaId)
      .lt('expira_em', new Date().toISOString());

    const { data, error } = await (supabase as any)
      .from('lixeira')
      .select('*')
      .eq('user_id', clinicaId)
      .order('excluido_em', { ascending: false });

    if (error) console.error('Erro ao carregar lixeira:', error);
    setItens((data || []) as ItemLixeira[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const restaurar = useCallback(async (item: ItemLixeira) => {
    const { error } = await (supabase as any).from(item.entidade).upsert(item.dados);
    if (error) {
      console.error(error);
      toast.error('Não foi possível restaurar este item.');
      return false;
    }
    await (supabase as any).from('lixeira').delete().eq('id', item.id);
    toast.success('Item restaurado com sucesso!');
    load();
    return true;
  }, [load]);

  const excluirDefinitivo = useCallback(async (item: ItemLixeira) => {
    const { error } = await (supabase as any).from('lixeira').delete().eq('id', item.id);
    if (error) {
      console.error(error);
      toast.error('Não foi possível excluir definitivamente.');
      return false;
    }
    toast.success('Item excluído definitivamente.');
    load();
    return true;
  }, [load]);

  const esvaziar = useCallback(async () => {
    if (!user) return;
    const { error } = await (supabase as any).from('lixeira').delete().eq('user_id', clinicaId);
    if (error) {
      console.error(error);
      toast.error('Não foi possível esvaziar a lixeira.');
      return;
    }
    toast.success('Lixeira esvaziada.');
    load();
  }, [user, load]);

  return { itens, loading, reload: load, restaurar, excluirDefinitivo, esvaziar };
};

export const diasRestantes = (expiraEm: string) => {
  const ms = new Date(expiraEm).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

