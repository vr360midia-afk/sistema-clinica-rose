import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { downloadBackupCompleto } from '@/utils/backup';

const MARKER_PREFIX = 'dental-backup-ultimo';

const intervaloDias = (frequencia: string) => {
  if (frequencia === 'semanal') return 7;
  if (frequencia === 'mensal') return 30;
  return 1; // diário
};

export const ultimoBackupEm = (userId?: string): Date | null => {
  if (!userId) return null;
  const v = localStorage.getItem(`${MARKER_PREFIX}-${userId}`);
  return v ? new Date(v) : null;
};

export const marcarBackupFeito = (userId?: string) => {
  if (userId) localStorage.setItem(`${MARKER_PREFIX}-${userId}`, new Date().toISOString());
};

/** Executa o backup automático (download do JSON) conforme a frequência configurada */
export const useBackupAutomatico = () => {
  const { user } = useAuth();
  const { configuracoes, loading } = useConfiguracoes();
  const executado = useRef(false);

  useEffect(() => {
    if (!user?.id || loading || executado.current) return;
    if (!configuracoes.backupAutomatico) return;

    const ultimo = ultimoBackupEm(user.id);
    const dias = intervaloDias(configuracoes.frequenciaBackup);
    const precisa = !ultimo || (Date.now() - ultimo.getTime()) / 86400000 >= dias;
    if (!precisa) return;

    executado.current = true;
    const timer = setTimeout(async () => {
      try {
        const total = await downloadBackupCompleto();
        marcarBackupFeito(user.id);
        toast.success(`Backup automático gerado (${total} registros)`);
      } catch (e) {
        console.error('Erro no backup automático:', e);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [user?.id, loading, configuracoes.backupAutomatico, configuracoes.frequenciaBackup]);
};
