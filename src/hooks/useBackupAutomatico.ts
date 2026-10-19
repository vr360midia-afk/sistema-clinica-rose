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

/**
 * Detecta se o dispositivo atual é móvel (smartphone, tablet, etc.).
 * O download automático de arquivos de backup é desabilitado em celulares e tablets
 * para evitar downloads indesejados e consumo de dados móveis no celular do usuário.
 */
export const isDispositivoMovel = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // 1. Verificação por User Agent (smartphones e tablets Android, iPhone, iPad, etc.)
  const ua = navigator.userAgent || (navigator as any).vendor || (window as any).opera || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }

  // 2. iPads modernos que reportam plataforma MacIntel mas possuem múltiplos pontos de toque
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true;
  }

  // 3. Verificação por largura de tela/viewport típica de dispositivos móveis (< 1024px)
  const largura = Math.min(
    window.innerWidth || Infinity,
    window.screen?.width || Infinity
  );
  if (largura < 1024) {
    return true;
  }

  // 4. Verificação por mídia de ponteiro touch em telas menores
  if (window.matchMedia && window.matchMedia('(pointer: coarse) and (max-width: 1024px)').matches) {
    return true;
  }

  return false;
};

export const isComputadorDesktop = (): boolean => {
  return !isDispositivoMovel();
};

/** Executa o backup automático (download do JSON) conforme a frequência configurada exclusivamente em computadores/desktops */
export const useBackupAutomatico = () => {
  const { user, clinicaId } = useAuth();
  const { configuracoes, loading } = useConfiguracoes();
  const executado = useRef(false);

  useEffect(() => {
    // 1. Bloqueia a execução automática em qualquer dispositivo móvel (celular ou tablet)
    if (isDispositivoMovel()) {
      return;
    }

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
        toast.success(`Backup automático gerado no computador (${total} registros)`);
      } catch (e) {
        console.error('Erro no backup automático:', e);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [clinicaId, loading, configuracoes.backupAutomatico, configuracoes.frequenciaBackup]);
};
