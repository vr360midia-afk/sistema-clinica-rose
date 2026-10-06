import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Plus, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDentalSystem } from '@/context/DentalSystemContext';

import ConsultaModal from '@/components/agenda/ConsultaModal';
import DayView from '@/components/agenda/DayView';
import WeekView from '@/components/agenda/WeekView';
import MonthView from '@/components/agenda/MonthView';
import { AgendaBigCalendar } from '@/components/agenda/AgendaBigCalendar';
import AppointmentDetailsModal from '@/components/agenda/AppointmentDetailsModal';
import PendentesModal from '@/components/agenda/PendentesModal';
import { useAgendaViews } from '@/hooks/useAgendaViews';
import { downloadICS } from '@/utils/calendarExport';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Agenda = () => {
  const { updateConsulta } = useDentalSystem();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isConsultaModalOpen, setIsConsultaModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [consultaFormDate, setConsultaFormDate] = useState<Date | undefined>(undefined);
  const [consultaFormTime, setConsultaFormTime] = useState<string | undefined>(undefined);
  const [consultaEmEdicao, setConsultaEmEdicao] = useState<any>(null);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [isPendentesModalOpen, setIsPendentesModalOpen] = useState(false);

  const carregarPendentes = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos_pendentes')
        .select('*')
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false });
      
      if (!error && data) {
        setPendentes(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    carregarPendentes();
    // Poderia adicionar realtime subscription aqui para atualizar automático
  }, []);

  const {
    view,
    setView,
    transformedConsultas,
    appointmentsForSelectedDate,
    handleStatusChange,
    handleConfirmacaoChange,
    handleDeleteAppointment
  } = useAgendaViews(selectedDate || new Date());

  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setIsDetailsModalOpen(true);
  };


  const handleNewAppointment = () => {
    setConsultaEmEdicao(null);
    setConsultaFormDate(selectedDate);
    setConsultaFormTime(undefined);
    setIsConsultaModalOpen(true);
  };

  const handleReschedule = (appointment: any) => {
    setIsDetailsModalOpen(false);
    // Busca a consulta completa (com pacienteId, observações, valor) pelo id
    const completa = transformedConsultas.find((c: any) => c.id === appointment.id) || appointment;
    setConsultaEmEdicao(completa);
    const data = completa.data ? new Date(completa.data) : selectedDate;
    setConsultaFormDate(data);
    setConsultaFormTime(completa.hora || appointment.time);
    setIsConsultaModalOpen(true);
  };

  const handleDateClick = (date: Date, time?: string) => {
    setSelectedDate(date);
    setView('day');
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleExportAgenda = () => {
    if (transformedConsultas.length === 0) {
      toast.info('Nenhuma consulta para exportar');
      return;
    }
    const eventos = transformedConsultas.map((c: any) => {
      const [h, m] = (c.hora || '08:00').split(':').map(Number);
      const inicio = new Date(c.data);
      inicio.setHours(h || 8, m || 0, 0, 0);
      return {
        id: c.id,
        titulo: `${c.procedimento || 'Consulta'} - ${c.patient}`,
        descricao: [c.dentista ? `Dentista: ${c.dentista}` : '', c.status ? `Status: ${c.status}` : '']
          .filter(Boolean)
          .join('\n'),
        inicio,
        duracaoMinutos: Number(c.duracao) || 60,
      };
    });
    downloadICS(eventos);
    toast.success('Agenda exportada! Importe o arquivo no Google Agenda ou Apple Calendário.');
  };


  const bigCalendarEvents = useMemo(() => {
    return transformedConsultas.map((c: any) => {
      const [h, m] = (c.hora || '08:00').split(':').map(Number);
      const start = new Date(c.data);
      start.setHours(h || 8, m || 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(start.getMinutes() + (Number(c.duracao) || 30));
      
      return {
        id: c.id,
        title: `${c.patient} - ${c.procedimento || 'Consulta'}`,
        start,
        end,
        resource: c
      };
    });
  }, [transformedConsultas]);

  const handleEventDropOrResize = async ({ event, start, end }: { event: any, start: Date, end: Date }) => {
    try {
      const novaData = format(start, 'yyyy-MM-dd');
      const novaHora = format(start, 'HH:mm');
      const duracaoMinutos = Math.round((end.getTime() - start.getTime()) / 60000);
      
      await updateConsulta(event.id, {
        data: novaData,
        hora: novaHora,
        duracao: duracaoMinutos
      });
      
      toast.success('Consulta reagendada com sucesso!');
    } catch (e) {
      toast.error('Erro ao reagendar consulta');
    }
  };

  const renderCurrentView = () => {
    if (!selectedDate) return null;

    return (
      <AgendaBigCalendar
        events={bigCalendarEvents}
        view={view as any}
        date={selectedDate}
        onNavigate={handleDateChange}
        onView={setView as any}
        onEventClick={(event) => handleAppointmentClick(event.resource)}
        onEventDrop={handleEventDropOrResize}
        onEventResize={handleEventDropOrResize}
        onSelectSlot={(slotInfo) => {
          setSelectedDate(slotInfo.start);
          handleNewAppointment();
        }}
      />
    );
  };

  return (
    <Layout>
      <div className="space-y-1 w-full max-w-none">
        {/* Header */}
        <div className="flex flex-col space-y-2 lg:flex-row lg:justify-between lg:items-start lg:space-y-0">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Agenda</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Gerencie seus agendamentos e consultas</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {pendentes.length > 0 && (
              <Button
                variant="destructive"
                className="flex items-center gap-2 flex-1 sm:flex-none justify-center animate-pulse"
                onClick={() => setIsPendentesModalOpen(true)}
              >
                <Bell className="h-4 w-4" />
                Aprovações ({pendentes.length})
              </Button>
            )}
            <Button
              variant="outline"
              className="flex items-center gap-2 flex-1 sm:flex-none justify-center"
              onClick={handleExportAgenda}
            >
              <CalendarDays className="h-4 w-4" />
              Exportar (.ics)
            </Button>
            <Button
              className="flex items-center gap-2 flex-1 sm:flex-none justify-center"
              onClick={handleNewAppointment}
            >
              <Plus className="h-4 w-4" />
              Nova Consulta
            </Button>
          </div>

        </div>

        <div className="flex flex-wrap gap-1 border-b border-border pb-2">
          <Button 
            variant={view === 'week' ? 'default' : 'outline'}
            onClick={() => setView('week')}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            Semana
          </Button>
          <Button 
            variant={view === 'day' ? 'default' : 'outline'}
            onClick={() => setView('day')}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            Dia
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

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-1 lg:gap-2">
          {view === 'day' && (
            <div className="lg:col-span-4 order-2 lg:order-1">
              <Card className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarDays className="h-5 w-5" />
                    Calendário
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-4">
                  <div className="w-full overflow-hidden">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleCalendarSelect}
                      locale={ptBR}
                      className="w-full max-w-none mx-auto"
                      modifiers={{
                        booked: transformedConsultas.map(c => new Date(c.data))
                      }}
                      modifiersClassNames={{
                        booked: "relative after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-blue-500 after:rounded-full font-bold"
                      }}
                      classNames={{
                        months: "flex flex-col space-y-4",
                        month: "space-y-4 w-full",
                        caption: "flex justify-center pt-1 relative items-center mb-4",
                        caption_label: "text-sm font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-border rounded-md",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex w-full",
                        head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] flex items-center justify-center h-8",
                        row: "flex w-full mt-2",
                        cell: "flex-1 h-8 sm:h-10 text-center text-sm p-0 relative flex items-center justify-center",
                        day: "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
                        day_selected: "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white font-bold",
                        day_today: "bg-accent text-accent-foreground font-semibold",
                        day_outside: "text-muted-foreground opacity-50 pointer-events-none",
                        day_disabled: "text-muted-foreground opacity-50",
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className={`${view === 'day' ? 'lg:col-span-8' : 'col-span-12'} order-1 lg:order-2`}>
            {renderCurrentView()}
          </div>
        </div>

        {/* Modals */}
        <ConsultaModal
          isOpen={isConsultaModalOpen}
          onClose={() => {
            setIsConsultaModalOpen(false);
            setConsultaFormDate(undefined);
            setConsultaFormTime(undefined);
            setConsultaEmEdicao(null);
          }}
          selectedDate={consultaFormDate}
          selectedTime={consultaFormTime}
          editingConsulta={consultaEmEdicao}
          onSaved={(data) => {
            setSelectedDate(data);
            setView('day');
          }}
        />

        <AppointmentDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          appointment={selectedAppointment}
          onEdit={handleReschedule}
          onDelete={handleDeleteAppointment}
          onStatusChange={handleStatusChange}
          onConfirmacaoChange={handleConfirmacaoChange}
          onReschedule={handleReschedule}
        />
        <PendentesModal
          isOpen={isPendentesModalOpen}
          onClose={() => setIsPendentesModalOpen(false)}
          pendentes={pendentes}
          onRefresh={carregarPendentes}
          onApprove={async (pendente) => {
            // Marca como aprovado no banco de dados para sumir da lista
            await supabase.from('agendamentos_pendentes').update({ status: 'aprovado' }).eq('id', pendente.id);
            carregarPendentes();
            
            // Set data for new appointment
            setConsultaEmEdicao({
              patient: pendente.nome,
              telefone: pendente.telefone,
              procedimento: pendente.motivo,
              observacoes: `[Agendamento Online] Motivo: ${pendente.motivo}`
            });
            const d = new Date(pendente.data);
            d.setDate(d.getDate() + 1); // Correção de fuso se necessário
            setConsultaFormDate(d);
            setConsultaFormTime(pendente.hora);
            
            setIsConsultaModalOpen(true);
          }}
        />
      </div>
    </Layout>
  );
};

export default Agenda;
