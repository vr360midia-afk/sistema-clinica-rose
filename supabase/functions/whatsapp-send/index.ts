import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function formatPhoneForMeta(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';

  // Formato nacional brasileiro para E.164 sem o '+' para a Graph API
  if (digits.startsWith('55')) {
    const dddAndNum = digits.slice(2);
    if (dddAndNum.length === 10) {
      const ddd = dddAndNum.slice(0, 2);
      const num = dddAndNum.slice(2);
      return `55${ddd}9${num}`;
    }
    return digits;
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    return `55${ddd}9${num}`;
  }
  if (digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  try {
    // 1. Validação de Autenticação do Usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Não autorizado. Faça login para enviar mensagens.' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Valida o token JWT do usuário no Supabase Auth
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return jsonResponse({ error: 'Sessão expirada ou usuário não autenticado.' }, 401);
    }

    // 2. Extrai e valida o corpo da requisição
    const body = await req.json();
    const { lead_id, text, phone: providedPhone } = body;

    const messageText = (text || '').trim();
    if (!messageText) {
      return jsonResponse({ error: 'O texto da mensagem não pode ser vazio.' }, 400);
    }

    if (!lead_id && !providedPhone) {
      return jsonResponse({ error: 'Informe o lead_id ou o telefone do destinatário.' }, 400);
    }

    // Busca dados do Lead se informado lead_id
    let targetPhone = providedPhone;
    let leadCurrentStage = 'novo_lead';
    let resolvedLeadId = lead_id;

    if (lead_id) {
      const { data: lead, error: leadErr } = await supabase
        .from('crm_leads')
        .select('id, phone, telefone, stage, status')
        .eq('id', lead_id)
        .single();

      if (leadErr || !lead) {
        return jsonResponse({ error: 'Lead não encontrado.' }, 404);
      }

      targetPhone = lead.phone || lead.telefone || providedPhone;
      leadCurrentStage = lead.stage || lead.status || 'novo_lead';
      resolvedLeadId = lead.id;
    }

    if (!targetPhone) {
      return jsonResponse({ error: 'Este lead não possui número de telefone cadastrado.' }, 400);
    }

    const recipientPhone = formatPhoneForMeta(targetPhone);
    if (!recipientPhone || recipientPhone.length < 10) {
      return jsonResponse({ error: 'Número de telefone inválido para envio via WhatsApp.' }, 400);
    }

    // 3. Configurações da Meta Cloud API
    const WA_TOKEN = Deno.env.get('WA_TOKEN') || '';
    const WA_PHONE_NUMBER_ID = Deno.env.get('WA_PHONE_NUMBER_ID') || '';

    if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
      return jsonResponse(
        {
          error:
            'Variáveis WA_TOKEN e WA_PHONE_NUMBER_ID não configuradas nas Edge Functions da Meta.',
        },
        500
      );
    }

    // 4. Envio pela Meta Cloud API (Graph API v21.0)
    const graphApiUrl = `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`;
    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { body: messageText },
    };

    const metaRes = await fetch(graphApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaPayload),
    });

    const metaJson = await metaRes.json();

    if (!metaRes.ok || metaJson.error) {
      console.error('[WhatsApp Send] Erro retornado pela Meta Graph API:', metaJson.error?.message);
      return jsonResponse(
        {
          error:
            metaJson.error?.message ||
            'Erro ao enviar mensagem pelo WhatsApp Cloud API. Verifique janela de 24h ou créditos da Meta.',
          details: metaJson.error,
        },
        400
      );
    }

    const waMessageId = metaJson.messages?.[0]?.id || `wamid_${Date.now()}`;
    const nowIso = new Date().toISOString();

    // 5. Salva na tabela crm_messages
    let savedMessage = null;
    if (resolvedLeadId) {
      const { data: msgData, error: msgErr } = await supabase
        .from('crm_messages')
        .insert([
          {
            lead_id: resolvedLeadId,
            direction: 'out',
            body: messageText,
            wa_message_id: waMessageId,
            created_at: nowIso,
          },
        ])
        .select()
        .single();

      if (!msgErr) savedMessage = msgData;

      // 6. Atualiza o lead: last_outbound_at e stage (novo_lead vira primeiro_contato)
      const nextStage =
        leadCurrentStage === 'novo_lead' || leadCurrentStage === 'novo'
          ? 'primeiro_contato'
          : leadCurrentStage;

      await supabase
        .from('crm_leads')
        .update({
          last_outbound_at: nowIso,
          stage: nextStage,
          status: nextStage,
          updated_at: nowIso,
        })
        .eq('id', resolvedLeadId);
    }

    return jsonResponse({
      success: true,
      wa_message_id: waMessageId,
      message: savedMessage,
    });
  } catch (err: any) {
    console.error('[WhatsApp Send] Exceção interna:', err.message);
    return jsonResponse({ error: err.message || 'Erro interno ao processar envio.' }, 500);
  }
});
