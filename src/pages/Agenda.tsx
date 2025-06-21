import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDentalSystem } from '@/context/DentalSystemContext';
import PatientSummaryModal from '@/components/agenda/PatientSummaryModal';
import ConsultaModal from '@/components/agenda/ConsultaModal';
import DayView from '@/components/agenda/DayView';
import WeekView from '@/components/agenda/WeekView';
import MonthView from '@/components/agenda/MonthView';
import AppointmentDetailsModal from '@/components/agenda/AppointmentDetailsModal';
import { useAgendaViews } from '@/hooks/useAgendaViews';

const Agenda = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isConsultaModalOpen, setIsConsultaModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const {
    view,
    setView,
    transformedConsultas,
    appointmentsForSelectedDate,
    handleStatusChange,
    handleDeleteAppointment
  } = useAgendaViews(selectedDate || new Date());

  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setIsDetailsModalOpen(true);
  };

  const handlePatientSummaryClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setIsPatientModalOpen(true);
  };

  const handleNewAppointment = () => {
    setIsConsultaModalOpen(true);
  };

  // Handler para clique em data do calendário - abre nova consulta
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsConsultaModalOpen(true);
  };

  // Handler para mudança de data nas visualizações
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  // Renderizar a visualização atual
  const renderCurrentView = () => {
    if (!selectedDate) return null;

    switch (view) {
      case 'week':
        return (
          <WeekView
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            consultas={transformedConsultas}
            onAppointmentClick={handleAppointmentClick}
            onDateClick={handleDateClick}
          />
        );
      case 'month':
        return (
          <MonthView
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            consultas={transformedConsultas}
            onAppointmentClick={handleAppointmentClick}
            onDateClick={handleDateClick}
          />
        );
      default:
        return (
          <DayView
            selectedDate={selectedDate}
            appointments={appointmentsForSelectedDate}
            onAppointmentClick={handleAppointmentClick}
            onNewAppointment={handleNewAppointment}
          />
        );
    }
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

        {/* Main content - Grid responsivo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Calendar - Responsivo - Só mostra na visualização diária */}
          {view === 'day' && (
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
                      onSelect={(date) => {
                        if (date) {
                          handleDateClick(date);
                        }
                      }}
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
          )}

          {/* Schedule View - Responsivo */}
          <div className={`${view === 'day' ? 'lg:col-span-8' : 'col-span-12'} order-1 lg:order-2`}>
            {renderCurrentView()}
          </div>
        </div>

        {/* Modals */}
        <PatientSummaryModal
          isOpen={isPatientModalOpen}
          onClose={() => setIsPatientModalOpen(false)}
          appointment={selectedAppointment}
        />

        <ConsultaModal
          isOpen={isConsultaModalOpen}
          onClose={() => setIsConsultaModalOpen(false)}
          selectedDate={selectedDate}
        />

        <AppointmentDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          appointment={selectedAppointment}
          onEdit={handlePatientSummaryClick}
          onDelete={handleDeleteAppointment}
          onStatusChange={handleStatusChange}
        />
      </div>
    </Layout>
  );
};

export default Agenda;
