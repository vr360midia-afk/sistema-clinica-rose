
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDentalSystem } from '@/context/DentalSystemContext';
import AppointmentCard from '@/components/agenda/AppointmentCard';
import PatientSummaryModal from '@/components/agenda/PatientSummaryModal';

const Agenda = () => {
  const { consultas, pacientes } = useDentalSystem();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtrar consultas do dia selecionado
  const selectedDateConsultas = selectedDate 
    ? consultas.filter(consulta => {
        const consultaDate = new Date(consulta.data);
        return consultaDate.toDateString() === selectedDate.toDateString();
      })
    : [];

  // Transformar consultas para o formato esperado pelo AppointmentCard
  const appointmentsForSelectedDate = selectedDateConsultas.map(consulta => {
    const paciente = pacientes.find(p => p.id === consulta.pacienteId);
    return {
      id: consulta.id,
      patient: paciente?.nome || 'Paciente não encontrado',
      time: consulta.hora,
      duration: `${consulta.duracao}min`,
      procedure: consulta.procedimento,
      status: consulta.status,
      dentist: consulta.dentista,
      patientData: {
        phone: paciente?.telefone || '',
        age: paciente?.idade || 0,
        insurance: paciente?.convenio || '',
        lastVisit: paciente?.ultimaConsulta ? new Date(paciente.ultimaConsulta).toLocaleDateString('pt-BR') : '',
        allergies: paciente?.alergias || ''
      }
    };
  });

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
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({appointmentsForSelectedDate.length} consulta{appointmentsForSelectedDate.length !== 1 ? 's' : ''})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {appointmentsForSelectedDate.length > 0 ? (
                    appointmentsForSelectedDate.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        onClick={handleAppointmentClick}
                      />
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma consulta agendada para este dia</p>
                    </div>
                  )}
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
