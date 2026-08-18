
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Archive } from 'lucide-react';

interface PatientArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  patientName: string;
}

const PatientArchiveModal = ({ isOpen, onClose, onConfirm, patientName }: PatientArchiveModalProps) => {
  const [motivo, setMotivo] = useState('');

  const handleConfirm = () => {
    onConfirm(motivo);
    setMotivo('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-yellow-600" />
            Arquivar Paciente
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja arquivar o paciente <strong>{patientName}</strong>?
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo do arquivamento (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Tratamento finalizado, mudança de cidade, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="bg-yellow-600 hover:bg-yellow-700">
            Arquivar Paciente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PatientArchiveModal;
