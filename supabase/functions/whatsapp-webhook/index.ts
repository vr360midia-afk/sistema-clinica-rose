import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');

const twiml = (msg?: string) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg}</Message>` : ''}</Response>`,
    { headers: { 'Content-Type': 'text/xml' } },
  );

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const form = await req.formData();
    const from = onlyDigits(String(form.get('From') ?? ''));
    const to = onlyDigits(String(form.get('To') ?? ''));
    const body = String(form.get('Body') ?? '').trim();
    const profileName = String(form.get('ProfileName') ?? '') || null;
    const messageSid = String(form.get('MessageSid') ?? '') || null;
    const mediaUrl = String(form.get('MediaUrl0') ?? '') || null;

    if (!from) return twiml();

    // Descobre a clínica (user_id) pelo número que recebeu a mensagem
    let userId: string | null = null;
    const { data: configs } = await supabase
      .from('configuracoes')
      .select('user_id, whatsapp_numero, nome_clinica');

    if (configs?.length) {
      const match = configs.find(
        (c: any) => c.whatsapp_numero && onlyDigits(c.whatsapp_numero) === to,
      );
      userId = match?.user_id ?? (configs.length === 1 ? configs[0].user_id : null);
    }
    if (!userId) {
      console.error('Nenhuma clínica encontrada para o número', to);
      return twiml();
    }

    // Localiza o paciente pelo telefone (comparando os últimos 8 dígitos)
    const sufixo = from.slice(-8);
    const { data: pacientes } = await supabase
      .from('pacientes')
      .select('id, nome, telefone')
      .eq('user_id', userId);

    let paciente = (pacientes ?? []).find(
      (p: any) => p.telefone && onlyDigits(p.telefone).slice(-8) === sufixo,
    );

    // Número desconhecido -> cria lead
    if (!paciente) {
      const { data: novo, error: erroNovo } = await supabase
        .from('pacientes')
        .insert({
          user_id: userId,
          nome: profileName || `Lead WhatsApp ${from.slice(-4)}`,
          telefone: from,
          origem_lead: 'whatsapp',
          status: 'Ativo',
          observacoes: 'Cadastro automático a partir de mensagem no WhatsApp.',
        })
        .select('id, nome, telefone')
        .single();
      if (erroNovo) console.error('Erro ao criar lead:', erroNovo.message);
      paciente = novo ?? undefined;
    }

    await supabase.from('whatsapp_mensagens').insert({
      user_id: userId,
      paciente_id: paciente?.id ?? null,
      telefone: from,
      nome_contato: profileName || paciente?.nome || null,
      direcao: 'recebida',
      corpo: body,
      media_url: mediaUrl,
      status: 'recebida',
      message_sid: messageSid,
    });

    // Confirmação de consulta (SIM / NÃO)
    const texto = body
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const palavras = texto.split(' ');
    const positivas = ['sim', 's', 'confirmo', 'confirmar', 'confirmado', 'confirmada', 'ok', 'okay', 'pode', 'claro', 'vou', 'estarei', 'presente', 'certo', 'combinado'];
    const negativas = ['nao', 'n', 'cancelar', 'cancelo', 'cancelado', 'desmarca', 'desmarcar', 'remarcar', 'impossivel'];
    const temNegativa = palavras.some((p) => negativas.includes(p));
    const confirma = !temNegativa && palavras.some((p) => positivas.includes(p));
    const recusa = temNegativa;

    if (paciente && (confirma || recusa)) {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: consultas } = await supabase
        .from('consultas')
        .select('id, data, hora')
        .eq('user_id', userId)
        .eq('paciente_id', paciente.id)
        .gte('data', hoje)
        .order('data', { ascending: true })
        .limit(1);

      const consulta = consultas?.[0];
      if (consulta) {
        await supabase
          .from('consultas')
          .update({
            confirmacao_status: confirma ? 'confirmado' : 'recusado',
            confirmado_em: new Date().toISOString(),
            ...(recusa ? { status: 'cancelado' } : { status: 'confirmado' }),
          })
          .eq('id', consulta.id);

        const resposta = confirma
          ? 'Presença confirmada! Até breve. 😊'
          : 'Tudo bem, sua consulta foi cancelada. Entre em contato para reagendar.';

        await supabase.from('whatsapp_mensagens').insert({
          user_id: userId,
          paciente_id: paciente.id,
          telefone: from,
          direcao: 'enviada',
          corpo: resposta,
          status: 'automatica',
        });

        return twiml(resposta);
      }
    }

    return twiml();
  } catch (e) {
    console.error('Erro no webhook do WhatsApp:', e);
    return twiml();
  }
});
