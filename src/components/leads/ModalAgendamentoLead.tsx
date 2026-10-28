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
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, Bell, CalendarCheck2 } from 'lucide-react';
import { NovoLead, AlertasAgendamento } from '@/types/novosLeads';
import { formatarTelefoneExibicao } from '@/services/novosLeadsService';
import { toast } from 'sonner';

interface ModalAgendamentoLeadProps {
  isOpen: boolean;
  onClose: () => void;
  lead: NovoLead | null;
  onConfirmar: (
    dataHoraIso: string,
    alertas: AlertasAgendamento
  ) => Promise<void>;
}

export default function ModalAgendamentoLead({
  isOpen,
  onClose,
  lead,
  onConfirmar,
}: ModalAgendamentoLeadProps) {
  const [data, setData] = useState<string>(() => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    return amanha.toISOString().split('T')[0];
  });
  const [hora, setHora] = useState<string>('09:00');
  const [alertas, setAlertas] = useState<AlertasAgendamento>({
    h72: true,
    h48: true,
    h24: true,
    h3: true,
  });
  const [salvando, setSalvando] = useState(false);

  if (!lead) return null;

  const handleSalvar = async () => {
    if (!data || !hora) {
      toast.error('Informe a data e o horário da consulta.');
      return;
    }

    setSalvando(true);
    try {
      const dataHoraIso = new Date(`${data}T${hora}:00`).toISOString();
      await onConfirmar(dataHoraIso, alertas);
      onClose();
    } catch {
      // tratado no hook
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CalendarCheck2 className="w-5 h-5 text-emerald-700" />
            </div>
            <DialogTitle className="text-xl">Agendar Consulta do Lead</DialogTitle>
          </div>
          <DialogDescription>
            Defina a data e hora da consulta para{' '}
            <strong className="text-foreground">{lead.nome}</strong> (
            {formatarTelefoneExibicao(lead.telefone)}) e programe os lembretes automáticos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data-consulta" className="flex items-center gap-1.5 text-xs font-semibold">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Data da Consulta *
              </Label>
              <Input
                id="data-consulta"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hora-consulta" className="flex items-center gap-1.5 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Horário *
              </Label>
              <Input
                id="hora-consulta"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          {/* Programação de Alertas Requeridos (72h, 48h, 24h e 3h) */}
          <div className="border border-border/80 rounded-xl p-3.5 bg-muted/30 space-y-2.5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                Alertas e Lembretes Programados
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione as notificações que serão disparadas antes da consulta:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-background border border-border/60 hover:bg-muted/50 cursor-pointer text-xs font-medium">
                <Checkbox
                  checked={alertas.h72}
                  onCheckedChange={(c) =>
                    setAlertas((prev) => ({ ...prev, h72: Boolean(c) }))
                  }
                />
                <span>72h antes (3 dias)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-background border border-border/60 hover:bg-muted/50 cursor-pointer text-xs font-medium">
                <Checkbox
                  checked={alertas.h48}
                  onCheckedChange={(c) =>
                    setAlertas((prev) => ({ ...prev, h48: Boolean(c) }))
                  }
                />
                <span>48h antes (2 dias)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-background border border-border/60 hover:bg-muted/50 cursor-pointer text-xs font-medium">
                <Checkbox
                  checked={alertas.h24}
                  onCheckedChange={(c) =>
                    setAlertas((prev) => ({ ...prev, h24: Boolean(c) }))
                  }
                />
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  24h antes (1 dia)
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-background border border-border/60 hover:bg-muted/50 cursor-pointer text-xs font-medium">
                <Checkbox
                  checked={alertas.h3}
                  onCheckedChange={(c) =>
                    setAlertas((prev) => ({ ...prev, h3: Boolean(c) }))
                  }
                />
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  3h antes (no dia)
                </span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {salvando ? 'Salvando...' : 'Confirmar Agendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
