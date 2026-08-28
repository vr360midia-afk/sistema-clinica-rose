import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Não autenticado' }, 401);
    const userId = userData.user.id;

    const { telefone, mensagem, pacienteId } = await req.json();
    const numero = String(telefone ?? '').replace(/\D/g, '');
    const texto = String(mensagem ?? '').trim();
    if (!numero || numero.length < 10) return json({ error: 'Telefone inválido' }, 400);
    if (!texto) return json({ error: 'Mensagem vazia' }, 400);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return json({ error: 'Conexão do WhatsApp (Twilio) não configurada' }, 400);
    }

    const { data: config } = await supabase
      .from('configuracoes')
      .select('whatsapp_numero')
      .eq('user_id', userId)
      .maybeSingle();

    const fromNumero = String(config?.whatsapp_numero ?? '').replace(/\D/g, '');
    if (!fromNumero) {
      return json({ error: 'Cadastre o número do WhatsApp da clínica em Configurações' }, 400);
    }

    const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: `whatsapp:+${numero}`,
        From: `whatsapp:+${fromNumero}`,
        Body: texto,
      }),
    });

    if (!resp.ok) {
      const details = await resp.text();
      console.error(`Falha no envio [${resp.status}]: ${details}`);
      return json({ error: 'Falha ao enviar', status: resp.status, details }, resp.status);
    }

    const result = await resp.json();

    await supabase.from('whatsapp_mensagens').insert({
      user_id: userId,
      paciente_id: pacienteId ?? null,
      telefone: numero,
      direcao: 'enviada',
      corpo: texto,
      status: 'enviada',
      message_sid: result.sid ?? null,
    });

    return json({ ok: true, sid: result.sid });
  } catch (e) {
    console.error('Erro ao enviar WhatsApp:', e);
    return json({ error: e instanceof Error ? e.message : 'Erro desconhecido' }, 500);
  }
});
