import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  User,
  Clock,
  Phone,
  Calendar,
  CalendarDays,
  FileText,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  MessageCircle,
  CalendarClock,
  RotateCcw,
} from 'lucide-react';
import { ConfirmacaoStatus, StatusConsulta } from '@/types/shared';
import { buildConfirmacaoPacienteMessage, openWhatsApp } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calcularHoraFim, formatarDuracaoAmigavel } from '@/utils/horarioConsulta';

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    id: string;
    pacienteId?: string;
    patient: string;
    time: string;
    duration: string;
    procedure: string;
    status: StatusConsulta;
    confirmacaoStatus?: ConfirmacaoStatus;
    date?: Date;
    dentist: string;
    patientData?: {
      phone: string;
      age: number;
      insurance: string;
      lastVisit: string;
      allergies: string;
    };
    [key: string]: any;
  } | null;
  onEdit?: (appointment: any) => void;
  onDelete?: (appointmentId: string) => void;
  onStatusChange?: (appointmentId: string, newStatus: StatusConsulta) => void;
  onConfirmacaoChange?: (appointmentId: string, novo: ConfirmacaoStatus) => void;
  onReschedule?: (appointment: any) => void;
  onAgendarRetorno?: (appointment: any) => void;
}

const AppointmentDetailsModal = ({
  isOpen,
  onClose,
  appointment,
  onEdit,
  onDelete,
  onStatusChange,
  onConfirmacaoChange,
  onReschedule,
  onAgendarRetorno,
}: AppointmentDetailsModalProps) => {
  if (!appointment) return null;

  const confirmacao: ConfirmacaoStatus = appointment.confirmacaoStatus || 'pendente';

  const handleWhatsAppPaciente = () => {
    const telefone = appointment.patientData?.phone;
    const mensagem = buildConfirmacaoPacienteMessage({
      pacienteNome: appointment.patient,
      data: appointment.date || appointment.data || new Date(),
      hora: appointment.time,
      dentistaNome: appointment.dentist,
      procedimento: appointment.procedure,
    });
    if (!openWhatsApp(telefone, mensagem)) {
      toast.warning('Paciente sem telefone válido para WhatsApp.');
    }
  };

  const getStatusBadge = (status: StatusConsulta) => {
    switch (status) {
      case 'confirmado':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            Confirmado
          </Badge>
        );
      case 'agendado':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-xs font-bold">
            Agendado
          </Badge>
        );
      case 'realizado':
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 text-xs font-bold">
            Consulta Realizada
          </Badge>
        );
      case 'cancelado':
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-xs font-bold">
            Cancelada
          </Badge>
        );
      case 'faltou':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold">
            Não Compareceu
          </Badge>
        );
      case 'remarcado':
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 text-xs font-bold">
            Reagendada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs font-bold">
            {status}
          </Badge>
        );
    }
  };

  const getConfirmacaoBadge = (conf: ConfirmacaoStatus) => {
    switch (conf) {
      case 'confirmado':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            ✓ Paciente confirmou
          </Badge>
        );
      case 'recusado':
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-xs font-bold">
            ✕ Paciente não confirmou
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold">
            ⏳ Aguardando confirmação
          </Badge>
        );
    }
  };

  // Tratamento e formatação segura da data da consulta
  const rawDate = appointment.date || appointment.data;
  let dataExtenso = 'Data não informada';

  if (rawDate) {
    let d: Date | null = null;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      d = rawDate;
    } else if (typeof rawDate === 'string') {
      if (rawDate.includes('-')) {
        const parts = rawDate.split('T')[0].split('-');
        if (parts.length === 3) {
          d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
      } else {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) d = parsed;
      }
    }

    if (d && !isNaN(d.getTime())) {
      const diaSemana = format(d, 'EEEE', { locale: ptBR });
      const diaSemanaCap = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
      dataExtenso = `${diaSemanaCap}, ${format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    }
  }

  // Duração e horário final
  const duracaoMinutos =
    appointment.duracao ||
    (typeof appointment.duration === 'string'
      ? parseInt(appointment.duration, 10)
      : Number(appointment.duration)) ||
    60;
  const horaFim = calcularHoraFim(appointment.time, duracaoMinutos);
  const duracaoFormatada = formatarDuracaoAmigavel(duracaoMinutos);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-5">
        <DialogHeader className="pb-1 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <span>Detalhes da Consulta</span>
            </DialogTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              {getStatusBadge(appointment.status)}
              {getConfirmacaoBadge(confirmacao)}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 pt-2">
          {/* Bloco 1: Ações Rápidas de WhatsApp e Confirmação */}
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                type="button"
                size="sm"
                onClick={handleWhatsAppPaciente}
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Enviar WhatsApp</span>
              </Button>

              {onConfirmacaoChange && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant={confirmacao === 'confirmado' ? 'default' : 'outline'}
                    onClick={() => onConfirmacaoChange(appointment.id, 'confirmado')}
                    className={cn(
                      'h-8 text-xs font-semibold gap-1.5 transition-colors',
                      confirmacao === 'confirmado'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        : 'border-border text-foreground hover:bg-accent'
                    )}
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Confirmou</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={confirmacao === 'recusado' ? 'destructive' : 'outline'}
                    onClick={() => onConfirmacaoChange(appointment.id, 'recusado')}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Não confirmou</span>
                  </Button>
                </>
              )}
            </div>

            {onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(appointment)}
                className="h-8 text-xs font-medium gap-1.5 shrink-0"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Button>
            )}
          </div>

          {/* Bloco 2: Ações de Mudança de Status da Consulta */}
          <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-lg bg-card border border-border/80">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              Status Clínico:
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {onStatusChange && appointment.status !== 'realizado' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onStatusChange(appointment.id, 'realizado')}
                  className="h-7.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Realizada</span>
                </Button>
              )}

              {onReschedule && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onReschedule(appointment)}
                  className="h-7.5 text-xs font-semibold gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span>Remarcar</span>
                </Button>
              )}

              {onAgendarRetorno && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAgendarRetorno(appointment)}
                  className="h-7.5 text-xs font-semibold gap-1.5 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  title="Agendar retorno para este paciente"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Agendar Retorno</span>
                </Button>
              )}

              {onStatusChange && appointment.status !== 'faltou' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(appointment.id, 'faltou')}
                  className="h-7.5 text-xs font-semibold gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Não compareceu</span>
                </Button>
              )}

              {onStatusChange && appointment.status !== 'cancelado' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(appointment.id, 'cancelado')}
                  className="h-7.5 text-xs font-semibold gap-1.5 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Cancelar</span>
                </Button>
              )}
            </div>
          </div>

          {/* Bloco 3: Grid Unificada das Informações (Consulta e Paciente) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
            {/* Informações da Consulta */}
            <Card className="border border-border/80 bg-card/60 shadow-xs">
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-foreground text-xs sm:text-sm border-b pb-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span>Informações da Consulta</span>
                </div>

                {/* DIA DA CONSULTA EM DESTAQUE */}
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/25 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    Dia da Consulta
                  </span>
                  <p className="font-extrabold text-foreground text-xs sm:text-sm">
                    {dataExtenso}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Horário</span>
                    <span className="font-bold text-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      {appointment.time} às {horaFim}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Duração</span>
                    <span className="font-medium text-foreground">{duracaoFormatada}</span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Procedimento</span>
                    <p className="font-semibold text-foreground truncate">{appointment.procedure || 'Consulta Geral'}</p>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Dentista</span>
                    <p className="font-medium text-foreground truncate">{appointment.dentist || 'Dra. Rosangela Santos'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações do Paciente */}
            <Card className="border border-border/80 bg-card/60 shadow-xs">
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-foreground text-xs sm:text-sm border-b pb-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span>Informações do Paciente</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Nome</span>
                    <p className="font-bold text-foreground text-sm truncate">{appointment.patient}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {appointment.patientData?.phone && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Telefone</span>
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          {appointment.patientData.phone}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Convênio</span>
                      <span className="font-medium text-foreground uppercase text-[11px]">
                        {appointment.patientData?.insurance || 'Particular'}
                      </span>
                    </div>

                    {appointment.patientData?.age > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Idade</span>
                        <span className="font-medium text-foreground">{appointment.patientData.age} anos</span>
                      </div>
                    )}

                    {appointment.patientData?.lastVisit && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Última Visita</span>
                        <span className="font-medium text-foreground">{appointment.patientData.lastVisit}</span>
                      </div>
                    )}
                  </div>

                  {appointment.patientData?.allergies && (
                    <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-[11px]">
                      <strong>Alergias:</strong> {appointment.patientData.allergies}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rodapé Concentrado */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8.5 px-4 text-xs font-semibold">
              Fechar
            </Button>

            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDelete(appointment.id);
                  onClose();
                }}
                className="h-8.5 text-xs font-semibold gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir Consulta
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDetailsModal;
