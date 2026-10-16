import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface UserPermissions {
  pacientes: boolean;
  agenda: boolean;
  financeiro: boolean;
  prontuarios: boolean;
  estoque: boolean;
  configuracoes: boolean;
}

const defaultPermissions: UserPermissions = {
  pacientes: true,
  agenda: true,
  financeiro: true,
  prontuarios: true,
  estoque: true,
  configuracoes: true,
};

// Cache em memória compartilhado entre todas as rotas e componentes
let cachedPermissions: { userId: string; permissoes: UserPermissions; isOwner: boolean } | null = null;

const getInitialPermissions = (userId?: string): { permissoes: UserPermissions; isOwner: boolean; hasCache: boolean } => {
  if (!userId) {
    return { permissoes: defaultPermissions, isOwner: true, hasCache: false };
  }
  if (cachedPermissions && cachedPermissions.userId === userId) {
    return { permissoes: cachedPermissions.permissoes, isOwner: cachedPermissions.isOwner, hasCache: true };
  }
  try {
    const raw = sessionStorage.getItem(`dental_perms_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.permissoes) {
        cachedPermissions = { userId, permissoes: parsed.permissoes, isOwner: Boolean(parsed.isOwner) };
        return { permissoes: parsed.permissoes, isOwner: Boolean(parsed.isOwner), hasCache: true };
      }
    }
  } catch (_) {}
  return { permissoes: defaultPermissions, isOwner: true, hasCache: false };
};

export const usePermissoes = () => {
  const { user } = useAuth();
  const userId = user?.id;

  const initial = getInitialPermissions(userId);
  const [permissoes, setPermissoes] = useState<UserPermissions>(initial.permissoes);
  const [isOwner, setIsOwner] = useState(initial.isOwner);
  // Se já temos permissões carregadas (em memória ou sessionStorage), NÃO trava a rota com loading = true
  const [loading, setLoading] = useState(!initial.hasCache);

  useEffect(() => {
    if (!userId) {
      setPermissoes(defaultPermissions);
      setLoading(false);
      return;
    }

    // Se já temos cache para este usuário, faz a atualização em segundo plano SEM desmontar as telas
    const hasCache = Boolean(cachedPermissions && cachedPermissions.userId === userId);
    if (!hasCache) {
      setLoading(true);
    }

    let isMounted = true;

    const loadPermissions = async () => {
      try {
        // Verifica se o usuário atual é funcionário de alguma clínica
        const { data, error } = await supabase
          .from('equipe')
          .select('permissoes, clinica_id')
          .eq('usuario_id', userId)
          .maybeSingle();

        if (error) {
          console.error('Erro ao carregar permissões:', error);
          return;
        }

        if (!isMounted) return;

        let finalPerms = defaultPermissions;
        let finalIsOwner = true;

        if (data) {
          // É um funcionário
          finalIsOwner = false;
          finalPerms = {
            ...defaultPermissions,
            ...((data.permissoes as unknown) as Partial<UserPermissions>)
          };
        } else {
          // É o dono da clínica
          finalIsOwner = true;
          finalPerms = defaultPermissions;
        }

        cachedPermissions = { userId, permissoes: finalPerms, isOwner: finalIsOwner };
        try {
          sessionStorage.setItem(`dental_perms_${userId}`, JSON.stringify({ permissoes: finalPerms, isOwner: finalIsOwner }));
        } catch (_) {}

        setIsOwner(finalIsOwner);
        setPermissoes(finalPerms);
      } catch (err) {
        console.error('Exceção ao carregar permissões:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return { permissoes, loading, isOwner };
};

