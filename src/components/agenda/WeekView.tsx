
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusConsulta } from '@/types/shared';

interface WeekViewProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  consultas: Array<{
    id: string;
    pacienteId: string;
    data: Date;
    hora: string;
    duracao: number;
    procedimento: string;
    status: StatusConsulta;
    dentista: string;
    patient?: string;
  }>;
  onAppointmentClick: (appointment: any) => void;
  onDateClick: (date: Date, time?: string) => void;
}

const WeekView = ({ selectedDate, onDateChange, consultas, onAppointmentClick, onDateClick }: WeekViewProps) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const timeSlots = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 8; // 8h às 19h
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const getConsultasForDayAndTime = (day: Date, time: string) => {
    const slotHour = time.slice(0, 2);
    return consultas.filter(consulta => {
      const consultaDate = new Date(consulta.data);
      const consultaHour = (consulta.hora || '').slice(0, 2);
      return isSameDay(consultaDate, day) && consultaHour === slotHour;
    });
  };

  const getStatusColor = (status: StatusConsulta) => {
    switch (status) {
      case 'confirmado': return 'bg-green-500';
      case 'agendado': return 'bg-blue-500';
      case 'realizado': return 'bg-muted';
      case 'cancelado': return 'bg-red-500';
      case 'faltou': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  const goToPreviousWeek = () => {
    onDateChange(addDays(selectedDate, -7));
  };

  const goToNextWeek = () => {
    onDateChange(addDays(selectedDate, 7));
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Visualização Semanal
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {format(weekStart, 'dd/MM', { locale: ptBR })} - {format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <div className="grid grid-cols-8 text-xs border rounded-lg overflow-hidden min-w-[720px]">
          {/* Header */}
          <div className="p-2 font-semibold bg-muted border-r">Horário</div>
          {weekDays.map(day => (
            <div 
              key={day.toISOString()} 
              className={`p-2 text-center font-semibold cursor-pointer hover:bg-muted bg-muted border-r ${
                isToday(day) ? 'bg-blue-50 text-blue-700' : ''
              }`}
              onClick={() => onDateClick(day)}
            >
              <div>{format(day, 'EEE', { locale: ptBR })}</div>
              <div className="text-lg">{format(day, 'd')}</div>
            </div>
          ))}

          {/* Time slots */}
          {timeSlots.map(time => (
            <div key={time} className="contents">
              <div className="p-1 text-right text-muted-foreground bg-muted border-r border-b text-xs font-medium">{time}</div>
              {weekDays.map(day => {
                const dayConsultas = getConsultasForDayAndTime(day, time);
                return (
                  <div 
                    key={`${day.toISOString()}-${time}`} 
                    className="p-1 border-r border-b min-h-[40px] cursor-pointer hover:bg-muted bg-card"
                    onClick={() => onDateClick(day, time)}
                  >
                    {dayConsultas.map(consulta => (
                      <div
                        key={consulta.id}
                        className={`p-1 rounded text-white text-xs mb-1 cursor-pointer hover:opacity-80 ${getStatusColor(consulta.status)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick({
                            ...consulta,
                            patient: consulta.patient || 'Paciente',
                            duration: `${consulta.duracao}min`
                          });
                        }}
                      >
                        <div className="font-semibold truncate text-[10px]">
                          {consulta.hora} · {consulta.patient || 'Paciente'}
                        </div>
                        <div className="truncate text-[10px]">{consulta.procedimento}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeekView;
