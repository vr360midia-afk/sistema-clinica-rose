import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface AuditEntry {
  id: string;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  descricao?: string | null;
  atorEmail?: string | null;
  criadoEm: Date;
}

/** Registra uma ação no log de auditoria (não lança erro para não travar a UI) */
export const registrarAuditoria = async (params: {
  acao: string;
  entidade: string;
  entidadeId?: string;
  descricao?: string;
  dados?: Record<string, unknown>;
}) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    await supabase.from('audit_logs').insert({
      user_id: clinicaId,
      ator_email: user.email ?? null,
      acao: params.acao,
      entidade: params.entidade,
      entidade_id: params.entidadeId ?? null,
      descricao: params.descricao ?? null,
      dados: (params.dados ?? null) as never,
    });
  } catch (e) {
    console.warn('Falha ao registrar auditoria', e);
  }
};

export const useAuditLog = (limit = 100) => {
  const { user, clinicaId } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(limit);
    if (error) console.error('Erro ao carregar auditoria:', error);
    setEntries(
      (data || []).map((r: any) => ({
        id: r.id,
        acao: r.acao,
        entidade: r.entidade,
        entidadeId: r.entidade_id,
        descricao: r.descricao,
        atorEmail: r.ator_email,
        criadoEm: new Date(r.criado_em),
      }))
    );
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, reload: load };
};

