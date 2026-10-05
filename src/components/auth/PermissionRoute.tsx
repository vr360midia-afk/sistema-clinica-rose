import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissoes, UserPermissions } from '@/hooks/usePermissoes';

interface PermissionRouteProps {
  children: React.ReactNode;
  modulo: keyof UserPermissions;
}

/**
 * Restringe uma rota baseada nas permissões configuradas na equipe.
 */
const PermissionRoute = ({ children, modulo }: PermissionRouteProps) => {
  const { permissoes, loading } = usePermissoes();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Carregando permissões...</div>
      </div>
    );
  }

  // Se tem a permissão, permite o acesso
  if (permissoes[modulo]) {
    return <>{children}</>;
  }

  // Se não tem permissão, redireciona pro dashboard
  return <Navigate to="/" replace />;
};

export default PermissionRoute;
