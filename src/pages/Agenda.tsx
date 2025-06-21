
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
import ConsultaModal from '@/components/agenda/ConsultaModal';

const Agenda = () => {
  const { consultas, pacientes } = useDentalSystem();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConsultaModalOpen, setIsConsultaModalOpen] = useState(false);

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

  const handleNewAppointment = () => {
    setIsConsultaModalOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-600">Gerencie seus agendamentos e consultas</p>
          </div>
          <Button 
            className="flex items-center gap-2 lg:shrink-0"
            onClick={handleNewAppointment}
          >
            <Plus className="h-4 w-4" />
            Nova Consulta
          </Button>
        </div>

        {/* View selector */}
        <div className="flex gap-2 border-b border-gray-200 pb-4">
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

        {/* Main content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Calendar */}
          <div className="xl:col-span-4">
            <Card className="sticky top-6">
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
                  className="rounded-md border w-full"
                />
              </CardContent>
            </Card>
          </div>

          {/* Daily Schedule */}
          <div className="xl:col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <span>Agenda do Dia</span>
                  </div>
                  <div className="text-sm font-normal text-gray-500">
                    {selectedDate && format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                    <span className="ml-2">
                      ({appointmentsForSelectedDate.length} consulta{appointmentsForSelectedDate.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {appointmentsForSelectedDate.length > 0 ? (
                    appointmentsForSelectedDate.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        onClick={handleAppointmentClick}
                      />
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-12">
                      <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg mb-2">Nenhuma consulta agendada para este dia</p>
                      <p className="text-sm text-gray-400 mb-6">
                        {selectedDate && format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={handleNewAppointment}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Agendar primeira consulta
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modals */}
        <PatientSummaryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          appointment={selectedAppointment}
        />

        <ConsultaModal
          isOpen={isConsultaModalOpen}
          onClose={() => setIsConsultaModalOpen(false)}
          selectedDate={selectedDate}
        />
      </div>
    </Layout>
  );
};

export default Agenda;
