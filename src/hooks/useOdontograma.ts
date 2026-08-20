import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ToothStatusMap = Record<string, string>;

export interface OdontogramaVersao {
  id: string;
  pacienteId: string;
  dados: ToothStatusMap;
  observacoes?: string | null;
  criadoEm: Date;
}

const rowToVersao = (row: any): OdontogramaVersao => ({
  id: row.id,
  pacienteId: row.paciente_id,
  dados: (row.dados || {}) as ToothStatusMap,
  observacoes: row.observacoes,
  criadoEm: new Date(row.criado_em),
});

export const useOdontograma = (pacienteId?: string) => {
  const [dados, setDados] = useState<ToothStatusMap>({});
  const [versoes, setVersoes] = useState<OdontogramaVersao[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const carregarVersoes = useCallback(async () => {
    if (!pacienteId) {
      setVersoes([]);
      return;
    }
    const { data, error } = await supabase
      .from('odontograma_versoes')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('Erro ao carregar histórico do odontograma:', error);
      return;
    }
    setVersoes((data || []).map(rowToVersao));
  }, [pacienteId]);

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
    carregarVersoes();
    return () => {
      ativo = false;
    };
  }, [pacienteId, carregarVersoes]);

  const salvar = useCallback(
    async (novosDados: ToothStatusMap, observacoes?: string) => {
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

        // Arquiva uma versão para comparativo antes/depois
        const { error: versaoError } = await supabase.from('odontograma_versoes').insert({
          user_id: userId,
          paciente_id: pacienteId,
          dados: novosDados as never,
          observacoes: observacoes || null,
        });
        if (versaoError) console.error('Erro ao arquivar versão:', versaoError);

        await carregarVersoes();
        toast.success('Odontograma salvo');
      } catch (e: any) {
        console.error(e);
        toast.error('Não foi possível salvar o odontograma');
      } finally {
        setSaving(false);
      }
    },
    [pacienteId, carregarVersoes]
  );

  return { dados, setDados, versoes, loading, saving, salvar, recarregarVersoes: carregarVersoes };
};
