
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusConsulta } from '@/types/shared';

interface MonthViewProps {
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
  onDateClick: (date: Date) => void;
}

const MonthView = ({ selectedDate, onDateChange, consultas, onAppointmentClick, onDateClick }: MonthViewProps) => {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getConsultasForDay = (day: Date) => {
    return consultas.filter(consulta => {
      const consultaDate = new Date(consulta.data);
      return isSameDay(consultaDate, day);
    });
  };

  const getStatusColor = (status: StatusConsulta) => {
    switch (status) {
      case 'confirmado': return 'bg-green-100 text-green-800';
      case 'agendado': return 'bg-blue-100 text-blue-800';
      case 'realizado': return 'bg-muted text-foreground';
      case 'cancelado': return 'bg-red-100 text-red-800';
      case 'faltou': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const goToPreviousMonth = () => {
    onDateChange(addMonths(selectedDate, -1));
  };

  const goToNextMonth = () => {
    onDateChange(addMonths(selectedDate, 1));
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Visualização Mensal
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[150px] text-center">
              {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-muted-foreground text-sm">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(day => {
            const dayConsultas = getConsultasForDay(day);
            const isCurrentMonth = isSameMonth(day, selectedDate);
            const isDayToday = isToday(day);
            
            return (
              <div
                key={day.toISOString()}
                className={`
                  min-h-[120px] p-2 border rounded-lg cursor-pointer hover:bg-muted transition-colors
                  ${!isCurrentMonth ? 'text-muted-foreground bg-muted' : ''}
                  ${isDayToday ? 'bg-blue-50 border-blue-200' : 'border-border'}
                `}
                onClick={() => onDateClick(day)}
              >
                <div className={`text-sm font-semibold mb-1 ${isDayToday ? 'text-blue-700' : ''}`}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1">
                  {dayConsultas.slice(0, 3).map(consulta => (
                    <div
                      key={consulta.id}
                      className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${getStatusColor(consulta.status)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick({
                          ...consulta,
                          patient: consulta.patient || 'Paciente',
                          duration: `${consulta.duracao}min`
                        });
                      }}
                    >
                      <div className="font-semibold truncate">{consulta.hora}</div>
                      <div className="truncate">{consulta.patient || 'Paciente'}</div>
                    </div>
                  ))}
                  
                  {dayConsultas.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayConsultas.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthView;
