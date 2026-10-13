import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const eighteenHoursAgo = new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let countFu1 = 0;
    let countFu2 = 0;

    // ------------------------------------------------------------------------
    // REGRA 1: primeiro_contato com last_outbound_at há mais de 3h e sem resposta -> followup_1
    // ------------------------------------------------------------------------
    const { data: leadsParaFu1, error: errFu1 } = await supabase
      .from('crm_leads')
      .select('id, name, nome, phone, telefone, stage, status, last_outbound_at, last_inbound_at')
      .in('stage', ['primeiro_contato'])
      .not('last_outbound_at', 'is', null)
      .lte('last_outbound_at', threeHoursAgo);

    if (errFu1) console.error('[Follow-up Cron] Erro ao buscar leads para FU1:', errFu1);

    if (leadsParaFu1 && leadsParaFu1.length > 0) {
      for (const lead of leadsParaFu1) {
        // Valida se o paciente NÃO respondeu após o último outbound
        const semRespostaDepois = !lead.last_inbound_at || new Date(lead.last_inbound_at) < new Date(lead.last_outbound_at);
        if (semRespostaDepois) {
          await supabase
            .from('crm_leads')
            .update({
              stage: 'followup_1',
              status: 'followup_1',
              updated_at: now.toISOString(),
            })
            .eq('id', lead.id);

          countFu1++;

          // ------------------------------------------------------------------
          // PONTO DE EXTENSÃO: Envio automático de Follow-up 1
          // Texto padrão configurável:
          // "Olá {nome}! Passando para saber se conseguiu dar uma olhadinha nas informações que conversamos mais cedo. Ficou alguma dúvida?"
          //
          // REGRA DE CONFORMIDADE DA META (Janela de 24h):
          // Mensagem livre só pode ser enviada dentro de 24h após a última mensagem recebida do paciente.
          // Fora desse período, a Meta exige envio via Template Aprovado.
          // ------------------------------------------------------------------
          const dentroDaJanela24h = lead.last_inbound_at && new Date(lead.last_inbound_at) >= twentyFourHoursAgo;
          if (dentroDaJanela24h) {
            // TODO: Descomentar e disparar mensagem automática quando habilitado nas configurações
            // await dispararMensagemFollowup(lead, 'Olá! Passando para saber se ficou com alguma dúvida sobre o atendimento de mais cedo.');
          } else {
            // TODO: Disparar Template Oficial Aprovado da Meta para mensagens fora da janela de 24h
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // REGRA 2: followup_1 com last_outbound_at há mais de 18h e sem resposta -> followup_2
    // ------------------------------------------------------------------------
    const { data: leadsParaFu2, error: errFu2 } = await supabase
      .from('crm_leads')
      .select('id, name, nome, phone, telefone, stage, status, last_outbound_at, last_inbound_at')
      .in('stage', ['followup_1', 'fu_3h'])
      .not('last_outbound_at', 'is', null)
      .lte('last_outbound_at', eighteenHoursAgo);

    if (errFu2) console.error('[Follow-up Cron] Erro ao buscar leads para FU2:', errFu2);

    if (leadsParaFu2 && leadsParaFu2.length > 0) {
      for (const lead of leadsParaFu2) {
        const semRespostaDepois = !lead.last_inbound_at || new Date(lead.last_inbound_at) < new Date(lead.last_outbound_at);
        if (semRespostaDepois) {
          await supabase
            .from('crm_leads')
            .update({
              stage: 'followup_2',
              status: 'followup_2',
              updated_at: now.toISOString(),
            })
            .eq('id', lead.id);

          countFu2++;

          // ------------------------------------------------------------------
          // PONTO DE EXTENSÃO: Envio automático de Follow-up 2
          // Texto padrão configurável:
          // "Oi {nome}! Temos horários abertos para avaliação com a Dra. Rosangela nesta semana. Posso reservar um horário para você?"
          // ------------------------------------------------------------------
          const dentroDaJanela24h = lead.last_inbound_at && new Date(lead.last_inbound_at) >= twentyFourHoursAgo;
          if (dentroDaJanela24h) {
            // TODO: Enviar follow-up 2 configurado
          } else {
            // TODO: Enviar Meta Template aprovado para reabrir conversa
          }
        }
      }
    }

    console.log(`[Follow-up Cron] Executado com sucesso. Movidos: FU1=${countFu1}, FU2=${countFu2}`);

    return new Response(
      JSON.stringify({
        success: true,
        executado_em: now.toISOString(),
        leads_movidos_followup_1: countFu1,
        leads_movidos_followup_2: countFu2,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Follow-up Cron] Erro na rotina:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
