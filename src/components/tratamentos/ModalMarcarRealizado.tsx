import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface ModalMarcarRealizadoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (dataConclusao: string) => void;
  procedimentoNome?: string;
}

export const ModalMarcarRealizado: React.FC<ModalMarcarRealizadoProps> = ({
  isOpen,
  onClose,
  onConfirmar,
  procedimentoNome,
}) => {
  // Padrão: data de hoje no formato YYYY-MM-DD
  const hoje = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState<string>(hoje);

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmar(dataSelecionada || hoje);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm sm:max-w-md p-5 rounded-2xl">
        <DialogHeader className="pb-1 text-left">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
            Marcar como realizado
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-1">
          <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
            Selecione abaixo a data para marcar o procedimento{' '}
            {procedimentoNome ? <strong className="text-foreground">"{procedimentoNome}"</strong> : ''}{' '}
            como 'Realizado':
          </p>

          <div className="relative">
            <Input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="h-10 text-xs sm:text-sm pr-9 rounded-lg border-purple-500/40 focus:border-purple-600 focus:ring-purple-500"
              required
            />
            <CalendarIcon className="h-4 w-4 text-purple-600 dark:text-purple-400 absolute right-3 top-3 pointer-events-none" />
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
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ModalMarcarRealizado;
