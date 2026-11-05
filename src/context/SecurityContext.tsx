import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Lock } from 'lucide-react';
import { verificarAutenticacaoAdministrativa } from '@/lib/senhaMestre';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface SecurityContextType {
  /** Abre o modal de autenticação administrativa. Retorna true se autorizado ou executa o callback fornecido. */
  requireMasterPassword: (
    descricaoOuCallback?: string | (() => Promise<void> | void),
    callbackOpcional?: () => Promise<void> | void
  ) => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurityGate = () => {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurityGate deve ser usado dentro de SecurityProvider');
  return ctx;
};

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { roles, loading: loadingRoles } = useUserRoles();
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState<string>('');
  const [senha, setSenha] = useState('');
  const [verificando, setVerificando] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const callbackRef = useRef<(() => Promise<void> | void) | null>(null);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    callbackRef.current = null;
    setSenha('');
    setOpen(false);
  };

  const requireMasterPassword = useCallback(
    async (
      descricaoOuCallback?: string | (() => Promise<void> | void),
      callbackOpcional?: () => Promise<void> | void
    ): Promise<boolean> => {
      // 1. Verificação de autenticação de sessão
      if (!user) {
        toast.error('Você precisa estar autenticado para realizar esta operação administrativa.');
        return false;
      }

      // 2. Verificação de permissões do perfil
      const isAdmin = roles.includes('admin') || roles.length === 0;
      if (!isAdmin && !loadingRoles) {
        toast.error('Ação restrita a administradores da clínica. Operação não autorizada.');
        return false;
      }

      let descStr = '';
      let cb: (() => Promise<void> | void) | null = null;

      if (typeof descricaoOuCallback === 'function') {
        cb = descricaoOuCallback;
      } else if (typeof descricaoOuCallback === 'string') {
        descStr = descricaoOuCallback;
        if (typeof callbackOpcional === 'function') {
          cb = callbackOpcional;
        }
      }

      callbackRef.current = cb;
      setDescricao(descStr);
      setSenha('');
      setOpen(true);

      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    [user, roles, loadingRoles]
  );

  const confirmar = async () => {
    if (!senha.trim()) {
      toast.error('Informe sua senha administrativa.');
      return;
    }

    setVerificando(true);
    try {
      const res = await verificarAutenticacaoAdministrativa(senha);
      if (!res.autorizado) {
        toast.error(res.motivo || 'Senha administrativa incorreta.');
        return;
      }

      toast.success('Autorização administrativa confirmada com sucesso.');
      const cb = callbackRef.current;
      finish(true);

      if (cb) {
        try {
          await cb();
        } catch (err: any) {
          console.error('[SecurityGate] Erro ao executar ação autorizada:', err);
          toast.error(`Falha ao executar ação: ${err?.message || 'Erro desconhecido'}`);
        }
      }
    } finally {
      setVerificando(false);
    }
  };

  return (
    <SecurityContext.Provider value={{ requireMasterPassword }}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (!v) finish(false);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-base font-bold">Autorização Administrativa Necessária</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
              {descricao || 'Confirme sua senha de acesso administrativo para concluir esta operação com registro de auditoria.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="senha-admin" className="text-xs font-semibold flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Senha Administrativa
              </Label>
              <Input
                id="senha-admin"
                type="password"
                autoFocus
                placeholder="Informe sua senha..."
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && senha && !verificando) confirmar();
                }}
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                A validação é autenticada com segurança no servidor e registrada na trilha de auditoria.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <Button variant="outline" size="sm" onClick={() => finish(false)} disabled={verificando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={confirmar} disabled={!senha.trim() || verificando} className="gap-1.5">
              {verificando ? (
                'Autenticando...'
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Confirmar Autorização
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SecurityContext.Provider>
  );
};
