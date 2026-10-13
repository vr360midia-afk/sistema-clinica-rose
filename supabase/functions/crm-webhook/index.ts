import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verificação de Webhook do Facebook/Meta Ads (Handshake inicial)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && challenge) {
      console.log('Webhook do Meta verificado com sucesso!');
      return new Response(challenge, { status: 200 });
    }
    return jsonResponse({ status: 'CRM Webhook ativo', timestamp: new Date().toISOString() });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    console.log('Recebido payload no CRM Webhook:', JSON.stringify(body));

    // Suporta múltiplos formatos:
    // 1. Padrão direto: { nome, telefone, email, origem, campanha, valor_estimado, observacoes }
    // 2. Meta Ads / Webhook Leadgen: { entry: [{ changes: [{ value: { ... } }] }] }
    // 3. Formulário de site (Elementor, Typebot, Zapier, Make): { name, phone, email, ... }
    let nome = body.nome || body.name || body.full_name || body.first_name || '';
    let telefone = body.telefone || body.phone || body.phone_number || body.whatsapp || '';
    let email = body.email || '';
    let origem = body.origem || body.source || 'Meta Ads';
    let campanha = body.campanha || body.campaign_name || body.ad_name || '';
    let valorEstimado = body.valor_estimado ? parseFloat(body.valor_estimado) : null;
    let observacoes = body.observacoes || body.message || body.mensagem || '';

    // Tratamento para Meta Ads nativo se vier em formato raw
    if (body.entry && Array.isArray(body.entry)) {
      origem = 'Meta Ads';
      const change = body.entry[0]?.changes?.[0]?.value;
      if (change) {
        campanha = change.form_id ? `Formulário Meta ID: ${change.form_id}` : 'Meta Lead Ads';
        observacoes = `Lead recebido automaticamente do Meta Ads (ID: ${change.leadgen_id || 'N/A'})`;
      }
    }

    if (!nome && !telefone) {
      return jsonResponse({ error: 'Informe ao menos nome ou telefone do lead' }, 400);
    }

    const { data, error } = await supabase
      .from('crm_leads')
      .insert([
        {
          nome: nome || 'Lead sem nome',
          telefone: telefone || null,
          email: email || null,
          origem: origem || 'Meta Ads',
          campanha: campanha || null,
          status: 'novo',
          valor_estimado: valorEstimado,
          observacoes: observacoes || 'Capturado automaticamente via Webhook',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir lead:', error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({
      success: true,
      mensagem: 'Lead inserido com sucesso no CRM',
      lead: data,
    });
  } catch (err: any) {
    console.error('Erro no processamento do webhook:', err);
    return jsonResponse({ error: err.message || 'Erro interno' }, 500);
  }
});
