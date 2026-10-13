import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

/**
 * Normaliza telefone para formato canônico E.164 (+55DDD9XXXXXXXX).
 * Trata o 9º dígito em números de celular do Brasil para evitar leads duplicados.
 */
export function normalizePhoneE164(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';

  // Se já tem código do Brasil (55)
  if (digits.startsWith('55')) {
    const dddAndNum = digits.slice(2);
    // Celular brasileiro com 10 dígitos (DDD + 8 dígitos) -> insere o 9º dígito
    if (dddAndNum.length === 10) {
      const ddd = dddAndNum.slice(0, 2);
      const num = dddAndNum.slice(2);
      return `+55${ddd}9${num}`;
    }
    // Celular com 11 dígitos (DDD + 9 dígitos)
    if (dddAndNum.length === 11) {
      return `+55${dddAndNum}`;
    }
    return `+${digits}`;
  }

  // Se veio sem o 55 (ex: DDD + 9 ou 8 dígitos)
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    return `+55${ddd}9${num}`;
  }
  if (digits.length === 11) {
    return `+55${digits}`;
  }

  return `+${digits}`;
}

/**
 * Validação de Assinatura HMAC SHA-256 em tempo constante (Meta x-hub-signature-256).
 */
async function verifyMetaSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;
  const signatureHex = parts[1].trim();

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, rawBody);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const expectedHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Comparação em tempo constante para evitar timing attacks
  if (expectedHex.length !== signatureHex.length) return false;
  let result = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    result |= expectedHex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Converte payload de mensagem para corpo textual legível (LGPD: sem expor em logs).
 */
