interface AgendaEvento {
  id: string;
  titulo: string;
  descricao?: string;
  inicio: Date;
  duracaoMinutos?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

const toICSDate = (date: Date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes()
  )}00Z`;

const escapeText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export const buildICS = (eventos: AgendaEvento[]): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dental IA//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Agenda Dental IA',
  ];

  eventos.forEach((evento) => {
    const fim = new Date(evento.inicio.getTime() + (evento.duracaoMinutos ?? 60) * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${evento.id}@dental-ia`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(evento.inicio)}`,
      `DTEND:${toICSDate(fim)}`,
      `SUMMARY:${escapeText(evento.titulo)}`,
      ...(evento.descricao ? [`DESCRIPTION:${escapeText(evento.descricao)}`] : []),
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lembrete de consulta',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const downloadICS = (eventos: AgendaEvento[], filename = 'agenda-dental-ia.ics') => {
  const blob = new Blob([buildICS(eventos)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const googleCalendarUrl = (evento: AgendaEvento) => {
  const fim = new Date(evento.inicio.getTime() + (evento.duracaoMinutos ?? 60) * 60000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: evento.titulo,
    dates: `${toICSDate(evento.inicio).replace(/-|:/g, '')}/${toICSDate(fim)}`,
    details: evento.descricao || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
