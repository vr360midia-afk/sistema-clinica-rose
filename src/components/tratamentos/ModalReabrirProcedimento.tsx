import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw, AlertTriangle, History } from 'lucide-react';
import { ProcedimentoTratamento } from '@/types/tratamento';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  procedimento: ProcedimentoTratamento | null;
  onReabrir: (procedimentoId: string, justificativa: string) => Promise<any>;
}

export const ModalReabrirProcedimento: React.FC<Props> = ({
  isOpen,
  onClose,
  procedimento,
  onReabrir,
}) => {
  const [justificativa, setJustificativa] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!procedimento) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificativa.trim() || justificativa.trim().length < 5) {
      toast.error('Informe a justificativa detalhada para reabertura do procedimento.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onReabrir(procedimento.id, justificativa.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            Reabertura de Procedimento Concluído
          </DialogTitle>
          <DialogDescription>
            {procedimento.procedimento_nome}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
              <History className="h-4 w-4" />
              Preservação Histórica do Termo Anterior
            </div>
            <p className="text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
              O termo de conclusão emitido anteriormente <strong>não será apagado</strong>. O procedimento retornará ao status <em>"Em tratamento"</em> permitindo incluir novas sessões complementares ou ajustes.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="justif-reabertura">Justificativa da Reabertura *</Label>
            <Textarea
              id="justif-reabertura"
              rows={3}
              placeholder="Ex: Paciente relatou leve incômodo oclusal após 20 dias, necessária sessão complementar para ajuste fino..."
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isSubmitting ? 'Reabrindo...' : 'Confirmar Reabertura'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
