import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface BloqueioAgenda {
  id: string;
  titulo: string;
  dentista?: string | null;
  dataInicio: string; // yyyy-MM-dd
  dataFim: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  diaInteiro: boolean;
  observacoes?: string | null;
}

const rowToBloqueio = (row: any): BloqueioAgenda => ({
  id: row.id,
  titulo: row.titulo,
  dentista: row.dentista,
  dataInicio: row.data_inicio,
  dataFim: row.data_fim,
  horaInicio: row.hora_inicio,
  horaFim: row.hora_fim,
  diaInteiro: !!row.dia_inteiro,
  observacoes: row.observacoes,
});

export const toISODate = (d: Date | string): string => {
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toMin = (hhmm?: string | null) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Retorna o bloqueio que impede o agendamento, ou null */
export const encontrarBloqueio = (
  bloqueios: BloqueioAgenda[],
  data: Date | string,
  hora?: string,
  duracao = 60,
  dentista?: string
): BloqueioAgenda | null => {
  const dia = toISODate(data);
  const inicio = toMin(hora) ?? 0;
  const fim = inicio + duracao;

  return (
    bloqueios.find((b) => {
      if (dia < b.dataInicio || dia > b.dataFim) return false;
      if (b.dentista && dentista && b.dentista !== dentista) return false;
      if (b.diaInteiro) return true;
      const bi = toMin(b.horaInicio) ?? 0;
      const bf = toMin(b.horaFim) ?? 24 * 60;
      return inicio < bf && fim > bi;
    }) || null
  );
};

export const useBloqueios = () => {
  const { user } = useAuth();
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setBloqueios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('bloqueios_agenda')
      .select('*')
      .order('data_inicio', { ascending: true });
    if (error) console.error('Erro ao carregar bloqueios:', error);
    setBloqueios((data || []).map(rowToBloqueio));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const addBloqueio = async (b: Omit<BloqueioAgenda, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('bloqueios_agenda').insert({
      user_id: user.id,
      titulo: b.titulo,
      dentista: b.dentista || null,
      data_inicio: b.dataInicio,
      data_fim: b.dataFim || b.dataInicio,
      hora_inicio: b.diaInteiro ? null : b.horaInicio || null,
      hora_fim: b.diaInteiro ? null : b.horaFim || null,
      dia_inteiro: b.diaInteiro,
      observacoes: b.observacoes || null,
    });
    if (error) {
      console.error(error);
      toast.error('Erro ao criar bloqueio');
      return;
    }
    toast.success('Bloqueio criado');
    load();
  };

  const deleteBloqueio = async (id: string) => {
    const { error } = await supabase.from('bloqueios_agenda').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover bloqueio');
      return;
    }
    toast.success('Bloqueio removido');
    load();
  };

  return { bloqueios, loading, addBloqueio, deleteBloqueio, reload: load };
};
