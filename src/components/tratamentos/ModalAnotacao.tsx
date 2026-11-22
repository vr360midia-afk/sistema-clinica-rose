import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

export interface AnotacaoItem {
  id: string;
  texto: string;
  data: string;
  autor: string;
}

interface ModalAnotacaoProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (anotacao: AnotacaoItem) => void;
}

export const ModalAnotacao: React.FC<ModalAnotacaoProps> = ({ isOpen, onClose, onSave }) => {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;

    const autorNome = user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Profissional';
    const novaAnotacao: AnotacaoItem = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      texto: texto.trim(),
      data: new Date().toISOString(),
      autor: autorNome,
    };

    onSave(novaAnotacao);
    setTexto('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm sm:max-w-md p-5 rounded-2xl">
        <DialogHeader className="pb-1 text-left">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
            Adicionar Anotação Clínica
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Anotação do Paciente *
            </Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Digite aqui anotações clínicas, queixas, observações de evolução ou lembretes do paciente..."
              className="text-xs sm:text-sm min-h-[120px] rounded-lg border-purple-500/40 focus:border-purple-600 focus:ring-purple-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold border-purple-600 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-9 px-5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-2xs"
            >
              Salvar Anotação
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ModalAnotacao;
