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

export const usePermissoes = () => {
  const { user, clinicaId } = useAuth();
  const [permissoes, setPermissoes] = useState<UserPermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissoes(defaultPermissions);
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        setLoading(true);
        // Verifica se o usuário atual é funcionário de alguma clínica
        const { data, error } = await supabase
          .from('equipe')
          .select('permissoes, clinica_id')
          .eq('usuario_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao carregar permissões:', error);
          return;
        }

        if (data) {
          // É um funcionário
          setIsOwner(false);
          // Fazer merge com defaultPermissions para garantir que todas as chaves existam
          setPermissoes({
            ...defaultPermissions,
            ...((data.permissoes as unknown) as Partial<UserPermissions>)
          });
        } else {
          // É o dono da clínica
          setIsOwner(true);
          setPermissoes(defaultPermissions);
        }
      } catch (err) {
        console.error('Exceção ao carregar permissões:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user]);

  return { permissoes, loading, isOwner };
};

