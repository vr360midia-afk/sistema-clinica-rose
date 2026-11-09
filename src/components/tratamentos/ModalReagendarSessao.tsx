import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, RotateCcw, AlertTriangle } from 'lucide-react';
import { SessaoTratamento } from '@/types/tratamento';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessao: SessaoTratamento | null;
  onConfirmar: (sessaoId: string, novaData: string, motivo: string) => Promise<void>;
}

export const ModalReagendarSessao: React.FC<Props> = ({
  isOpen,
  onClose,
  sessao,
  onConfirmar,
}) => {
  const [novaData, setNovaData] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!sessao) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaData) {
      toast.error('Informe a nova data prevista.');
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 3) {
      toast.error('Informe o motivo do reagendamento para o histórico de auditoria.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmar(sessao.id, novaData, motivo.trim());
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
            <RotateCcw className="h-5 w-5 text-blue-600" />
            Reagendar Sessão {sessao.numero_sessao}
          </DialogTitle>
          <DialogDescription>
            {sessao.nome_objetivo}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-muted/60 rounded-lg border border-border text-xs space-y-1">
            <div className="text-muted-foreground">Data Anterior:</div>
            <div className="font-semibold text-foreground">
              📅 {sessao.data_prevista ? new Date(sessao.data_prevista + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informada'}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nova-data">Nova Data Prevista *</Label>
            <Input
              id="nova-data"
              type="date"
              value={novaData}
              onChange={e => setNovaData(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-reag">Motivo do Reagendamento *</Label>
            <Textarea
              id="motivo-reag"
              rows={3}
              placeholder="Ex: Paciente solicitou adiamento por motivo de viagem profissional..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Este motivo ficará registrado na trilha de auditoria e na ficha clínica do paciente.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? 'Salvando...' : 'Confirmar Reagendamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

