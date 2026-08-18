
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AppointmentCard from './AppointmentCard';

interface DayViewProps {
  selectedDate: Date;
  appointments: Array<{
    id: string;
    patient: string;
    time: string;
    duration: string;
    procedure: string;
    status: any;
    dentist: string;
    patientData?: {
      phone: string;
      age: number;
      insurance: string;
      lastVisit: string;
      allergies: string;
    };
  }>;
  onAppointmentClick: (appointment: any) => void;
  onNewAppointment: () => void;
}

const DayView = ({ selectedDate, appointments, onAppointmentClick, onNewAppointment }: DayViewProps) => {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Agenda do Dia
          </CardTitle>
          <div className="text-sm font-normal text-muted-foreground">
            {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
            <span className="ml-2">
              ({appointments.length} consulta{appointments.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="space-y-3 sm:space-y-4 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
          {appointments.length > 0 ? (
            appointments.map((appointment) => (
              <div key={appointment.id} className="w-full">
                <AppointmentCard
                  appointment={appointment}
                  onClick={onAppointmentClick}
                />
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8 sm:py-12 px-4">
              <Clock className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-30" />
              <p className="text-base sm:text-lg mb-2">Nenhuma consulta agendada para este dia</p>
              <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
                {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
              </p>
              <Button 
                variant="outline" 
                onClick={onNewAppointment}
                className="gap-2 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Agendar primeira consulta
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DayView;
