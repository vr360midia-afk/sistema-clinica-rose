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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, CheckCircle2, UserPlus } from 'lucide-react';
import { NovoLead } from '@/types/novosLeads';
import { toast } from 'sonner';

interface ModalConversaoLeadProps {
  isOpen: boolean;
  onClose: () => void;
  lead: NovoLead | null;
  onConfirmar: (valorVenda: number, converterEmPaciente: boolean) => Promise<void>;
}

export default function ModalConversaoLead({
  isOpen,
  onClose,
  lead,
  onConfirmar,
}: ModalConversaoLeadProps) {
  const [valorTexto, setValorTexto] = useState<string>('');
  const [converterEmPaciente, setConverterEmPaciente] = useState<boolean>(true);
  const [salvando, setSalvando] = useState(false);

  if (!lead) return null;

  const handleSalvar = async () => {
    const valorLimpo = parseFloat(
      valorTexto.replace(/\./g, '').replace(',', '.') || '0'
    );

    if (isNaN(valorLimpo) || valorLimpo <= 0) {
      toast.error('Informe o valor da venda / fechamento do procedimento.');
      return;
    }

    setSalvando(true);
    try {
      await onConfirmar(valorLimpo, converterEmPaciente);
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
          <div className="flex items-center gap-2 text-emerald-600">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            </div>
            <DialogTitle className="text-xl">Parabéns pela Conversão!</DialogTitle>
          </div>
          <DialogDescription>
            Registre o fechamento do tratamento para{' '}
            <strong className="text-foreground">{lead.nome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="valor-venda" className="flex items-center gap-1.5 text-xs font-semibold">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Valor da Venda (R$) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-muted-foreground">
                R$
              </span>
              <Input
                id="valor-venda"
                type="text"
                placeholder="0,00"
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                className="pl-10 text-base font-bold text-emerald-700 dark:text-emerald-400"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Exemplo: 3500,00 ou 12.000,00
            </p>
          </div>

          <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={converterEmPaciente}
                onChange={(e) => setConverterEmPaciente(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                  Abrir etapa de revisão e cadastro de Paciente
                </span>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Converte este lead em paciente ativo da clínica, criando ficha e prontuário sem duplicidades.
                </p>
              </div>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {salvando ? 'Gravando...' : 'Confirmar Conversão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
