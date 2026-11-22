import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-full flex flex-col bg-background border-l border-border shadow-2xl z-50 overflow-hidden"
      >
        {/* Header do Drawer Lateral */}
        <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between shrink-0 bg-background">
          <SheetTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span>{anotacaoEmEdicao ? 'Editar anotação' : 'Adicionar anotação na ficha geral'}</span>
          </SheetTitle>
        </div>

        {/* Formulário com Rolagem Lateral */}
        <form
          id="form-anotacao-lateral"
          onSubmit={handleSalvar}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar"
        >
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Anotação Clínica / Observação Geral *
            </Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Digite aqui anotações clínicas, queixas principais, orientações de higiene, preferências do paciente ou evolução..."
              className="text-xs sm:text-sm min-h-[220px] rounded-xl border-purple-500/40 focus:border-purple-600 focus:ring-purple-500 leading-relaxed"
              required
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Esta anotação ficará visível na aba lateral de anotações da Ficha do Paciente com data e autor.
            </p>
          </div>
        </form>

        {/* Rodapé Fixo */}
        <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-xs flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 px-4 text-xs font-semibold border-purple-600 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-anotacao-lateral"
            className="h-10 px-6 text-xs sm:text-sm font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
          >
            {anotacaoEmEdicao ? (
              <>
                <Pencil className="h-3.5 w-3.5" />
                Atualizar Anotação
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Salvar Anotação
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ModalAnotacao;