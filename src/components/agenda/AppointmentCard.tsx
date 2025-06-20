
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Clock, Calendar } from 'lucide-react';

interface AppointmentCardProps {
  appointment: {
    id: number;
    patient: string;
    time: string;
    duration: string;
    procedure: string;
    status: string;
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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado': return 'bg-green-100 text-green-800';
      case 'pendente': return 'bg-yellow-100 text-yellow-800';
      case 'cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onClick(appointment)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="font-semibold text-lg">{appointment.time}</div>
              <div className="text-sm text-gray-500">{appointment.duration}</div>
            </div>
            <div>
              <div className="font-medium">{appointment.patient}</div>
              <div className="text-sm text-gray-600">{appointment.procedure}</div>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <User className="h-3 w-3" />
                {appointment.dentist}
              </div>
            </div>
          </div>
          <Badge className={getStatusColor(appointment.status)}>
            {appointment.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppointmentCard;
