import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AgendarRetornoCard } from './AgendarRetornoCard';
import { RotateCcw } from 'lucide-react';

interface ModalAgendarRetornoProps {
  isOpen: boolean;
  onClose: () => void;
  patient: any;
  onOpenFullModal?: () => void;
}

export const ModalAgendarRetorno = ({
  isOpen,
  onClose,
  patient,
  onOpenFullModal
}: ModalAgendarRetornoProps) => {
  if (!patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] p-0 overflow-hidden border-border bg-card">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <RotateCcw className="h-5 w-5 text-blue-600" />
            Agendar Retorno de Paciente
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 pt-2">
          <AgendarRetornoCard
            patient={patient}
            onOpenFullModal={() => {
              onClose();
              onOpenFullModal?.();
            }}
            onSuccess={onClose}
            compact
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalAgendarRetorno;
