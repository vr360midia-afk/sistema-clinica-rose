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
  
  // Custom Event component
  const EventComponent = ({ event }: any) => {
    const resource = event.resource;
    const isCancelled = resource?.status === 'cancelado' || resource?.status === 'faltou';
    const isConfirmed = resource?.confirmacaoStatus === 'confirmado' || resource?.status === 'realizado';
    
    let bgClass = "bg-indigo-600";
    if (isCancelled) bgClass = "bg-red-500 line-through opacity-70";
    else if (isConfirmed) bgClass = "bg-emerald-600";
    else if (resource?.confirmacaoStatus === 'recusado') bgClass = "bg-orange-500 opacity-80";

    return (
      <div className={`h-full w-full ${bgClass} text-white px-1 overflow-hidden text-ellipsis whitespace-nowrap`} title={event.title}>
        <strong className="font-semibold text-xs">{event.title}</strong>
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
        step={30}
        timeslots={1}
        min={new Date(2020, 1, 1, 7, 0, 0)}
        max={new Date(2020, 1, 1, 20, 0, 0)}
      />
    </div>
  );
};
