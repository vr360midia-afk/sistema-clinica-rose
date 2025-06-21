
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
      <div className="space-y-4 sm:space-y-6 w-full max-w-none">
        {/* Header - Responsivo */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:justify-between lg:items-start lg:space-y-0">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Agenda</h1>
            <p className="text-sm sm:text-base text-gray-600">Gerencie seus agendamentos e consultas</p>
          </div>
          <Button 
            className="flex items-center gap-2 w-full sm:w-auto justify-center"
            onClick={handleNewAppointment}
          >
            <Plus className="h-4 w-4" />
            Nova Consulta
          </Button>
        </div>

        {/* View selector - Responsivo */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
          <Button 
            variant={view === 'day' ? 'default' : 'outline'}
            onClick={() => setView('day')}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            Dia
          </Button>
          <Button 
            variant={view === 'week' ? 'default' : 'outline'}
            onClick={() => setView('week')}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            Semana
          </Button>
          <Button 
            variant={view === 'month' ? 'default' : 'outline'}
            onClick={() => setView('month')}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            Mês
          </Button>
        </div>

        {/* Main content - Grid responsivo aprimorado */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Calendar - Responsivo */}
          <div className="lg:col-span-4 order-2 lg:order-1">
            <Card className="w-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5" />
                  Calendário
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="w-full overflow-hidden">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={ptBR}
                    className="w-full max-w-none mx-auto"
                    classNames={{
                      months: "flex flex-col space-y-4",
                      month: "space-y-4 w-full",
                      caption: "flex justify-center pt-1 relative items-center mb-4",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-gray-300 rounded-md",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex w-full",
                      head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] flex items-center justify-center h-8",
                      row: "flex w-full mt-2",
                      cell: "flex-1 h-8 sm:h-9 text-center text-sm p-0 relative flex items-center justify-center",
                      day: "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground font-semibold",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Schedule - Responsivo */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <Card className="w-full">
              <CardHeader className="pb-3">
                <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5" />
                    Agenda do Dia
                  </CardTitle>
                  <div className="text-sm font-normal text-gray-500">
                    {selectedDate && format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                    <span className="ml-2">
                      ({appointmentsForSelectedDate.length} consulta{appointmentsForSelectedDate.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="space-y-3 sm:space-y-4 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
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
                    <div className="text-center text-gray-500 py-8 sm:py-12 px-4">
                      <Clock className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-30" />
                      <p className="text-base sm:text-lg mb-2">Nenhuma consulta agendada para este dia</p>
                      <p className="text-sm text-gray-400 mb-4 sm:mb-6">
                        {selectedDate && format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={handleNewAppointment}
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
