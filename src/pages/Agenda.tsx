
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AppointmentCard from '@/components/agenda/AppointmentCard';
import PatientSummaryModal from '@/components/agenda/PatientSummaryModal';

const mockAppointments = [
  {
    id: 1,
    patient: 'Maria Silva',
    time: '09:00',
    duration: '1h',
    procedure: 'Limpeza',
    status: 'confirmado',
    dentist: 'Dr. João',
    patientData: {
      phone: '(11) 99999-9999',
      age: 32,
      insurance: 'Unimed',
      lastVisit: '15/12/2023',
      allergies: 'Alergia a penicilina'
    }
  },
  {
    id: 2,
    patient: 'Carlos Santos',
    time: '10:30',
    duration: '30min',
    procedure: 'Consulta',
    status: 'pendente',
    dentist: 'Dr. Ana',
    patientData: {
      phone: '(11) 88888-8888',
      age: 45,
      insurance: 'Particular',
      lastVisit: '20/11/2023',
      allergies: ''
    }
  },
  {
    id: 3,
    patient: 'Ana Costa',
    time: '14:00',
    duration: '2h',
    procedure: 'Canal',
    status: 'confirmado',
    dentist: 'Dr. João',
    patientData: {
      phone: '(11) 77777-7777',
      age: 28,
      insurance: 'Bradesco Dental',
      lastVisit: '10/01/2024',
      allergies: 'Alergia a latex'
    }
  }
];

const Agenda = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Agenda</h1>
            <p className="text-gray-600">Gerencie seus agendamentos e consultas</p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Consulta
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <Button 
            variant={view === 'day' ? 'default' : 'outline'}
            onClick={() => setView('day')}
            size="sm"
          >
            Dia
          </Button>
          <Button 
            variant={view === 'week' ? 'default' : 'outline'}
            onClick={() => setView('week')}
            size="sm"
          >
            Semana
          </Button>
          <Button 
            variant={view === 'month' ? 'default' : 'outline'}
            onClick={() => setView('month')}
            size="sm"
          >
            Mês
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Calendário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Daily Schedule */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Agenda do Dia - {selectedDate && format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onClick={handleAppointmentClick}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <PatientSummaryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          appointment={selectedAppointment}
        />
      </div>
    </Layout>
  );
};

export default Agenda;
