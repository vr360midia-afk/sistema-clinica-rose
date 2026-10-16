import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Formatar data e hora UTC para iCal (YYYYMMDDTHHMMSSZ)
const formatICalDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

// Formatar data YYYY-MM-DD para iCal DATE puro (YYYYMMDD)
const formatICalDateOnly = (dateStr: string): string => {
  return dateStr.replace(/-/g, '');
};

// Obter próximo dia em formato YYYYMMDD para DTEND exclusivo de eventos all-day (RFC 5545)
const getNextDayDateOnly = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const nextY = dt.getUTCFullYear();
  const nextM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(dt.getUTCDate()).padStart(2, '0');
  return `${nextY}${nextM}${nextD}`;
};

// Normalizar horário garantindo formato HH:mm:ss
const normalizeTime = (timeStr?: string | null, fallback = '08:00:00'): string => {
  if (!timeStr) return fallback;
  const parts = timeStr.trim().split(':');
  const hh = (parts[0] || '08').padStart(2, '0');
  const mm = (parts[1] || '00').padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

// Criar objeto Date seguro com fuso horário de Brasília (-03:00)
const buildSafeDate = (dateStr: string, timeStr?: string | null, fallbackTime = '08:00:00'): Date | null => {
  try {
    const time = normalizeTime(timeStr, fallbackTime);
    const dt = new Date(`${dateStr}T${time}-03:00`);
    if (isNaN(dt.getTime())) return null;
    return dt;
  } catch {
    return null;
  }
};

const escapeICalText = (text: string): string => {
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

    // Descobrir todos os user_ids relacionados à clínica (caso secretária/dentista tenha criado com outro user_id)
    const userIds = [clinicId];
    try {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('clinica_id', clinicId);

      if (roles && roles.length > 0) {
        roles.forEach((r: any) => {
          if (r.user_id && !userIds.includes(r.user_id)) {
            userIds.push(r.user_id);
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao verificar user_roles secundários:', e);
    }
    
    // 1. Buscar consultas dos pacientes
    const { data: consultas, error: consultasError } = await supabaseAdmin
      .from('consultas')
      .select('*, pacientes(nome, telefone)')
      .in('user_id', userIds)
      .gte('data', dataMinimaStr)
      .neq('status', 'cancelado')
      .neq('status', 'faltou');

    if (consultasError) {
      console.error('Erro ao buscar consultas:', consultasError);
      throw consultasError;
    }

    // 2. Buscar bloqueios de horários da agenda (férias, almoço, reuniões, ausências, etc.)
    const { data: bloqueios, error: bloqueiosError } = await supabaseAdmin
      .from('bloqueios_agenda')
      .select('*')
      .in('user_id', userIds)
      .or(`data_fim.gte.${dataMinimaStr},data_inicio.gte.${dataMinimaStr}`);

    if (bloqueiosError) {
      console.error('Erro ao buscar bloqueios_agenda:', bloqueiosError);
    }

    const icalContent: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sistema Clinica//Agenda//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Agenda da Clínica',
      'X-WR-TIMEZONE:America/Sao_Paulo',
      'X-PUBLISHED-TTL:PT15M',
      'REFRESH-INTERVAL;VALUE=DURATION:PT15M'
    ];

    const nowFormatted = formatICalDate(new Date());

    // 1. Inserir Consultas dos Pacientes
    for (const c of (consultas || [])) {
      try {
        if (!c.data) continue;
        const startDateTime = buildSafeDate(c.data, c.hora, '08:00:00');
        if (!startDateTime) continue;

        const duracaoMinutos = Number(c.duracao) || 30;
        const endDateTime = new Date(startDateTime.getTime() + duracaoMinutos * 60000);
        
        const pacienteNome = c.pacientes?.nome || c.paciente_nome || 'Paciente';
        const observacoesLimpa = escapeICalText(c.observacoes || '');
        const dentista = escapeICalText(c.dentista || '');
        const procedimento = escapeICalText(c.procedimento || 'Consulta');
        
        icalContent.push(
          'BEGIN:VEVENT',
          `UID:consulta-${c.id}@sistemaclinica.com`,
          `DTSTAMP:${nowFormatted}`,
          `DTSTART:${formatICalDate(startDateTime)}`,
          `DTEND:${formatICalDate(endDateTime)}`,
          `SUMMARY:🦷 ${escapeICalText(pacienteNome)} - ${procedimento}`,
          `DESCRIPTION:Paciente: ${escapeICalText(pacienteNome)}\\nProcedimento: ${procedimento}${dentista ? `\\nDentista: ${dentista}` : ''}\\nStatus: ${escapeICalText(c.status || 'agendado')}${observacoesLimpa ? `\\nObs: ${observacoesLimpa}` : ''}`,
          'STATUS:CONFIRMED',
          'TRANSP:OPAQUE',
          'END:VEVENT'
        );
      } catch (errItem) {
        console.warn('Erro ao processar consulta para iCal:', c.id, errItem);
      }
    }

    // 2. Inserir Bloqueios de Horários (Férias, Almoço, Intervalos)
    for (const b of (bloqueios || [])) {
      try {
        if (!b.data_inicio) continue;
        const dataInicioStr = b.data_inicio;
        const dataFimStr = b.data_fim || dataInicioStr;
        const titulo = b.titulo || 'Bloqueio de Agenda';
        const dentistaInfo = b.dentista ? ` (${b.dentista})` : '';
        const obsLimpa = escapeICalText(b.observacoes || '');
        const summary = `🔒 Bloqueio: ${escapeICalText(titulo)}${escapeICalText(dentistaInfo)}`;

        if (b.dia_inteiro) {
          // Bloqueio de dia inteiro (all-day): RFC 5545 DATE puro com DTEND exclusivo
          const dtStartOnly = formatICalDateOnly(dataInicioStr);
          const dtEndOnly = getNextDayDateOnly(dataFimStr);

          icalContent.push(
            'BEGIN:VEVENT',
            `UID:bloqueio-${b.id}@sistemaclinica.com`,
            `DTSTAMP:${nowFormatted}`,
            `DTSTART;VALUE=DATE:${dtStartOnly}`,
            `DTEND;VALUE=DATE:${dtEndOnly}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:Horário Bloqueado na Agenda\\nDentista: ${escapeICalText(b.dentista || 'Todos')}\\nMotivo: ${obsLimpa || 'Bloqueio administrativo'}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'END:VEVENT'
          );
        } else {
          // Bloqueio com horários específicos (ex: 12:00 às 13:00)
          const horaInicio = b.hora_inicio || '08:00';
          const horaFim = b.hora_fim || '18:00';

          const [anoI, mesI, diaI] = dataInicioStr.split('-').map(Number);
          const [anoF, mesF, diaF] = dataFimStr.split('-').map(Number);
          const curDate = new Date(anoI, mesI - 1, diaI);
          const finalDate = new Date(anoF, mesF - 1, diaF);

          let count = 0;
          while (curDate <= finalDate && count < 90) {
            const year = curDate.getFullYear();
            const month = String(curDate.getMonth() + 1).padStart(2, '0');
            const day = String(curDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const startDateTime = buildSafeDate(dateStr, horaInicio, '08:00:00');
            const endDateTime = buildSafeDate(dateStr, horaFim, '18:00:00');

            if (startDateTime && endDateTime) {
              icalContent.push(
                'BEGIN:VEVENT',
                `UID:bloqueio-${b.id}-${dateStr}@sistemaclinica.com`,
                `DTSTAMP:${nowFormatted}`,
                `DTSTART:${formatICalDate(startDateTime)}`,
                `DTEND:${formatICalDate(endDateTime)}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:Horário Bloqueado na Agenda\\nDentista: ${escapeICalText(b.dentista || 'Todos')}\\nHorário: ${horaInicio} às ${horaFim}\\nMotivo: ${obsLimpa || 'Bloqueio administrativo'}`,
                'STATUS:CONFIRMED',
                'TRANSP:OPAQUE',
                'END:VEVENT'
              );
            }

            curDate.setDate(curDate.getDate() + 1);
            count++;
          }
        }
      } catch (errBloq) {
        console.warn('Erro ao processar bloqueio para iCal:', b.id, errBloq);
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
