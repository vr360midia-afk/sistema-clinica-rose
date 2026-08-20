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
import { verificarSenhaMestre, getSenhaMestreHash } from '@/lib/senhaMestre';
import { toast } from 'sonner';

interface SecurityContextType {
  /** Abre o modal da senha mestre. Retorna true se autorizado. */
  requireMasterPassword: (descricao?: string) => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurityGate = () => {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurityGate deve ser usado dentro de SecurityProvider');
  return ctx;
};

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState<string>('');
  const [senha, setSenha] = useState('');
  const [verificando, setVerificando] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setSenha('');
    setOpen(false);
  };

  const requireMasterPassword = useCallback(async (desc?: string) => {
    const hash = await getSenhaMestreHash();
    if (!hash) {
      // Nenhuma senha mestre definida: libera, mas avisa o administrador.
      toast.warning('Defina a senha mestre em Administração para proteger exclusões.');
      return true;
    }
    setDescricao(desc || '');
    setSenha('');
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const confirmar = async () => {
    setVerificando(true);
    try {
      const ok = await verificarSenhaMestre(senha);
      if (!ok) {
        toast.error('Senha mestre incorreta.');
        return;
      }
      finish(true);
    } finally {
      setVerificando(false);
    }
  };

  return (
    <SecurityContext.Provider value={{ requireMasterPassword }}>
      {children}
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) finish(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Senha mestre necessária</AlertDialogTitle>
            <AlertDialogDescription>
              {descricao || 'Confirme a senha mestre para concluir a exclusão.'} O item ficará na Lixeira por 30 dias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="senha-mestre">Senha mestre</Label>
            <Input
              id="senha-mestre"
              type="password"
              autoFocus
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && senha) confirmar(); }}
            />
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => finish(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={!senha || verificando}>
              {verificando ? 'Verificando...' : 'Confirmar exclusão'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SecurityContext.Provider>
  );
};
