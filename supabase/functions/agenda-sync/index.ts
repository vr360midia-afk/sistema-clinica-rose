import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Formatar data para iCal (YYYYMMDDTHHMMSSZ)
const formatICalDate = (date: Date) => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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

    // Buscar consultas futuras e do último mês
    const hojeMenos30 = new Date();
    hojeMenos30.setDate(hojeMenos30.getDate() - 30);
    
    const { data: consultas, error } = await supabaseAdmin
      .from('consultas')
      .select('*, pacientes(nome, telefone)')
      .eq('user_id', clinicId)
      .gte('data', hojeMenos30.toISOString().split('T')[0])
      .neq('status', 'cancelado')
      .neq('status', 'faltou');

    if (error) {
      throw error;
    }

    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sistema Clinica//Agenda//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Agenda da Clínica',
      'X-WR-TIMEZONE:America/Sao_Paulo'
    ];

    for (const c of consultas) {
      // Ajustar fuso horário do Brasil
      const startDateTime = new Date(`${c.data}T${c.hora}:00-03:00`);
      const endDateTime = new Date(startDateTime.getTime() + (c.duracao || 30) * 60000);
      
      const pacienteNome = c.pacientes?.nome || 'Paciente sem nome';
      const observacoesLimpa = (c.observacoes || '').replace(/\n/g, '\\n');
      
      icalContent.push(
        'BEGIN:VEVENT',
        `UID:${c.id}@sistemaclinica.com`,
        `DTSTAMP:${formatICalDate(new Date())}`,
        `DTSTART:${formatICalDate(startDateTime)}`,
        `DTEND:${formatICalDate(endDateTime)}`,
        `SUMMARY:${pacienteNome} - ${c.procedimento || 'Consulta'}`,
        `DESCRIPTION:Paciente: ${pacienteNome}\\nStatus: ${c.status}\\nObs: ${observacoesLimpa}`,
        'END:VEVENT'
      );
    }

    icalContent.push('END:VCALENDAR');

    return new Response(icalContent.join('\r\n'), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="agenda.ics"'
      },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
