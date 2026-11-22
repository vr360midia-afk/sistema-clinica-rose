import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { MessageSquare, Pencil, Plus } from 'lucide-react';

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
  anotacaoEmEdicao?: AnotacaoItem | null;
}

export const ModalAnotacao: React.FC<ModalAnotacaoProps> = ({
  isOpen,
  onClose,
  onSave,
  anotacaoEmEdicao,
}) => {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (anotacaoEmEdicao) {
      setTexto(anotacaoEmEdicao.texto || '');
    } else {
      setTexto('');
    }
  }, [anotacaoEmEdicao, isOpen]);

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;

    const autorNome = user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Profissional';
    const itemSalvo: AnotacaoItem = {
      id: anotacaoEmEdicao?.id || `note_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      texto: texto.trim(),
      data: anotacaoEmEdicao?.data || new Date().toISOString(),
      autor: anotacaoEmEdicao?.autor || autorNome,
    };

    onSave(itemSalvo);
    setTexto('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm sm:max-w-md p-5 rounded-2xl">
        <DialogHeader className="pb-1 text-left">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span>{anotacaoEmEdicao ? 'Editar Anotação' : 'Adicionar Anotação na Ficha Geral'}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Anotação Clínica / Observação Geral *
            </Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Digite aqui anotações clínicas, queixas principais, orientações de higiene, preferências do paciente ou evolução..."
              className="text-xs sm:text-sm min-h-[130px] rounded-lg border-purple-500/40 focus:border-purple-600 focus:ring-purple-500 leading-relaxed"
              required
              autoFocus
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
              className="h-9 px-5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-2xs gap-1.5"
            >
              {anotacaoEmEdicao ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Atualizar Anotação
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Salvar Anotação
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ModalAnotacao;