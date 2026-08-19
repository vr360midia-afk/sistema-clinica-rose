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

export const useUserRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    if (error) console.error('Erro ao carregar perfis:', error);
    setRoles(((data || []).map((r: any) => r.role) as AppRole[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const addRole = useCallback(
    async (role: AppRole) => {
      if (!user) return;
      const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role });
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
      const { error } = await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', role);
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
