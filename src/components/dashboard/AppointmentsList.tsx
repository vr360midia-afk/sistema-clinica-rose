
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User } from 'lucide-react';

interface Appointment {
  id: string;
  patient: string;
  time: string;
  procedure: string;
  status: 'confirmed' | 'pending' | 'completed';
  doctor: string;
}

const appointments: Appointment[] = [
  {
    id: '1',
    patient: 'Maria Santos',
    time: '09:00',
    procedure: 'Limpeza Dental',
    status: 'confirmed',
    doctor: 'Dr. Ana Silva'
  },
  {
    id: '2',
    patient: 'João Oliveira',
    time: '10:30',
    procedure: 'Obturação',
    status: 'pending',
    doctor: 'Dr. Carlos Lima'
  },
  {
    id: '3',
    patient: 'Ana Costa',
    time: '14:00',
    procedure: 'Consulta de Rotina',
    status: 'confirmed',
    doctor: 'Dr. Ana Silva'
  },
  {
    id: '4',
    patient: 'Pedro Silva',
    time: '15:30',
    procedure: 'Extração',
    status: 'completed',
    doctor: 'Dr. Carlos Lima'
  }
];

const AppointmentsList = () => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmado';
      case 'pending':
        return 'Pendente';
      case 'completed':
        return 'Concluído';
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Próximos Agendamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {appointments.map((appointment) => (
          <div key={appointment.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-900">{appointment.patient}</span>
              </div>
              <p className="text-sm text-gray-600">{appointment.procedure}</p>
              <p className="text-xs text-gray-500">{appointment.doctor}</p>
            </div>
            <div className="text-right">
              <div className="font-medium text-gray-900 mb-1">{appointment.time}</div>
              <Badge className={getStatusColor(appointment.status)}>
                {getStatusText(appointment.status)}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AppointmentsList;
