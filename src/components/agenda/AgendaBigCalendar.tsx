import React, { useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views, Event as CalendarEvent } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './AgendaBigCalendar.css';

const locales = {
  'pt-BR': ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar as any);

interface AgendaBigCalendarProps {
  events: any[];
  view: 'month' | 'week' | 'day';
  date: Date;
  onNavigate: (date: Date) => void;
  onView: (view: 'month' | 'week' | 'day') => void;
  onEventClick: (event: any) => void;
  onEventDrop: (args: { event: any; start: Date; end: Date }) => void;
  onEventResize?: (args: { event: any; start: Date; end: Date }) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
}

export const AgendaBigCalendar = ({
  events,
  view,
  date,
  onNavigate,
  onView,
  onEventClick,
  onEventDrop,
  onEventResize,
  onSelectSlot
}: AgendaBigCalendarProps) => {
  
  // Propriedades visuais do evento (fundo, bordas, sombras)
  const eventPropGetter = useCallback((event: any) => {
    const resource = event.resource;
    const isCancelled = resource?.status === 'cancelado' || resource?.status === 'faltou';
    const isConfirmed = resource?.confirmacaoStatus === 'confirmado' || resource?.status === 'realizado';
    
    let backgroundColor = "#4f46e5"; // indigo-600
    if (isCancelled) backgroundColor = "#ef4444"; // red-500
    else if (isConfirmed) backgroundColor = "#059669"; // emerald-600
    else if (resource?.confirmacaoStatus === 'recusado') backgroundColor = "#f97316"; // orange-500

    return {
      style: {
        backgroundColor,
        color: '#ffffff',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
      }
    };
  }, []);

  // Custom Event component
  const EventComponent = ({ event }: any) => {
    const resource = event.resource;

    return (
      <div
        className="w-full h-full flex flex-col justify-between overflow-hidden select-none"
        title={`${event.title} • Puxe a seta no topo ou base para ajustar a duração`}
      >
        <span className="font-semibold text-xs leading-tight truncate">
          {event.title}
        </span>
        {resource?.duracao ? (
          <span className="text-[10px] opacity-90 font-medium tracking-tight mt-0.5">
            ⏱ {resource.duracao} min
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border overflow-hidden">
      <DnDCalendar
        localizer={localizer}
        events={events}
        date={date}
        view={view as any}
        onNavigate={onNavigate}
        onView={onView as any}
        onSelectEvent={onEventClick}
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        onSelectSlot={onSelectSlot}
        selectable
        resizable
        eventPropGetter={eventPropGetter}
        components={{
          event: EventComponent
        }}
        messages={{
          next: "Próximo",
          previous: "Anterior",
          today: "Hoje",
          month: "Mês",
          week: "Semana",
          day: "Dia",
          agenda: "Agenda",
          date: "Data",
          time: "Hora",
          event: "Evento",
          noEventsInRange: "Não há consultas neste período.",
          showMore: (total) => `+ ${total} consultas`
        }}
        toolbar={false}
        step={15}
        timeslots={2}
        min={new Date(2020, 1, 1, 7, 0, 0)}
        max={new Date(2020, 1, 1, 20, 0, 0)}
      />
    </div>
  );
};
