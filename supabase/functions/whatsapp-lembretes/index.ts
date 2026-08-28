import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    return new Response(JSON.stringify({ error: 'Twilio não conectado' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let enviados = 0;

  const { data: configs } = await supabase
    .from('configuracoes')
    .select('user_id, nome_clinica, whatsapp_numero, whatsapp_lembretes, lembrete_24h');

  for (const cfg of configs ?? []) {
    const from = onlyDigits(cfg.whatsapp_numero ?? '');
    if (!from || !cfg.whatsapp_lembretes || !cfg.lembrete_24h) continue;

    const { data: consultas } = await supabase
      .from('consultas')
      .select('id, hora, procedimento, dentista, paciente_id, paciente_nome')
      .eq('user_id', cfg.user_id)
      .eq('data', amanha)
      .neq('status', 'cancelado');

    for (const c of consultas ?? []) {
      if (!c.paciente_id) continue;
      const { data: paciente } = await supabase
        .from('pacientes')
        .select('telefone, nome')
        .eq('id', c.paciente_id)
        .maybeSingle();

      const to = onlyDigits(paciente?.telefone ?? '');
      if (!to || to.length < 10) continue;

      const corpo = [
        `Olá${paciente?.nome ? `, ${paciente.nome}` : ''}!`,
        '',
        `Lembrete da sua consulta${cfg.nome_clinica ? ` na ${cfg.nome_clinica}` : ''}:`,
        `Data: ${amanha.split('-').reverse().join('/')}`,
        c.hora ? `Horário: ${c.hora}` : null,
        c.procedimento ? `Procedimento: ${c.procedimento}` : null,
        '',
        'Responda *SIM* para confirmar ou *NÃO* para cancelar.',
      ]
        .filter(Boolean)
        .join('\n');

      const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:+${to.startsWith('55') ? to : `55${to}`}`,
          From: `whatsapp:+${from}`,
          Body: corpo,
        }),
      });

      if (!resp.ok) {
        console.error(`Lembrete falhou [${resp.status}]: ${await resp.text()}`);
        continue;
      }

      const result = await resp.json();
      await supabase.from('whatsapp_mensagens').insert({
        user_id: cfg.user_id,
        paciente_id: c.paciente_id,
        telefone: to,
        direcao: 'enviada',
        corpo,
        status: 'lembrete',
        message_sid: result.sid ?? null,
      });
      enviados++;
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
