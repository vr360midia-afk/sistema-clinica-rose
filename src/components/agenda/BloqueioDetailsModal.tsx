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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Lock,
  Calendar as CalendarIcon,
  Clock,
  User,
  AlignLeft,
  Trash2,
  Edit,
  AlertTriangle,
} from 'lucide-react';
import { BloqueioAgenda } from '@/hooks/useBloqueios';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BloqueioDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bloqueio: BloqueioAgenda | null;
  onEdit: (bloqueio: BloqueioAgenda) => void;
  onDelete: (id: string) => Promise<boolean | void>;
}

export const BloqueioDetailsModal: React.FC<BloqueioDetailsModalProps> = ({
  isOpen,
  onClose,
  bloqueio,
  onEdit,
  onDelete,
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!bloqueio) return null;

  const formatDateFriendly = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const isMultiDay = bloqueio.dataFim && bloqueio.dataFim !== bloqueio.dataInicio;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await onDelete(bloqueio.id);
      if (res !== false) {
        setConfirmingDelete(false);
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setConfirmingDelete(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md w-full">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1.5"
            >
              <Lock className="h-3 w-3" />
              Horário Bloqueado
            </Badge>

            <span className="text-xs text-muted-foreground font-mono">
              ID: {bloqueio.id.slice(0, 8)}
            </span>
          </div>

          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            {bloqueio.titulo}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Período reservado. Consultas normais não podem ser agendadas neste intervalo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Informações de Data, Horário e Profissional */}
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-3.5 space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <CalendarIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Data</span>
                  <p className="font-medium text-foreground capitalize">
                    {isMultiDay
                      ? `${formatDateFriendly(bloqueio.dataInicio)} até ${formatDateFriendly(bloqueio.dataFim)}`
                      : formatDateFriendly(bloqueio.dataInicio)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 border-t border-border/50 pt-2.5">
                <Clock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Horário</span>
                  <p className="font-medium text-foreground">
                    {bloqueio.diaInteiro
                      ? 'Dia inteiro bloqueado'
                      : `${bloqueio.horaInicio || '--:--'} às ${bloqueio.horaFim || '--:--'}`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 border-t border-border/50 pt-2.5">
                <User className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Profissional</span>
                  <p className="font-medium text-foreground">
                    {bloqueio.dentista ? `Dr(a). ${bloqueio.dentista}` : 'Todos os profissionais (Clínica)'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Descrição / Observações */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <AlignLeft className="h-3.5 w-3.5 text-primary" />
              <span>Descrição do Bloqueio:</span>
            </div>
            {bloqueio.observacoes ? (
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {bloqueio.observacoes}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/20 border border-dashed border-border text-xs text-muted-foreground italic">
                Nenhuma observação detalhada adicionada.
              </div>
            )}
          </div>

          {/* Alerta de Confirmação de Exclusão */}
          {confirmingDelete && (
            <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                <AlertTriangle className="h-4 w-4" />
                <span>Confirmar desbloqueio de horário?</span>
              </div>
              <p className="text-xs text-muted-foreground">
                O período voltará a ficar disponível para novos agendamentos na agenda.
              </p>
              <div className="flex gap-2 pt-1 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  Voltar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Removendo...' : 'Sim, Desbloquear'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          {!confirmingDelete && (
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex items-center gap-1.5"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Desbloquear
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onEdit(bloqueio);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button type="button" size="sm" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BloqueioDetailsModal;
