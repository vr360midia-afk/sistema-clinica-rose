import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ComandosWhatsappCard } from '@/components/configuracoes/ComandosWhatsappCard';
import { MessageSquare } from 'lucide-react';

interface ModalComandosWhatsappProps {
  isOpen: boolean;
  onClose: () => void;
  onPacienteCriado?: (pacienteId: string) => void;
}

export const ModalComandosWhatsapp: React.FC<ModalComandosWhatsappProps> = ({
  isOpen,
  onClose,
  onPacienteCriado,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-xs">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Criar Fichas de Paciente via WhatsApp
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Envie o comando no WhatsApp ou teste aqui mesmo para gerar a ficha e o link da anamnese digital.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="pt-2">
          <ComandosWhatsappCard
            compacto
            onPacienteCriado={(pacienteId) => {
              if (onPacienteCriado) {
                onPacienteCriado(pacienteId);
              }
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalComandosWhatsapp;
