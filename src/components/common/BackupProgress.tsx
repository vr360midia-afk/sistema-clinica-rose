import React from 'react';
import { Progress } from '@/components/ui/progress';
import type { ProgressoBackup } from '@/utils/backup';

interface BackupProgressProps {
  progresso: ProgressoBackup | null;
  titulo?: string;
}

/** Barra de progresso com percentual para backup/restauração */
const BackupProgress: React.FC<BackupProgressProps> = ({ progresso, titulo }) => {
  if (!progresso) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-muted-foreground">
          {titulo ? `${titulo} — ` : ''}{progresso.etapa}
        </span>
        <span className="font-semibold tabular-nums">{progresso.percentual}%</span>
      </div>
      <Progress value={progresso.percentual} className="h-2" />
    </div>
  );
};

export default BackupProgress;
