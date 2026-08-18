
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';

interface PatientDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  patientName: string;
  isArchived?: boolean;
}

const PatientDeleteModal = ({ isOpen, onClose, onConfirm, patientName, isArchived = false }: PatientDeleteModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            {isArchived ? 'Excluir Permanentemente' : 'Excluir Paciente'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">
                {isArchived ? 'Ação irreversível!' : 'Atenção!'}
              </p>
              <p className="text-sm text-red-600">
                {isArchived 
                  ? 'Esta ação não pode ser desfeita. Todos os dados serão perdidos permanentemente.'
                  : 'Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.'
                }
              </p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Paciente: <strong>{patientName}</strong>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            className="bg-red-600 hover:bg-red-700"
          >
            {isArchived ? 'Excluir Permanentemente' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PatientDeleteModal;
