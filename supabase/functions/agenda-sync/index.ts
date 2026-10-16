import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Formatar data e hora UTC para iCal (YYYYMMDDTHHMMSSZ)
const formatICalDate = (date: Date) => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

// Formatar data apenas (YYYYMMDD) para eventos de dia inteiro
const formatICalDateOnly = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
};

const escapeICalText = (text: string) => {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const clinicId = url.searchParams.get('token');

    if (!clinicId) {
      return new Response("Missing token", { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar consultas e bloqueios futuros e do último mês (30 dias atrás)
    const hojeMenos30 = new Date();
    hojeMenos30.setDate(hojeMenos30.getDate() - 30);
    const dataMinimaStr = hojeMenos30.toISOString().split('T')[0];
    
    const { data: consultas, error: consultasError } = await supabaseAdmin
      .from('consultas')
      .select('*, pacientes(nome, telefone)')
      .eq('user_id', clinicId)
      .gte('data', dataMinimaStr)
      .neq('status', 'cancelado')
      .neq('status', 'faltou');

    if (consultasError) {
      throw consultasError;
    }

    // Buscar bloqueios de horários da agenda (férias, almoço, reuniões, etc.)
    const { data: bloqueios, error: bloqueiosError } = await supabaseAdmin
      .from('bloqueios_agenda')
      .select('*')
      .eq('user_id', clinicId)
      .or(`data_fim.gte.${dataMinimaStr},data_inicio.gte.${dataMinimaStr}`);

    if (bloqueiosError) {
      console.error('Erro ao buscar bloqueios_agenda:', bloqueiosError);
    }

    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sistema Clinica//Agenda//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Agenda da Clínica',
      'X-WR-TIMEZONE:America/Sao_Paulo'
    ];

    // 1. Inserir Consultas dos Pacientes
    for (const c of (consultas || [])) {
      const horaStr = c.hora || '08:00';
      const startDateTime = new Date(`${c.data}T${horaStr}:00-03:00`);
      const endDateTime = new Date(startDateTime.getTime() + (c.duracao || 30) * 60000);
      
      const pacienteNome = c.pacientes?.nome || 'Paciente';
      const observacoesLimpa = escapeICalText(c.observacoes || '');
      const dentista = escapeICalText(c.dentista || '');
      
      icalContent.push(
        'BEGIN:VEVENT',
        `UID:${c.id}@sistemaclinica.com`,
        `DTSTAMP:${formatICalDate(new Date())}`,
        `DTSTART:${formatICalDate(startDateTime)}`,
        `DTEND:${formatICalDate(endDateTime)}`,
        `SUMMARY:🦷 ${escapeICalText(pacienteNome)} - ${escapeICalText(c.procedimento || 'Consulta')}`,
        `DESCRIPTION:Paciente: ${escapeICalText(pacienteNome)}\\nProcedimento: ${escapeICalText(c.procedimento || 'Consulta')}${dentista ? `\\nDentista: ${dentista}` : ''}\\nStatus: ${escapeICalText(c.status || 'agendado')}${observacoesLimpa ? `\\nObs: ${observacoesLimpa}` : ''}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    }

    // 2. Inserir Bloqueios de Horários (Férias, Almoço, Intervalos)
    for (const b of (bloqueios || [])) {
      if (!b.data_inicio) continue;
      const dataInicioStr = b.data_inicio;
      const dataFimStr = b.data_fim || dataInicioStr;
      const titulo = b.titulo || 'Bloqueio de Agenda';
      const dentistaInfo = b.dentista ? ` (${b.dentista})` : '';
      const obsLimpa = escapeICalText(b.observacoes || '');

      if (b.dia_inteiro) {
        // Bloqueio de dia inteiro (all-day)
        const dInicio = new Date(`${dataInicioStr}T00:00:00-03:00`);
        const dFim = new Date(`${dataFimStr}T00:00:00-03:00`);
        dFim.setDate(dFim.getDate() + 1); // DTEND exclusivo conforme RFC 5545 para dia inteiro

        icalContent.push(
          'BEGIN:VEVENT',
          `UID:bloqueio-${b.id}@sistemaclinica.com`,
          `DTSTAMP:${formatICalDate(new Date())}`,
          `DTSTART;VALUE=DATE:${formatICalDateOnly(dInicio)}`,
          `DTEND;VALUE=DATE:${formatICalDateOnly(dFim)}`,
          `SUMMARY:🔒 Bloqueio: ${escapeICalText(titulo)}${escapeICalText(dentistaInfo)}`,
          `DESCRIPTION:Horário Bloqueado na Agenda\\nDentista: ${escapeICalText(b.dentista || 'Todos')}\\nMotivo: ${obsLimpa || 'Bloqueio administrativo'}`,
          'STATUS:CONFIRMED',
          'TRANSP:OPAQUE',
          'END:VEVENT'
        );
      } else {
        // Bloqueio com horários específicos (ex: 12:00 às 14:00)
        const horaInicio = b.hora_inicio || '08:00';
        const horaFim = b.hora_fim || '18:00';

        const curDate = new Date(`${dataInicioStr}T00:00:00-03:00`);
        const finalDate = new Date(`${dataFimStr}T00:00:00-03:00`);

        let count = 0;
        while (curDate <= finalDate && count < 90) {
          const year = curDate.getFullYear();
          const month = String(curDate.getMonth() + 1).padStart(2, '0');
          const day = String(curDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          const startDateTime = new Date(`${dateStr}T${horaInicio}:00-03:00`);
          const endDateTime = new Date(`${dateStr}T${horaFim}:00-03:00`);

          icalContent.push(
            'BEGIN:VEVENT',
            `UID:bloqueio-${b.id}-${dateStr}@sistemaclinica.com`,
            `DTSTAMP:${formatICalDate(new Date())}`,
            `DTSTART:${formatICalDate(startDateTime)}`,
            `DTEND:${formatICalDate(endDateTime)}`,
            `SUMMARY:🔒 Bloqueio: ${escapeICalText(titulo)}${escapeICalText(dentistaInfo)}`,
            `DESCRIPTION:Horário Bloqueado na Agenda\\nDentista: ${escapeICalText(b.dentista || 'Todos')}\\nHorário: ${horaInicio} às ${horaFim}\\nMotivo: ${obsLimpa || 'Bloqueio administrativo'}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'END:VEVENT'
          );

          curDate.setDate(curDate.getDate() + 1);
          count++;
        }
      }
    }

    icalContent.push('END:VCALENDAR');

    return new Response(icalContent.join('\r\n'), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="agenda.ics"'
      },
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
