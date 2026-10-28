import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Normaliza telefone para formato canônico E.164 (+55DDD9XXXXXXXX).
 */
function normalizePhoneE164(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('55')) {
    const dddAndNum = digits.slice(2);
    if (dddAndNum.length === 10) {
      const ddd = dddAndNum.slice(0, 2);
      const num = dddAndNum.slice(2);
      return `+55${ddd}9${num}`;
    }
    if (dddAndNum.length === 11) {
      return `+55${dddAndNum}`;
    }
    return `+${digits}`;
  }

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
  if (!signatureHeader || !appSecret) return true; // Se secret não configurado, prossegue com cautela

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

  if (expectedHex.length !== signatureHex.length) return false;
  let result = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    result |= expectedHex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Consulta a Meta Graph API para recuperar os campos e respostas do Leadgen
 */
async function fetchMetaLeadDetails(leadgenId: string, accessToken: string) {
  if (!accessToken || !leadgenId) return null;
  const url = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${accessToken}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Meta Graph API] Erro ao buscar lead ${leadgenId}:`, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[Meta Graph API] Falha na requisição para lead ${leadgenId}:`, err);
    return null;
  }
}

/**
 * Consulta nome do formulário ou campanha na Graph API (se token disponível)
 */
async function fetchMetaFormDetails(formId: string, accessToken: string) {
  if (!accessToken || !formId) return null;
  const url = `https://graph.facebook.com/v21.0/${formId}?fields=name&access_token=${accessToken}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Régua de Follow-up inicial
const FOLLOW_UPS_INICIAIS = [
  { id: 'fu_3h', etapa: '3h', label: '1º Contato (3 horas)', prazoHoras: 3, concluido: false },
  { id: 'fu_15h', etapa: '15h', label: '2º Contato (15 horas)', prazoHoras: 15, concluido: false },
  { id: 'fu_24h', etapa: '24h', label: '3º Contato (24 horas)', prazoHoras: 24, concluido: false },
  { id: 'fu_3d', etapa: '3d', label: '4º Contato (3º dia)', prazoHoras: 72, concluido: false },
  { id: 'fu_4d', etapa: '4d', label: '5º Contato (4º dia)', prazoHoras: 96, concluido: false },
  { id: 'fu_6d', etapa: '6d', label: '6º Contato (6º dia)', prazoHoras: 144, concluido: false },
  { id: 'fu_8d', etapa: '8d', label: '7º Contato (8º dia)', prazoHoras: 192, concluido: false },
  { id: 'fu_15d', etapa: '15d', label: '8º Contato (15º dia)', prazoHoras: 360, concluido: false },
  { id: 'fu_30d', etapa: '30d', label: '9º Contato (30º dia)', prazoHoras: 720, concluido: false },
];

const METADATA_PREFIX = '[NOVOS_LEADS_META]:';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const WA_VERIFY_TOKEN = Deno.env.get('WA_VERIFY_TOKEN') || Deno.env.get('META_VERIFY_TOKEN') || '';
  const WA_APP_SECRET = Deno.env.get('WA_APP_SECRET') || Deno.env.get('META_APP_SECRET') || '';
  const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('WA_TOKEN') || '';

  // 1. GET: Handshake de validação do Webhook do Meta Lead Ads
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && challenge) {
      if (!WA_VERIFY_TOKEN || token === WA_VERIFY_TOKEN) {
        console.log('[Meta Lead Ads] Webhook verificado com sucesso pelo Meta!');
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      console.warn('[Meta Lead Ads] Token de verificação incorreto recebido no GET');
      return new Response('Token inválido', { status: 403 });
    }

    return jsonResponse({
      status: 'Módulo Novos Leads Webhook Ativo',
      timestamp: new Date().toISOString(),
      meta_leadgen_ready: true,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  try {
    const rawBodyBuffer = await req.arrayBuffer();
    const rawBodyBytes = new Uint8Array(rawBodyBuffer);
    const signatureHeader = req.headers.get('x-hub-signature-256');

    // 2. Validação da Assinatura HMAC da Meta (x-hub-signature-256)
    if (WA_APP_SECRET && signatureHeader) {
      const isValid = await verifyMetaSignature(rawBodyBytes, signatureHeader, WA_APP_SECRET);
      if (!isValid) {
        console.error('[Meta Lead Ads] Assinatura HMAC SHA-256 inválida');
        return jsonResponse({ error: 'Assinatura inválida' }, 401);
      }
    }

    const textBody = new TextDecoder().decode(rawBodyBytes);
    let body: any = {};
    try {
      body = JSON.parse(textBody);
    } catch {
      return jsonResponse({ error: 'Corpo JSON inválido' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const leadsProcessados: any[] = [];

    // 3. Processamento de Eventos Nativos da Meta (Leadgen)
    // Estrutura: { object: 'page', entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id, form_id, ad_id } }] }] }
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field === 'leadgen' && change.value) {
            const val = change.value;
            const leadgenId = val.leadgen_id;
            const formId = val.form_id;
            const adId = val.ad_id;
            const createdTime = val.created_time
              ? new Date(val.created_time * 1000).toISOString()
              : new Date().toISOString();

            if (!leadgenId) continue;

            // Evitar duplicações pelo identificador do lead da Meta (Requirement 7)
            const { data: leadExistente } = await supabase
              .from('crm_leads')
              .select('*')
              .or(`meta_lead_id.eq.${leadgenId}`)
              .limit(1)
              .maybeSingle();

            if (leadExistente) {
              console.log(`[Meta Lead Ads] Lead ${leadgenId} já gravado anteriormente no banco. Ignorando.`);
              leadsProcessados.push(leadExistente);
              continue;
            }

            // Consulta segura à Meta Graph API para recuperar os campos e respostas preenchidas
            let nomeLead = '';
            let telefoneLead = '';
            let emailLead = '';
            let respostasCompletas: Array<{ campo: string; pergunta: string; resposta: string }> = [];
            let formName = '';

            if (META_ACCESS_TOKEN) {
              const leadDetails = await fetchMetaLeadDetails(leadgenId, META_ACCESS_TOKEN);
              if (leadDetails?.field_data) {
                for (const field of leadDetails.field_data) {
                  const fieldName = (field.name || '').toLowerCase();
                  const valStr = Array.isArray(field.values) ? field.values.join(', ') : String(field.values || '');

                  if (
                    fieldName.includes('full_name') ||
                    fieldName.includes('nome') ||
                    fieldName.includes('first_name')
                  ) {
                    if (!nomeLead) nomeLead = valStr;
                  } else if (
                    fieldName.includes('phone') ||
                    fieldName.includes('telefone') ||
                    fieldName.includes('whatsapp') ||
                    fieldName.includes('celular')
                  ) {
                    if (!telefoneLead) telefoneLead = valStr;
                  } else if (fieldName.includes('email')) {
                    if (!emailLead) emailLead = valStr;
                  } else {
                    respostasCompletas.push({
                      campo: field.name,
                      pergunta: field.name.replace(/_/g, ' '),
                      resposta: valStr,
                    });
                  }
                }
              }

              if (formId) {
                const fInfo = await fetchMetaFormDetails(formId, META_ACCESS_TOKEN);
                if (fInfo?.name) formName = fInfo.name;
              }
            }

            // Normaliza telefone E.164
            const telNormalizado = normalizePhoneE164(telefoneLead);

            // Verifica se o lead já existia pelo telefone (preserva histórico e status)
            if (telNormalizado && telNormalizado.length >= 8) {
              const sufixo = telNormalizado.slice(-8);
              const { data: todos } = await supabase.from('crm_leads').select('*').limit(200);
              const existenteTel = (todos || []).find((l: any) => {
                const dig = (l.telefone || l.phone || '').replace(/\D/g, '');
                return dig.endsWith(sufixo);
              });

              if (existenteTel) {
                console.log(`[Meta Lead Ads] Lead com telefone ${telNormalizado} já existe. Preservando status e anexando Meta Lead ID.`);
                // Anexa observações sem alterar o status
                const obsAtual = existenteTel.observacoes || '';
                const novaObs = `${obsAtual}\n[Novo formulário Meta ${createdTime}]: Form ID ${formId || 'N/A'}`;
                await supabase
                  .from('crm_leads')
                  .update({
                    observacoes: novaObs,
                    meta_lead_id: leadgenId,
                    data_atualizacao: new Date().toISOString(),
                  })
                  .eq('id', existenteTel.id);

                leadsProcessados.push(existenteTel);
                continue;
              }
            }

            // Determina prioridade inicial
            let prioridade: 'alta' | 'media' | 'baixa' = 'media';
            const respostasTexto = JSON.stringify(respostasCompletas).toLowerCase();
            if (
              respostasTexto.includes('urgente') ||
              respostasTexto.includes('imediato') ||
              respostasTexto.includes('hoje') ||
              respostasTexto.includes('faceta') ||
              respostasTexto.includes('resina')
            ) {
              prioridade = 'alta';
            }

            const metaPayload = {
              respostas: respostasCompletas,
              prioridade,
              revisado: false,
              revisado_em: null,
              revisado_por: null,
              status: 'Pendente',
              meta_lead_id: leadgenId,
              form_id: formId || null,
              ad_id: adId || null,
              alertas_agendamento: { h72: true, h48: true, h24: true, h3: true },
              follow_ups: FOLLOW_UPS_INICIAIS,
            };

            const obsTexto = `Lead recebido automaticamente do Meta Ads\nFormulário: ${formName || formId || 'Padrão'}\n\n${METADATA_PREFIX}${JSON.stringify(metaPayload)}`;

            const leadInsertPayload = {
              nome: nomeLead || 'Lead Meta Ads',
              telefone: telNormalizado || telefoneLead || null,
              email: emailLead || null,
              origem: 'Meta Lead Ads',
              campanha: formName ? `Form: ${formName}` : (adId ? `Anúncio: ${adId}` : 'Meta Lead Ads'),
              status: 'Pendente',
              observacoes: obsTexto,
            };

            // Insere no crm_leads com compatibilidade
            let novoLeadGravado: any = null;
            try {
              const { data: insData, error: insErr } = await supabase
                .from('crm_leads')
                .insert([
                  {
                    ...leadInsertPayload,
                    meta_lead_id: leadgenId,
                    form_id: formId || null,
                    ad_id: adId || null,
                    respostas: respostasCompletas,
                    prioridade,
                    revisado: false,
                    alertas_agendamento: metaPayload.alertas_agendamento,
                    follow_ups: FOLLOW_UPS_INICIAIS,
                  },
                ])
                .select()
                .single();

              if (!insErr && insData) {
                novoLeadGravado = insData;
              }
            } catch {
              // fallback
            }

            if (!novoLeadGravado) {
              const { data: insFallback, error: errFallback } = await supabase
                .from('crm_leads')
                .insert([leadInsertPayload])
                .select()
                .single();

              if (errFallback) {
                console.error('[Meta Lead Ads] Erro ao gravar lead no banco:', errFallback);
              } else {
                novoLeadGravado = insFallback;
              }
            }

            if (novoLeadGravado) {
              leadsProcessados.push(novoLeadGravado);
            }
          }
        }
      }

      return jsonResponse({
        success: true,
        tipo: 'meta_leadgen',
        leads_processados: leadsProcessados.length,
        leads: leadsProcessados,
      });
    }

    // 4. Formato Direto / Simulação de Teste / Zapier / Make
    // Aceita: { nome, telefone, email, origem, campanha, respostas, prioridade, leadgen_id, meta_lead_id, observacoes }
    let nome = body.nome || body.name || body.full_name || '';
    let telefone = body.telefone || body.phone || body.phone_number || body.whatsapp || '';
    let email = body.email || '';
    let origem = body.origem || body.source || 'Meta Lead Ads';
    let campanha = body.campanha || body.campaign_name || body.ad_name || '';
    let valorEstimado = body.valor_estimado ? parseFloat(body.valor_estimado) : null;
    let observacoes = body.observacoes || body.message || body.mensagem || '';
    let metaLeadId = body.meta_lead_id || body.leadgen_id || null;
    let formId = body.form_id || null;
    let adId = body.ad_id || null;
    let prioridade = (body.prioridade as 'alta' | 'media' | 'baixa') || 'media';
    let respostas = Array.isArray(body.respostas) ? body.respostas : [];

    if (!nome && !telefone) {
      return jsonResponse({ error: 'Informe ao menos nome ou telefone do lead' }, 400);
    }

    const telNormalizado = normalizePhoneE164(telefone);

    // Evita duplicação por meta_lead_id
    if (metaLeadId) {
      const { data: leadExistente } = await supabase
        .from('crm_leads')
        .select('*')
        .or(`meta_lead_id.eq.${metaLeadId}`)
        .limit(1)
        .maybeSingle();

      if (leadExistente) {
        return jsonResponse({
          success: true,
          duplicado: true,
          mensagem: 'Lead com este ID da Meta já existe no banco',
          lead: leadExistente,
        });
      }
    }

    const metaPayload = {
      respostas,
      prioridade,
      revisado: false,
      revisado_em: null,
      revisado_por: null,
      status: 'Pendente',
      meta_lead_id: metaLeadId,
      form_id: formId,
      ad_id: adId,
      alertas_agendamento: { h72: true, h48: true, h24: true, h3: true },
      follow_ups: FOLLOW_UPS_INICIAIS,
    };

    const obsTexto = `${observacoes || 'Lead capturado via Webhook'}\n\n${METADATA_PREFIX}${JSON.stringify(metaPayload)}`;

    const insertObj: any = {
      nome: nome || 'Lead sem nome',
      telefone: telNormalizado || telefone || null,
      email: email || null,
      origem: origem || 'Meta Lead Ads',
      campanha: campanha || null,
      status: 'Pendente',
      valor_estimado: valorEstimado,
      observacoes: obsTexto,
    };

    let leadGravado: any = null;
    try {
      const { data: insData, error: insErr } = await supabase
        .from('crm_leads')
        .insert([
          {
            ...insertObj,
            meta_lead_id: metaLeadId,
            form_id: formId,
            ad_id: adId,
            respostas,
            prioridade,
            revisado: false,
            alertas_agendamento: metaPayload.alertas_agendamento,
            follow_ups: FOLLOW_UPS_INICIAIS,
          },
        ])
        .select()
        .single();

      if (!insErr && insData) leadGravado = insData;
    } catch {
      // fallback
    }

    if (!leadGravado) {
      const { data: insFallback, error: errFallback } = await supabase
        .from('crm_leads')
        .insert([insertObj])
        .select()
        .single();

      if (errFallback) {
        return jsonResponse({ error: errFallback.message }, 500);
      }
      leadGravado = insFallback;
    }

    return jsonResponse({
      success: true,
      mensagem: 'Lead gravado com sucesso no módulo Novos Leads',
      lead: leadGravado,
    });
  } catch (err: any) {
    console.error('[Novos Leads Webhook] Erro no processamento:', err);
    return jsonResponse({ error: err.message || 'Erro interno' }, 500);
  }
});