function extractMessageBody(msg: any): string {
  const type = msg.type;
  switch (type) {
    case 'text':
      return msg.text?.body || '';
    case 'image':
      // TODO: Baixar e salvar mídia via Meta Graph API v21.0
      return '[Imagem]';
    case 'audio':
    case 'voice':
      // TODO: Baixar áudio via Meta Graph API v21.0
      return '[Áudio]';
    case 'document':
      // TODO: Baixar documento via Meta Graph API v21.0
      return `[Documento${msg.document?.filename ? `: ${msg.document.filename}` : ''}]`;
    case 'video':
      // TODO: Baixar vídeo via Meta Graph API v21.0
      return '[Vídeo]';
    case 'sticker':
      return '[Figurinha]';
    case 'location':
      return `[Localização: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
    case 'contacts':
      return '[Contato compartilhado]';
    case 'interactive':
      return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Resposta Interativa]';
    case 'button':
      return msg.button?.text || '[Botão]';
    default:
      return type ? `[${type}]` : '[Mensagem]';
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const WA_VERIFY_TOKEN = Deno.env.get('WA_VERIFY_TOKEN') || '';
  const WA_APP_SECRET = Deno.env.get('WA_APP_SECRET') || '';

  // --------------------------------------------------------------------------
  // 1. GET: Validação de Webhook da Meta (hub.challenge)
  // --------------------------------------------------------------------------
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
      console.log('[Webhook WhatsApp] Verificação de webhook realizada com sucesso');
      return new Response(challenge || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    console.warn('[Webhook WhatsApp] Falha na verificação de token');
    return new Response('Token de verificação inválido', { status: 403 });
  }

  // --------------------------------------------------------------------------
  // 2. POST: Processamento de Eventos (Mensagens e Coexistência smb_message_echoes)
  // --------------------------------------------------------------------------
  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 });
  }

  try {
    const rawBodyBuffer = await req.arrayBuffer();
    const rawBodyBytes = new Uint8Array(rawBodyBuffer);
    const signatureHeader = req.headers.get('x-hub-signature-256');

    // Valida assinatura se o secret estiver configurado
    if (WA_APP_SECRET) {
      const isValidSignature = await verifyMetaSignature(rawBodyBytes, signatureHeader, WA_APP_SECRET);
      if (!isValidSignature) {
        console.error('[Webhook WhatsApp] Assinatura x-hub-signature-256 inválida');
        return new Response('Assinatura inválida', { status: 401 });
      }
    }

    const textBody = new TextDecoder().decode(rawBodyBytes);
    const payload = JSON.parse(textBody);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Itera pelas entradas do webhook da Meta
    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // --------------------------------------------------------------------
        // A) Mensagens Recebidas do Paciente (inbound)
        // --------------------------------------------------------------------
        if (value.messages && Array.isArray(value.messages)) {
          const contacts = value.contacts || [];
          for (const msg of value.messages) {
            const rawFrom = msg.from;
            const waMessageId = msg.id;
            const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString();

            if (!rawFrom || !waMessageId) continue;

            const phone = normalizePhoneE164(rawFrom);
            const contactName = contacts[0]?.profile?.name || phone;
            const bodyText = extractMessageBody(msg);

            // 1. Busca ou cria o Lead
            const { data: existingLead } = await supabase
              .from('crm_leads')
              .select('id, stage, status, name, nome')
              .or(`phone.eq.${phone},telefone.eq.${phone}`)
              .limit(1)
              .maybeSingle();

            let leadId = existingLead?.id;

            if (existingLead) {
              // Se estava em followup_1 ou followup_2, paciente respondeu -> volta para primeiro_contato
              const currentStage = existingLead.stage || existingLead.status || 'novo_lead';
              let newStage = currentStage;
              if (currentStage === 'followup_1' || currentStage === 'followup_2' || currentStage === 'fu_3h' || currentStage === 'fu_18h') {
                newStage = 'primeiro_contato';
              }

              await supabase
                .from('crm_leads')
                .update({
                  last_inbound_at: timestamp,
                  stage: newStage,
                  status: newStage,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', leadId);
            } else {
              // Lead novo vindo do WhatsApp
              const { data: newLead, error: errLead } = await supabase
                .from('crm_leads')
                .insert([
                  {
                    phone: phone,
                    telefone: phone,
                    name: contactName,
                    nome: contactName,
                    origin: 'whatsapp',
                    origem: 'WhatsApp',
                    stage: 'novo_lead',
                    status: 'novo_lead',
                    last_inbound_at: timestamp,
                    created_at: timestamp,
                    updated_at: timestamp,
                  },
                ])
                .select('id')
                .single();

              if (!errLead && newLead) {
                leadId = newLead.id;
              }
            }

            // 2. Salva a Mensagem recebida (ignora se wa_message_id já existir)
            if (leadId) {
              await supabase
                .from('crm_messages')
                .insert([
                  {
                    lead_id: leadId,
                    direction: 'in',
                    body: bodyText,
                    wa_message_id: waMessageId,
                    created_at: timestamp,
                  },
                ])
                .select('id')
                .maybeSingle();
            }
          }
        }

        // --------------------------------------------------------------------
        // B) Coexistência: Mensagens Enviadas pelo Celular (smb_message_echoes)
        // --------------------------------------------------------------------
        const echoes = value.smb_message_echoes || value.message_echoes || [];
        if (Array.isArray(echoes) && echoes.length > 0) {
          for (const echo of echoes) {
            const rawTo = echo.to;
            const waMessageId = echo.id;
            const timestamp = echo.timestamp ? new Date(parseInt(echo.timestamp) * 1000).toISOString() : new Date().toISOString();

            if (!rawTo || !waMessageId) continue;

            const phone = normalizePhoneE164(rawTo);
            const bodyText = extractMessageBody(echo);

            // Busca ou cria o Lead para associar a mensagem enviada
            const { data: existingLead } = await supabase
              .from('crm_leads')
              .select('id, stage, status')
              .or(`phone.eq.${phone},telefone.eq.${phone}`)
              .limit(1)
              .maybeSingle();

            let leadId = existingLead?.id;

            if (existingLead) {
              const currentStage = existingLead.stage || existingLead.status || 'novo_lead';
              // Se estava em novo_lead e a clínica respondeu, move para primeiro_contato
              const newStage = currentStage === 'novo_lead' || currentStage === 'novo' ? 'primeiro_contato' : currentStage;

              await supabase
                .from('crm_leads')
                .update({
                  last_outbound_at: timestamp,
                  stage: newStage,
                  status: newStage,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', leadId);
            } else {
              // Se enviou para um número que ainda não existia no CRM
              const { data: newLead } = await supabase
                .from('crm_leads')
                .insert([
                  {
                    phone: phone,
                    telefone: phone,
                    name: phone,
                    nome: phone,
                    origin: 'whatsapp',
                    origem: 'WhatsApp',
                    stage: 'primeiro_contato',
                    status: 'primeiro_contato',
                    last_outbound_at: timestamp,
                    created_at: timestamp,
                    updated_at: timestamp,
                  },
                ])
                .select('id')
                .single();

              if (newLead) leadId = newLead.id;
            }

            // Salva a mensagem enviada (direction = out)
            if (leadId) {
              await supabase
                .from('crm_messages')
                .insert([
                  {
                    lead_id: leadId,
                    direction: 'out',
                    body: bodyText,
                    wa_message_id: waMessageId,
                    created_at: timestamp,
                  },
                ])
                .select('id')
                .maybeSingle();
            }
          }
        }
      }
    }

    // Responde 200 rápido para a Meta confirmar a entrega
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Webhook WhatsApp] Erro no processamento:', err.message);
    // Retorna 200 mesmo em caso de erro interno para evitar re-tentativas em loop da Meta
    return new Response(JSON.stringify({ success: false, error: 'Processamento concluído' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
