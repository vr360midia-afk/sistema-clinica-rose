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

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'sugerir_resposta_crm', lead, messages = [], systemPrompt, model: requestedModel, apiKey: providedKey } = body;

    // 1. Resolução da Chave da OpenAI
    // Ordem de prioridade:
    // a) Enviada no body da requisição (salva nas configurações do usuário)
    // b) Variável de ambiente OPENAI_API_KEY do Supabase
    // c) Fallback para LOVABLE_API_KEY (se estiver em transição)
    let openaiKey = (providedKey || '').trim();
    if (!openaiKey) {
      openaiKey = (Deno.env.get('OPENAI_API_KEY') || '').trim();
    }

    const lovableKey = (Deno.env.get('LOVABLE_API_KEY') || '').trim();

    // Se nenhuma chave estiver configurada
    if (!openaiKey && !lovableKey) {
      return jsonResponse(
        {
          error:
            'Chave de API do OpenAI (ChatGPT) não configurada. Por favor, adicione sua chave sk-... na tela de Configurações > APIs ou nos Segredos do Supabase.',
          code: 'API_KEY_MISSING',
        },
        400
      );
    }

    const model = requestedModel || (openaiKey ? 'gpt-4o-mini' : 'google/gemini-3.7-flash');

    // ========================================================================
    // AÇÃO 1: TESTE DE CONEXÃO COM A API DA OPENAI
    // ========================================================================
    if (action === 'test') {
      if (!openaiKey) {
        return jsonResponse(
          {
            success: false,
            error: 'Chave da OpenAI ausente para o teste.',
          },
          400
        );
      }

      const testRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Diga apenas: OK' }],
          max_tokens: 5,
        }),
      });

      if (!testRes.ok) {
        const errJson = await testRes.json().catch(() => ({}));
        return jsonResponse(
          {
            success: false,
            error: errJson?.error?.message || `Falha na API da OpenAI (Status: ${testRes.status})`,
            status: testRes.status,
          },
          400
        );
      }

      return jsonResponse({
        success: true,
        message: 'Conexão com a API do ChatGPT estabelecida com sucesso!',
        model,
      });
    }

    // ========================================================================
    // AÇÃO 2: SUGESTÃO DE RESPOSTA INTELIGENTE PARA O CRM (WHATSAPP)
    // ========================================================================
    if (action === 'sugerir_resposta_crm') {
      const nomeLead = lead?.name || lead?.nome || 'Paciente';
      const stageLead = lead?.stage || lead?.status || 'novo_lead';
      const telefoneLead = lead?.phone || lead?.telefone || '';
      const origemLead = lead?.origin || lead?.origem || 'WhatsApp';
      const obsLead = lead?.observacoes || '';

      // Formata o histórico recente de mensagens (máx 15 últimas para manter contexto e velocidade)
      const historicoFormatado = Array.isArray(messages) && messages.length > 0
        ? messages
            .slice(-15)
            .map((m: any) => {
              const remetente = m.direction === 'in' ? `${nomeLead} (Paciente)` : 'Clínica (Atendente)';
              return `[${remetente}]: ${m.body}`;
            })
            .join('\n')
        : 'Nenhuma mensagem trocada ainda.';

      const baseSystemPrompt =
        systemPrompt ||
        `Você é uma assistente executiva sênior de atendimento e concierge de uma clínica odontológica de alto padrão da Dra. Rosangela Santos, localizada em Maceió-AL.
Seu objetivo é encantar o paciente, transmitir segurança, autoridade e acolhimento, e conduzi-lo de forma natural para o agendamento de uma consulta de avaliação presencial.
Não dê orçamentos fechados sem consulta prévia, mas valorize o tratamento personalizado e os diferenciais da clínica.
Use um tom profissional, amigável, humanizado (com emojis moderados e elegantes), sem parecer um robô.`;

      const userPrompt = `Analise o perfil do lead e o histórico da conversa abaixo e gere sugestões inteligentes de resposta no WhatsApp:

---
DADOS DO LEAD:
- Nome: ${nomeLead}
- Telefone: ${telefoneLead}
- Etapa no Kanban: ${stageLead}
- Origem: ${origemLead}
${obsLead ? `- Observações: ${obsLead}` : ''}

HISTÓRICO DA CONVERSA:
${historicoFormatado}
---

RESPONDA EXCLUSIVAMENTE COM UM JSON VÁLIDO (sem blocos markdown adicionais ou texto fora do JSON) no seguinte formato:
{
  "temperatura": "Quente | Morno | Frio",
  "interesse": "breve descrição do interesse ou procedimento do paciente (ex: Implantes, Clareamento, Dúvida de horário)",
  "resumo": "resumo de 1 frase sobre o momento do paciente na negociação",
  "sugestoes": [
    {
      "tipo": "agendamento",
      "titulo": "📅 Agendamento de Consulta",
      "texto": "texto completo e pronto da mensagem para convidar ou confirmar data/hora com o paciente"
    },
    {
      "tipo": "acolhimento",
      "titulo": "💬 Dúvidas & Acolhimento",
      "texto": "texto completo focado em responder dúvidas, passar calma e segurança"
    },
    {
      "tipo": "followup",
      "titulo": "🔄 Reativação / Follow-up",
      "texto": "texto completo suave para reatar a conversa se o paciente demorou a responder"
    }
  ]
}`;

      // Monta a chamada para OpenAI ou Lovable Gateway
      const endpoint = openaiKey
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://ai.gateway.lovable.dev/v1/chat/completions';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (openaiKey) {
        headers['Authorization'] = `Bearer ${openaiKey}`;
      } else {
        headers['Lovable-API-Key'] = lovableKey;
        headers['X-Lovable-AIG-SDK'] = 'fetch';
      }

      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [
            { role: 'system', content: baseSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        console.error('[ChatGPT IA] Erro na API:', errText);
        return jsonResponse(
          {
            error: `Erro retornado pelo ChatGPT: ${errText.slice(0, 300)}`,
            status: apiRes.status,
          },
          400
        );
      }

      const resJson = await apiRes.json();
      const rawContent = resJson?.choices?.[0]?.message?.content || '{}';
      const cleanContent = rawContent.replace(/```json|```/g, '').trim();

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(cleanContent);
      } catch (parseErr) {
        console.warn('[ChatGPT IA] Não foi possível parsear JSON estrito:', cleanContent);
        parsedData = {
          temperatura: 'Morno',
          interesse: 'Atendimento Odontológico',
          resumo: 'Interesse identificado na conversa.',
          sugestoes: [
            {
              tipo: 'agendamento',
              titulo: '📅 Sugestão Automática',
              texto: cleanContent,
            },
          ],
        };
      }

      return jsonResponse({
        success: true,
        model,
        ...parsedData,
      });
    }

    // ========================================================================
    // AÇÃO 3: QUALIFICAÇÃO DE LEAD NO CRM
    // ========================================================================
    if (action === 'qualificar_lead') {
      const nomeLead = lead?.name || lead?.nome || 'Paciente';
      const messagesText = Array.isArray(messages)
        ? messages.map((m: any) => `${m.direction === 'in' ? nomeLead : 'Clínica'}: ${m.body}`).join('\n')
        : '';

      const promptQualificacao = `Você é um analista de CRM odontológico. Qualifique o seguinte lead:
Nome: ${nomeLead}
Conversa:
${messagesText}

Responda em JSON:
{
  "temperatura": "Quente | Morno | Frio",
  "score": 85,
  "tratamento_identificado": "Implante | Ortodontia | Estética | Geral",
  "objecoes": ["preço", "tempo", "medo"],
  "recomendacao_proxima_acao": "sugestão de ação para o atendente",
  "sugestao_etapa_kanban": "primeiro_contato | agendado | perdido | followup_1"
}`;

      const endpoint = openaiKey
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://ai.gateway.lovable.dev/v1/chat/completions';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (openaiKey) {
        headers['Authorization'] = `Bearer ${openaiKey}`;
      } else {
        headers['Lovable-API-Key'] = lovableKey;
      }

      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [{ role: 'user', content: promptQualificacao }],
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        return jsonResponse({ error: errText }, 400);
      }

      const resJson = await apiRes.json();
      const rawContent = resJson?.choices?.[0]?.message?.content || '{}';
      const cleanContent = rawContent.replace(/```json|```/g, '').trim();

      try {
        const parsed = JSON.parse(cleanContent);
        return jsonResponse({ success: true, ...parsed });
      } catch {
        return jsonResponse({ success: true, raw: cleanContent });
      }
    }

    // ========================================================================
    // AÇÃO 4: CHAT LIVRE / COMPLETION GENÉRICO
    // ========================================================================
    if (action === 'chat_livre') {
      const inputMessages = body.messages || [
        { role: 'user', content: body.prompt || 'Olá' },
      ];

      const endpoint = openaiKey
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://ai.gateway.lovable.dev/v1/chat/completions';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (openaiKey) {
        headers['Authorization'] = `Bearer ${openaiKey}`;
      } else {
        headers['Lovable-API-Key'] = lovableKey;
      }

      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: body.temperature ?? 0.7,
          messages: inputMessages,
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        return jsonResponse({ error: errText }, 400);
      }

      const resJson = await apiRes.json();
      return jsonResponse({
        success: true,
        model,
        resposta: resJson?.choices?.[0]?.message?.content || '',
        data: resJson,
      });
    }

    return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err: any) {
    console.error('[chatgpt-ia] Exceção:', err);
    return jsonResponse({ error: err.message || 'Erro interno no processamento de IA' }, 500);
  }
});
