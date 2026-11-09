import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Award, FileText, ShieldCheck } from 'lucide-react';
import { ProcedimentoTratamento } from '@/types/tratamento';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  procedimento: ProcedimentoTratamento | null;
  onConcluir: (procedimentoId: string, observacoes?: string) => Promise<any>;
}

export const ModalConcluirProcedimento: React.FC<Props> = ({
  isOpen,
  onClose,
  procedimento,
  onConcluir,
}) => {
  const [observacoes, setObservacoes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!procedimento) return null;

  const totalSessoes = procedimento.sessoes?.length || 0;
  const sessoesRealizadas = (procedimento.sessoes || []).filter(
    s => s.status === 'realizada' || s.status === 'confirmada'
  ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConcluir(procedimento.id, observacoes.trim() || undefined);
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
            <Award className="h-5 w-5 text-purple-600" />
            Concluir Procedimento Clínico
          </DialogTitle>
          <DialogDescription>
            {procedimento.procedimento_nome}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-lg text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-purple-900 dark:text-purple-300">
              <ShieldCheck className="h-4 w-4" />
              Emissão do Termo de Conclusão do Tratamento
            </div>
            <p className="text-purple-800/90 dark:text-purple-300/80 leading-relaxed">
              Ao concluir o procedimento, o sistema consolidará as <strong>{sessoesRealizadas} de {totalSessoes}</strong> sessões realizadas e gerará o documento clínico oficial de conclusão.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-conclusao">Observações Finais do Caso Clínico (Opcional)</Label>
            <Textarea
              id="obs-conclusao"
              rows={3}
              placeholder="Ex: Resultado estético e funcional excelente, alta clínica concedida, retorno em 6 meses para manutenção..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isSubmitting ? 'Concluindo...' : 'Emitir Termo e Concluir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

