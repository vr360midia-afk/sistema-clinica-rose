
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
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
        {/* Header responsivo */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Agenda</h1>
            <p className="text-sm sm:text-base text-gray-600">Gerencie seus agendamentos e consultas</p>
          </div>
          <Button 
            className="flex items-center gap-2 w-full sm:w-auto"
            onClick={handleNewAppointment}
          >
            <Plus className="h-4 w-4" />
            Nova Consulta
          </Button>
        </div>

        {/* View selector responsivo */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button 
            variant={view === 'day' ? 'default' : 'outline'}
            onClick={() => setView('day')}
            size="sm"
            className="whitespace-nowrap"
          >
            Dia
          </Button>
          <Button 
            variant={view === 'week' ? 'default' : 'outline'}
            onClick={() => setView('week')}
            size="sm"
            className="whitespace-nowrap"
          >
            Semana
          </Button>
          <Button 
            variant={view === 'month' ? 'default' : 'outline'}
            onClick={() => setView('month')}
            size="sm"
            className="whitespace-nowrap"
          >
            Mês
          </Button>
        </div>

        {/* Layout principal responsivo */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar - primeira em mobile, lado esquerdo em desktop */}
          <div className="lg:col-span-1 order-1 lg:order-1">
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
                  Calendário
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
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

          {/* Daily Schedule - segunda em mobile, lado direito em desktop */}
          <div className="lg:col-span-2 order-2 lg:order-2">
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-base sm:text-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Agenda do Dia</span>
                  </div>
                  <div className="text-xs sm:text-sm font-normal text-gray-500">
                    {selectedDate && format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                    <span className="ml-2">
                      ({appointmentsForSelectedDate.length} consulta{appointmentsForSelectedDate.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="space-y-3 sm:space-y-4 max-h-96 sm:max-h-[500px] overflow-y-auto">
                  {appointmentsForSelectedDate.length > 0 ? (
                    appointmentsForSelectedDate.map((appointment) => (
                      <div key={appointment.id} className="w-full">
                        <AppointmentCard
                          appointment={appointment}
                          onClick={handleAppointmentClick}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm sm:text-base">Nenhuma consulta agendada para este dia</p>
                      <Button 
                        variant="outline" 
                        className="mt-4" 
                        onClick={handleNewAppointment}
                      >
                        <Plus className="h-4 w-4 mr-2" />
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
