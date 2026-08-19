import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ToothStatusMap = Record<string, string>;

export const useOdontograma = (pacienteId?: string) => {
  const [dados, setDados] = useState<ToothStatusMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ativo = true;
    const load = async () => {
      if (!pacienteId) {
        setDados({});
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('odontogramas')
        .select('dados')
        .eq('paciente_id', pacienteId)
        .maybeSingle();
      if (!ativo) return;
      if (error) console.error('Erro ao carregar odontograma:', error);
      setDados(((data?.dados as ToothStatusMap) || {}) as ToothStatusMap);
      setLoading(false);
    };
    load();
    return () => {
      ativo = false;
    };
  }, [pacienteId]);

  const salvar = useCallback(
    async (novosDados: ToothStatusMap) => {
      if (!pacienteId) return;
      setSaving(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error('Usuário não autenticado');

        const { error } = await supabase
          .from('odontogramas')
          .upsert(
            { user_id: userId, paciente_id: pacienteId, dados: novosDados },
            { onConflict: 'user_id,paciente_id' }
          );
        if (error) throw error;
        toast.success('Odontograma salvo');
      } catch (e: any) {
        console.error(e);
        toast.error('Não foi possível salvar o odontograma');
      } finally {
        setSaving(false);
      }
    },
    [pacienteId]
  );

  return { dados, setDados, loading, saving, salvar };
};
