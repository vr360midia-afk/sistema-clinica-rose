import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRoles, AppRole } from '@/hooks/useUserRoles';

interface RoleRouteProps {
  children: React.ReactNode;
  allow: AppRole[];
}

/**
 * Restringe uma rota a determinados perfis.
 * Contas sem nenhum perfil atribuído mantêm acesso total (evita bloqueio acidental).
 */
const RoleRoute = ({ children, allow }: RoleRouteProps) => {
  const { roles, loading } = useUserRoles();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  const semPerfil = roles.length === 0;
  const permitido = semPerfil || roles.includes('admin') || allow.some((r) => roles.includes(r));

  if (!permitido) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default RoleRoute;
