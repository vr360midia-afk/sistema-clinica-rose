import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { useUserRoles, ROLE_LABELS, AppRole } from '@/hooks/useUserRoles';
import { useAuth } from '@/context/AuthContext';

const ALL_ROLES: AppRole[] = ['admin', 'dentista', 'recepcao'];

const RolesManager = () => {
  const { user } = useAuth();
  const { roles, loading, addRole, removeRole } = useUserRoles();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Perfis de acesso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Perfis da conta <span className="font-medium">{user?.email}</span>. Os perfis são
          validados no servidor e só administradores podem alterá-los.
        </p>

        <div className="flex flex-wrap gap-2">
          {loading ? (
            <span className="text-sm text-muted-foreground">Carregando...</span>
          ) : roles.length === 0 ? (
            <Badge variant="outline">Nenhum perfil atribuído</Badge>
          ) : (
            roles.map((r) => (
              <Badge key={r} variant="secondary">
                {ROLE_LABELS[r]}
              </Badge>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((r) => {
            const has = roles.includes(r);
            return (
              <Button
                key={r}
                size="sm"
                variant={has ? 'outline' : 'default'}
                onClick={() => (has ? removeRole(r) : addRole(r))}
              >
                {has ? `Remover ${ROLE_LABELS[r]}` : `Atribuir ${ROLE_LABELS[r]}`}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default RolesManager;
