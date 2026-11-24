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

// Helper para extrair dia, mês e ano de nascimento
const parseNascimento = (rawDate: string): { dia: number; mes: number; anoNasc: number | null } | null => {
  if (!rawDate) return null;
  const clean = rawDate.split('T')[0].trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        return { dia: d, mes: m, anoNasc: !isNaN(y) && y > 1900 && y < 2100 ? y : null };
      }
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length >= 2) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parts[2] ? parseInt(parts[2], 10) : null;
      if (!isNaN(d) && !isNaN(m) && d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        return { dia: d, mes: m, anoNasc: y && !isNaN(y) && y > 1900 && y < 2100 ? y : null };
      }
    }
  }
  return null;
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    if (!UUID_REGEX.test(clinicId)) {
      return new Response(JSON.stringify({ error: "Token invalido. Formato UUID esperado." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
      // 1. Caso clinicId seja um membro secundário, descobre o clinica_id principal
      const { data: memberOf } = await supabaseAdmin
        .from('user_roles')
        .select('clinica_id')
        .eq('user_id', clinicId)
        .maybeSingle();

      const mainClinicaId = memberOf?.clinica_id || clinicId;
      if (mainClinicaId && !userIds.includes(mainClinicaId)) {
        userIds.push(mainClinicaId);
      }

      // 2. Descobre todos os outros usuários vinculados a essa mesma clínica
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('clinica_id', mainClinicaId);

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
    const { data: bloqueiosRaw, error: bloqueiosError } = await supabaseAdmin
      .from('bloqueios_agenda')
      .select('*')
      .or(`data_fim.gte.${dataMinimaStr},data_inicio.gte.${dataMinimaStr}`);

    if (bloqueiosError) {
      console.error('Erro ao buscar bloqueios_agenda:', bloqueiosError);
    }

    // Filtrar bloqueios pertencentes aos usuários da clínica ou globais (sem user_id explícito)
    const bloqueios = (bloqueiosRaw || []).filter((b: any) => {
      if (!b.user_id) return true; // Bloqueio global da clínica
      return userIds.includes(b.user_id);
    });

    // 3. Buscar pacientes com data de nascimento cadastrada (Aniversários)
    let pacientes: any[] = [];
    try {
      let queryPacientes = supabaseAdmin
        .from('pacientes')
        .select('id, nome, telefone, data_nascimento, status, user_id')
        .not('data_nascimento', 'is', null);

      if (userIds && userIds.length > 0) {
        queryPacientes = queryPacientes.or(`user_id.in.(${userIds.join(',')}),user_id.is.null`);
      }

      const { data: pacientesData, error: pacientesError } = await queryPacientes;
      if (pacientesError) {
        console.warn('Erro ao buscar pacientes para aniversários:', pacientesError);
      } else {
        pacientes = (pacientesData || []).filter(
          (p: any) => p && p.data_nascimento && p.status?.toLowerCase() !== 'arquivado'
        );
      }
    } catch (ePac) {
      console.warn('Exceção ao buscar aniversários de pacientes:', ePac);
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

    // 2. Inserir Bloqueios de Horários (Férias, Almoço, Intervalos, Reuniões)
    for (const b of (bloqueios || [])) {
      try {
        if (!b.data_inicio) continue;
        const dataInicioStr = b.data_inicio;
        const dataFimStr = b.data_fim || dataInicioStr;
        const titulo = b.titulo || 'Bloqueio de Agenda';
        const dentistaInfo = b.dentista && b.dentista.toLowerCase() !== 'todos' ? ` (${b.dentista})` : '';
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

    // 3. Inserir Aniversários dos Pacientes (com bolinho 🎂 em destaque nas agendas de iPhone / Apple Calendar)
    const currentYear = new Date().getFullYear();
    const anosAlvo = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

    for (const p of pacientes) {
      try {
        const infoNasc = parseNascimento(p.data_nascimento);
        if (!infoNasc) continue;

        const { dia, mes, anoNasc } = infoNasc;
        const pacienteNome = p.nome || 'Paciente';
        const telefoneRaw = (p.telefone || '').replace(/\D/g, '');
        const dataNascFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}${anoNasc ? `/${anoNasc}` : ''}`;

        for (const ano of anosAlvo) {
          // Tratar 29 de fevereiro em anos não-bissextos (passar para dia 28)
          let diaAjustado = dia;
          if (mes === 2 && dia === 29) {
            const isBissexto = (ano % 4 === 0 && ano % 100 !== 0) || (ano % 400 === 0);
            if (!isBissexto) diaAjustado = 28;
          }

          const mesStr = String(mes).padStart(2, '0');
          const diaStr = String(diaAjustado).padStart(2, '0');
          const dataEventoStr = `${ano}-${mesStr}-${diaStr}`;
          const dtStartOnly = `${ano}${mesStr}${diaStr}`;
          const dtEndOnly = getNextDayDateOnly(dataEventoStr);

          // Calcular idade que o paciente comemora naquele ano
          let idadeTexto = '';
          let idadeInfo = '';
          if (anoNasc && ano >= anoNasc) {
            const idade = ano - anoNasc;
            if (idade > 0) {
              idadeTexto = ` (${idade} anos)`;
              idadeInfo = `\\n🎉 Idade: ${idade} anos`;
            }
          }

          const summary = `🎂 Aniversário: ${escapeICalText(pacienteNome)}${escapeICalText(idadeTexto)}`;
          
          const descParts = [
            `🎂 Aniversário de ${escapeICalText(pacienteNome)}`,
            idadeInfo,
            `📅 Data de Nascimento: ${dataNascFormatada}`,
            p.telefone ? `📱 Telefone: ${escapeICalText(p.telefone)}` : '',
            telefoneRaw ? `💬 WhatsApp: https://wa.me/55${telefoneRaw}` : '',
            `✨ Lembrete sincronizado Dental IA / Clínica Roseane`
          ].filter(Boolean);

          icalContent.push(
            'BEGIN:VEVENT',
            `UID:aniversario-${p.id}-${ano}@sistemaclinica.com`,
            `DTSTAMP:${nowFormatted}`,
            `DTSTART;VALUE=DATE:${dtStartOnly}`,
            `DTEND;VALUE=DATE:${dtEndOnly}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${descParts.join('\\n')}`,
            'STATUS:CONFIRMED',
            'TRANSP:TRANSPARENT',
            'CATEGORIES:BIRTHDAY,ANNIVERSARY',
            'END:VEVENT'
          );
        }
      } catch (errNasc) {
        console.warn('Erro ao processar aniversário para iCal:', p.id, errNasc);
      }
    }

    icalContent.push('END:VCALENDAR');

    return new Response(icalContent.join('\r\n'), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="agenda.ics"',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
