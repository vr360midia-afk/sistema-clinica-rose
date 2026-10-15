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
  dentista?: string,
  pacienteNome?: string
): BloqueioAgenda | null => {
  const dia = toISODate(data);
  const inicio = toMin(hora) ?? 0;
  const fim = inicio + duracao;
  const nomeNorm = pacienteNome ? pacienteNome.trim().toLowerCase() : '';

  return (
    bloqueios.find((b) => {
      if (dia < b.dataInicio || dia > b.dataFim) return false;
      if (b.dentista && dentista && b.dentista !== dentista) return false;

      // Se o bloqueio pertence a este mesmo paciente, permite editar e prolongar o agendamento!
      if (nomeNorm && b.titulo) {
        const tit = b.titulo.toLowerCase();
        const primeiroNome = nomeNorm.split(' ')[0];
        if (tit.includes(nomeNorm) || (primeiroNome.length > 2 && tit.includes(primeiroNome))) {
          return false;
        }
      }

      if (b.diaInteiro) return true;
      const bi = toMin(b.horaInicio) ?? 0;
      const bf = toMin(b.horaFim) ?? 24 * 60;
      return inicio < bf && fim > bi;
    }) || null
  );
};

export const useBloqueios = () => {
  const { user, clinicaId } = useAuth();
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
    if (!user) return false;
    const targetUserId = clinicaId || user.id;
    const { error } = await supabase.from('bloqueios_agenda').insert({
      user_id: targetUserId,
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
      toast.error('Erro ao criar bloqueio: ' + error.message);
      return false;
    }
    toast.success('Horário bloqueado com sucesso');
    await load();
    return true;
  };

  const updateBloqueio = async (id: string, b: Partial<Omit<BloqueioAgenda, 'id'>>) => {
    if (!user) return false;
    const payload: any = {};
    if (b.titulo !== undefined) payload.titulo = b.titulo;
    if (b.dentista !== undefined) payload.dentista = b.dentista || null;
    if (b.dataInicio !== undefined) payload.data_inicio = b.dataInicio;
    if (b.dataFim !== undefined) payload.data_fim = b.dataFim || b.dataInicio;
    if (b.diaInteiro !== undefined) {
      payload.dia_inteiro = b.diaInteiro;
      if (b.diaInteiro) {
        payload.hora_inicio = null;
        payload.hora_fim = null;
      }
    }
    if (!b.diaInteiro) {
      if (b.horaInicio !== undefined) payload.hora_inicio = b.horaInicio || null;
      if (b.horaFim !== undefined) payload.hora_fim = b.horaFim || null;
    }
    if (b.observacoes !== undefined) payload.observacoes = b.observacoes || null;

    const { error } = await supabase.from('bloqueios_agenda').update(payload).eq('id', id);
    if (error) {
      console.error(error);
      toast.error('Erro ao atualizar bloqueio: ' + error.message);
      return false;
    }
    toast.success('Bloqueio atualizado com sucesso');
    await load();
    return true;
  };

  const deleteBloqueio = async (id: string) => {
    const { error } = await supabase.from('bloqueios_agenda').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover bloqueio');
      return false;
    }
    toast.success('Bloqueio removido com sucesso');
    await load();
    return true;
  };

  return { bloqueios, loading, addBloqueio, updateBloqueio, deleteBloqueio, reload: load };
};

