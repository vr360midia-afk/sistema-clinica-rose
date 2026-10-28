import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle, Archive, AlertTriangle } from 'lucide-react';
import { NovoLead } from '@/types/novosLeads';
import { toast } from 'sonner';

interface ModalPerdaLeadProps {
  isOpen: boolean;
  onClose: () => void;
  lead: NovoLead | null;
  onConfirmar: (motivo: string, observacaoDetalhada: string) => Promise<void>;
}

const MOTIVOS_PADRAO = [
  'Preço / Orçamento fora do esperado',
  'Optou por outra clínica / concorrente',
  'Parou de responder aos follow-ups',
  'Não tem interesse no momento',
  'Localização / Distância da clínica',
  'Condições de saúde ou idade não indicada',
  'Contato incorreto ou trote',
  'Outro motivo específico',
];

export default function ModalPerdaLead({
  isOpen,
  onClose,
  lead,
  onConfirmar,
}: ModalPerdaLeadProps) {
  const [motivoSelecionado, setMotivoSelecionado] = useState<string>('');
  const [detalhes, setDetalhes] = useState<string>('');
  const [salvando, setSalvando] = useState(false);

  if (!lead) return null;

  const handleSalvar = async () => {
    if (!motivoSelecionado) {
      toast.error('É obrigatório selecionar o motivo da perda.');
      return;
    }

    setSalvando(true);
    try {
      await onConfirmar(motivoSelecionado, detalhes);
      onClose();
    } catch {
      // tratado
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600">
            <div className="p-2 bg-rose-100 dark:bg-rose-950/50 rounded-lg">
              <XCircle className="w-5 h-5 text-rose-700 dark:text-rose-400" />
            </div>
            <DialogTitle className="text-xl">Marcar Lead como Perdido</DialogTitle>
          </div>
          <DialogDescription>
            Informe o motivo da perda para{' '}
            <strong className="text-foreground">{lead.nome}</strong>. O registro
            será arquivado preservando todo o histórico de contatos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="motivo-select" className="text-xs font-semibold flex items-center gap-1 text-foreground">
              Motivo da Perda *
            </Label>
            <Select value={motivoSelecionado} onValueChange={setMotivoSelecionado}>
              <SelectTrigger id="motivo-select">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_PADRAO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-detalhe" className="text-xs font-semibold text-muted-foreground">
              Observações Adicionais (opcional)
            </Label>
            <Textarea
              id="motivo-detalhe"
              placeholder="Descreva algum detalhe relevante para futuras abordagens ou campanhas..."
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5">
            <Archive className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              O lead será ocultado da caixa de entrada principal e mantido na aba <strong>Arquivados</strong> para consulta e futuras reativações.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Voltar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
          >
            {salvando ? 'Arquivando...' : 'Confirmar e Arquivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
