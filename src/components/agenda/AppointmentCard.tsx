
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Clock, Phone, AlertTriangle } from 'lucide-react';
import { StatusConsulta } from '@/types/shared';

interface AppointmentCardProps {
  appointment: {
    id: string;
    patient: string;
    time: string;
    duration: string;
    procedure: string;
    status: StatusConsulta;
    dentist: string;
    patientData?: {
      phone: string;
      age: number;
      insurance: string;
      lastVisit: string;
      allergies: string;
    };
  };
  onClick: (appointment: any) => void;
}

const AppointmentCard = ({ appointment, onClick }: AppointmentCardProps) => {
  const getStatusColor = (status: StatusConsulta) => {
    switch (status) {
      case 'confirmado': return 'bg-green-100 text-green-800 border-green-200';
      case 'agendado': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'realizado': return 'bg-muted text-foreground border-border';
      case 'cancelado': return 'bg-red-100 text-red-800 border-red-200';
      case 'faltou': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const getStatusLabel = (status: StatusConsulta) => {
    switch (status) {
      case 'confirmado': return 'Confirmado';
      case 'agendado': return 'Agendado';
      case 'realizado': return 'Realizado';
      case 'cancelado': return 'Cancelado';
      case 'faltou': return 'Faltou';
      default: return status;
    }
  };

  const getCardBorderColor = (status: StatusConsulta) => {
    switch (status) {
      case 'confirmado': return 'border-l-green-500';
      case 'agendado': return 'border-l-blue-500';
      case 'realizado': return 'border-l-gray-500';
      case 'cancelado': return 'border-l-red-500';
      case 'faltou': return 'border-l-yellow-500';
      default: return 'border-l-gray-400';
    }
  };

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 ${getCardBorderColor(appointment.status)} hover:scale-[1.02]`}
      onClick={() => onClick(appointment)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Horário */}
            <div className="text-center shrink-0">
              <div className="font-bold text-lg text-foreground">{appointment.time}</div>
              <div className="text-sm text-muted-foreground">{appointment.duration}</div>
            </div>

            {/* Informações principais */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg text-foreground truncate">
                    {appointment.patient}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">{appointment.procedure}</p>
                </div>
                <Badge className={`${getStatusColor(appointment.status)} shrink-0 ml-2`}>
                  {getStatusLabel(appointment.status)}
                </Badge>
              </div>

              {/* Informações adicionais */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{appointment.dentist}</span>
                </div>

                {appointment.patientData?.phone && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{appointment.patientData.phone}</span>
                  </div>
                )}

                {appointment.patientData?.allergies && (
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="truncate">Alergia: {appointment.patientData.allergies}</span>
                  </div>
                )}
              </div>

              {/* Informações extras na parte inferior */}
              <div className="mt-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {appointment.patientData?.age && (
                    <span>{appointment.patientData.age} anos</span>
                  )}
                  {appointment.patientData?.insurance && (
                    <span className="truncate ml-2">{appointment.patientData.insurance}</span>
                  )}
                  {appointment.patientData?.lastVisit && (
                    <span className="truncate ml-2">Última: {appointment.patientData.lastVisit}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppointmentCard;
