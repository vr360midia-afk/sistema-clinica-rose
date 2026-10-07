import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { toast } from 'sonner';

interface EditProcedimentoValorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any; // { id, nome, valor, origem, originalId, prontuarioId, index }
}

export const EditProcedimentoValorModal = ({ isOpen, onClose, item }: EditProcedimentoValorModalProps) => {
  const [valor, setValor] = useState('');
  const { updateConsulta, updateProntuario, prontuarios } = useDentalSystem();

  useEffect(() => {
    if (item) {
      setValor(item.valor ? String(item.valor) : '0');
    }
  }, [item]);

  const handleSave = async () => {
    try {
      const numValor = parseFloat(valor.replace(',', '.'));
      if (isNaN(numValor)) {
        toast.error('Valor inválido');
        return;
      }

      if (item.origem === 'Consulta') {
        await updateConsulta(item.originalId, { valor: numValor });
        toast.success('Valor atualizado com sucesso!');
      } else if (item.origem === 'Prontuário') {
        const pront = prontuarios.find(p => p.id === item.prontuarioId);
        if (pront && pront.procedimentosRealizados) {
          const newArray = [...pront.procedimentosRealizados];
          const existing = newArray[item.index];
          if (typeof existing === 'string') {
            newArray[item.index] = { nome: existing, valor: numValor };
          } else {
            newArray[item.index] = { ...existing, valor: numValor };
          }
          await updateProntuario(pront.id, { procedimentosRealizados: newArray });
          toast.success('Valor atualizado com sucesso!');
        }
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar o valor');
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Valor: {item.nome}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="valor">Novo Valor (R$)</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
