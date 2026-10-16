import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'dentista' | 'recepcao';

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  dentista: 'Dentista',
  recepcao: 'Recepção',
};

// Cache em memória compartilhado para perfis
let cachedRoles: { targetId: string; roles: AppRole[] } | null = null;

const getInitialRoles = (targetId?: string): { roles: AppRole[]; hasCache: boolean } => {
  if (!targetId) return { roles: [], hasCache: false };
  if (cachedRoles && cachedRoles.targetId === targetId) {
    return { roles: cachedRoles.roles, hasCache: true };
  }
  try {
    const raw = sessionStorage.getItem(`dental_roles_${targetId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedRoles = { targetId, roles: parsed };
        return { roles: parsed, hasCache: true };
      }
    }
  } catch (_) {}
  return { roles: [], hasCache: false };
};

export const useUserRoles = () => {
  const { user, clinicaId } = useAuth();
  const targetId = clinicaId || user?.id || '';

  const initial = getInitialRoles(targetId);
  const [roles, setRoles] = useState<AppRole[]>(initial.roles);
  const [loading, setLoading] = useState(!initial.hasCache && Boolean(targetId));

  const load = useCallback(async () => {
    if (!targetId) {
      setRoles([]);
      setLoading(false);
      return;
    }
    // Se não temos cache, mostra o loading inicial; se temos cache, atualiza silenciosamente em segundo plano
    const hasCache = Boolean(cachedRoles && cachedRoles.targetId === targetId);
    if (!hasCache) {
      setLoading(true);
    }
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', targetId);
    if (error) console.error('Erro ao carregar perfis:', error);
    const parsedRoles = ((data || []).map((r: any) => r.role) as AppRole[]) || [];
    cachedRoles = { targetId, roles: parsedRoles };
    try {
      sessionStorage.setItem(`dental_roles_${targetId}`, JSON.stringify(parsedRoles));
    } catch (_) {}
    setRoles(parsedRoles);
    setLoading(false);
  }, [targetId]);

  useEffect(() => {
    load();
  }, [load]);

  const addRole = useCallback(
    async (role: AppRole) => {
      if (!user) return;
      const { error } = await supabase.from('user_roles').insert({ user_id: clinicaId, role });
      if (error) {
        console.error(error);
        toast.error('Não foi possível atribuir o perfil (apenas administradores podem).');
        return;
      }
      toast.success(`Perfil ${ROLE_LABELS[role]} atribuído`);
      load();
    },
    [user, load]
  );

  const removeRole = useCallback(
    async (role: AppRole) => {
      if (!user) return;
      const { error } = await supabase.from('user_roles').delete().eq('user_id', clinicaId).eq('role', role);
      if (error) {
        console.error(error);
        toast.error('Não foi possível remover o perfil.');
        return;
      }
      toast.success('Perfil removido');
      load();
    },
    [user, load]
  );

  const isAdmin = roles.includes('admin');
  const hasRole = (role: AppRole) => roles.includes(role);

  return { roles, loading, isAdmin, hasRole, addRole, removeRole, reload: load };
};

